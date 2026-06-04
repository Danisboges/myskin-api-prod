const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const prisma = require("../src/config/prisma");
const authController = require("../src/controllers/auth.controller");
const authService = require("../src/services/auth.service");
const { loginUser } = require("../src/services/auth.service");
const { maintenanceModeMiddleware } = require("../src/middlewares/maintenance.middleware");
const { createMaintenanceError } = require("../src/utils/maintenance.util");

const createdUserIds = [];
const originalMaintenanceOverride = process.env.MAINTENANCE_MODE_TEST_OVERRIDE;
const originalLoginUser = authService.loginUser;

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createUser = async (role) => {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name: `${role} maintenance test`,
      email: `${role}.maintenance.${token}@example.com`,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role,
      gender: role === "doctor" ? "female" : "male",
      status: "active",
      ...(role === "admin" && {
        adminSettings: {
          create: {},
        },
      }),
      ...(role === "doctor" && {
        doctorProfile: {
          create: {
            verificationStatus: "verified",
            practitionerLicense: `LIC-${token}`,
            specialization: "Dermatology",
            settings: { create: {} },
          },
        },
      }),
      ...(role === "patient" && {
        patientProfile: {
          create: {
            settings: { create: {} },
          },
        },
      }),
    },
    select: { id: true, email: true, role: true },
  });

  createdUserIds.push(user.id);
  return user;
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

const createReq = (user, path = "/api/v1/patient/profile") => ({
  path,
  headers: {
    authorization: `Bearer ${jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET)}`,
  },
});

const setMaintenanceOverride = (value) => {
  process.env.MAINTENANCE_MODE_TEST_OVERRIDE = value ? "true" : "false";
};

test.beforeEach(() => {
  setMaintenanceOverride(false);
  authService.loginUser = originalLoginUser;
});

test.afterEach(() => {
  authService.loginUser = originalLoginUser;
});

test.after(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }

  if (originalMaintenanceOverride === undefined) {
    delete process.env.MAINTENANCE_MODE_TEST_OVERRIDE;
  } else {
    process.env.MAINTENANCE_MODE_TEST_OVERRIDE = originalMaintenanceOverride;
  }

  await prisma.$disconnect();
});

test("admin tetap bisa akses saat maintenance aktif", async () => {
  setMaintenanceOverride(true);
  const admin = await createUser("admin");
  const req = createReq(admin, "/api/v1/admin/settings");
  const res = createRes();
  let nextCalled = false;

  await maintenanceModeMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("doctor dan patient ditolak 503 saat maintenance aktif", async () => {
  setMaintenanceOverride(true);
  const doctor = await createUser("doctor");
  const patient = await createUser("patient");

  for (const user of [doctor, patient]) {
    const req = createReq(user);
    const res = createRes();
    let nextCalled = false;

    await maintenanceModeMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, {
      status: "error",
      code: "MAINTENANCE_MODE",
      message: "System is under maintenance",
    });
  }
});

test("akses normal saat maintenanceMode false", async () => {
  setMaintenanceOverride(false);
  const patient = await createUser("patient");
  const req = createReq(patient);
  const res = createRes();
  let nextCalled = false;

  await maintenanceModeMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("login non-admin ditolak 503 saat maintenance aktif, admin tetap bisa login", async () => {
  setMaintenanceOverride(true);
  const admin = await createUser("admin");
  const patient = await createUser("patient");

  await assert.rejects(
    loginUser(patient.email, "Str0ng!Pass2026"),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, "MAINTENANCE_MODE");
      assert.equal(error.message, "System is under maintenance");
      return true;
    }
  );

  const result = await loginUser(admin.email, "Str0ng!Pass2026");
  assert.equal(result.role, "admin");
  assert.equal(typeof result.token, "string");
});

test("login controller returns exact maintenance response", async () => {
  authService.loginUser = async () => {
    throw createMaintenanceError();
  };

  const res = createRes();
  await authController.login({
    body: {
      email: "patient@example.com",
      password: "Str0ng!Pass2026",
    },
  }, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    status: "error",
    code: "MAINTENANCE_MODE",
    message: "System is under maintenance",
  });
});
