const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.ADMIN_NOTIFICATION_TEST_DISABLE = "true";
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = "false";

const prisma = require("../src/config/prisma");
const adminController = require("../src/controllers/admin.controller");
const adminService = require("../src/services/admin.service");

const originalService = {
  resolveAdminPagination: adminService.resolveAdminPagination,
  getSystemLogs: adminService.getSystemLogs,
};

const createRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const createReq = (query = {}) => ({
  query,
  user: { id: "admin-1", name: "Admin Tester", role: "admin" },
});

const request = async (app, { method, path, headers = {} }) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers,
    }, (res) => {
      let rawBody = "";
      res.on("data", (chunk) => {
        rawBody += chunk;
      });
      res.on("end", () => {
        server.close(() => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: rawBody ? JSON.parse(rawBody) : null,
          });
        });
      });
    });

    req.on("error", (error) => {
      server.close(() => reject(error));
    });
    req.end();
  });
});

const requestRaw = async (app, { method, path, headers = {} }) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => {
        chunks.push(chunk);
      });
      res.on("end", () => {
        server.close(() => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      });
    });

    req.on("error", (error) => {
      server.close(() => reject(error));
    });
    req.end();
  });
});

test.afterEach(() => {
  Object.assign(adminService, originalService);
});

test.after(async () => {
  await prisma.systemLog.deleteMany({
    where: {
      title: "Critical system error",
      metadata: { contains: "/api/v1/admin/system/logs" },
    },
  });

  await prisma.$disconnect();
});

test("getSystemLogs controller returns logs with filters and pagination", async () => {
  adminService.resolveAdminPagination = async (adminId, pagination) => {
    assert.equal(adminId, "admin-1");
    assert.deepEqual(pagination, { page: "1", limit: "8" });
    return { page: 1, limit: 8 };
  };
  adminService.getSystemLogs = async (filters) => {
    assert.deepEqual(filters, {
      type: "security",
      severity: "warning",
      page: 1,
      limit: 8,
    });
    return {
      data: [],
      meta: { page: 1, limit: 8, total: 0, totalPages: 1 },
    };
  };

  const res = createRes();
  await adminController.getSystemLogs(
    createReq({ type: "security", severity: "warning", page: "1", limit: "8" }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "success",
    data: {
      data: [],
      meta: { page: 1, limit: 8, total: 0, totalPages: 1 },
    },
  });
});

test("getSystemLogs controller validates type and severity filters", async () => {
  const res = createRes();

  await adminController.getSystemLogs(
    createReq({ type: "bad_type", severity: "bad_severity" }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    status: "error",
    errors: {
      type: "type must be one of infrastructure, ai_engine, user_management, security, or system",
      severity: "severity must be one of critical, warning, or info",
    },
  });
});

test("global 500 error handler creates critical system log", async () => {
  const { globalErrorHandler } = require("../server");
  const error = new Error("Controller test critical error");
  const req = {
    method: "GET",
    originalUrl: "/api/v1/admin/system/logs",
  };
  const res = createRes();

  await globalErrorHandler(error, req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    status: "error",
    message: "Controller test critical error",
  });

  const log = await prisma.systemLog.findFirst({
    where: {
      title: "Critical system error",
      severity: "critical",
      category: "system",
      description: "Controller test critical error",
      metadata: { contains: "/api/v1/admin/system/logs" },
    },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(log);
  assert.equal(JSON.parse(log.metadata).status, 500);
});

test("uploaded images are served for canvas annotation with CORS headers", async () => {
  const app = require("../server");
  const uploadDir = path.join(__dirname, "..", "uploads");
  const fileName = `static-test-${Date.now()}.png`;
  const filePath = path.join(uploadDir, fileName);
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ]));

  try {
    for (const publicPath of [`/uploads/${fileName}`, `/api/uploads/${fileName}`]) {
      const res = await requestRaw(app, {
        method: "GET",
        path: publicPath,
        headers: {
          Origin: "http://localhost:5173",
          Authorization: "Bearer test-token",
        },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
      assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
      assert.match(res.headers["content-type"], /^image\/png/);
      assert.equal(res.body.subarray(0, 4).toString("hex"), "89504e47");
    }
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});
