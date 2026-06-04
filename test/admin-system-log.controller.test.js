const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = "false";
process.env.ADMIN_NOTIFICATION_TEST_DISABLE = "true";

const prisma = require("../src/config/prisma");
const adminRoutes = require("../src/routes/admin.route");

const createdUserIds = [];
const createdSystemLogIds = [];

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/admin", adminRoutes);
  return app;
};

const request = async (app, { method, path, token, body }) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const options = {
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers: {
        ...(payload && {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = http.request(options, (res) => {
      let rawBody = "";
      res.on("data", (chunk) => {
        rawBody += chunk;
      });
      res.on("end", () => {
        server.close(() => {
          resolve({
            statusCode: res.statusCode,
            body: rawBody ? JSON.parse(rawBody) : null,
          });
        });
      });
    });

    req.on("error", (error) => {
      server.close(() => reject(error));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
});

const createUser = async (role) => {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name: `${role} system log test ${token}`,
      email: `${role}.system-log.${token}@example.com`,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role,
      gender: "male",
      status: "active",
      ...(role === "admin" && {
        adminSettings: {
          create: {},
        },
      }),
      ...(role === "patient" && {
        patientProfile: {
          create: {},
        },
      }),
    },
    select: { id: true, name: true, role: true },
  });

  createdUserIds.push(user.id);
  return user;
};

const createToken = (user) => jwt.sign(
  { id: user.id, name: user.name, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

test.after(async () => {
  for (const userId of createdUserIds) {
    await prisma.systemLog.deleteMany({
      where: { metadata: { contains: userId } },
    });
  }

  if (createdSystemLogIds.length > 0) {
    await prisma.systemLog.deleteMany({
      where: { id: { in: createdSystemLogIds } },
    });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }

  await prisma.$disconnect();
});

test("POST /api/v1/admin/system/logs/cleanup succeeds with retentionDays body", async () => {
  const admin = await createUser("admin");
  const oldLog = await prisma.systemLog.create({
    data: {
      title: `Old controller system log ${stamp()}`,
      description: "Old controller cleanup test",
      severity: "info",
      category: "system",
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  createdSystemLogIds.push(oldLog.id);

  const response = await request(createApp(), {
    method: "POST",
    path: "/api/v1/admin/system/logs/cleanup",
    token: createToken(admin),
    body: { retentionDays: 30 },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "success");
  assert.equal(response.body.message, "Expired system logs cleaned up successfully");
  assert.ok(response.body.deletedCount >= 1);
  assert.equal(await prisma.systemLog.findUnique({ where: { id: oldLog.id } }), null);
});

test("POST /api/v1/admin/system/logs/cleanup uses AdminSettings default retentionDays", async () => {
  const admin = await createUser("admin");
  await prisma.adminSettings.update({
    where: { adminId: admin.id },
    data: { auditLogRetentionDays: 90 },
  });
  const oldLog = await prisma.systemLog.create({
    data: {
      title: `Old default retention system log ${stamp()}`,
      description: "Default retention cleanup test",
      severity: "info",
      category: "system",
      createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  createdSystemLogIds.push(oldLog.id);

  const response = await request(createApp(), {
    method: "POST",
    path: "/api/v1/admin/system/logs/cleanup",
    token: createToken(admin),
    body: {},
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.deletedCount >= 1);
  assert.equal(await prisma.systemLog.findUnique({ where: { id: oldLog.id } }), null);
});

test("POST /api/v1/admin/system/logs/cleanup rejects invalid retentionDays", async () => {
  const admin = await createUser("admin");

  const response = await request(createApp(), {
    method: "POST",
    path: "/api/v1/admin/system/logs/cleanup",
    token: createToken(admin),
    body: { retentionDays: 45 },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    status: "error",
    message: "retentionDays harus bernilai 30, 90, 180, atau 365",
  });
});

test("POST /api/v1/admin/system/logs/cleanup rejects non-admin users", async () => {
  const patient = await createUser("patient");

  const response = await request(createApp(), {
    method: "POST",
    path: "/api/v1/admin/system/logs/cleanup",
    token: createToken(patient),
    body: { retentionDays: 30 },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Akses ditolak. Endpoint ini hanya untuk Admin.");
});

test("POST /api/v1/admin/system/logs/cleanup creates completion system log", async () => {
  const admin = await createUser("admin");

  const response = await request(createApp(), {
    method: "POST",
    path: "/api/v1/admin/system/logs/cleanup",
    token: createToken(admin),
    body: { retentionDays: 365 },
  });

  assert.equal(response.statusCode, 200);

  const completionLog = await prisma.systemLog.findFirst({
    where: {
      title: "System logs cleanup completed",
      metadata: { contains: admin.id },
    },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(completionLog);
  assert.equal(completionLog.severity, "info");
  assert.equal(completionLog.category, "system");
  assert.equal(JSON.parse(completionLog.metadata).retentionDays, 365);
});
