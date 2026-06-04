const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");
const doctorService = require("../src/services/doctor.service");
const patientService = require("../src/services/patient.service");

const createdUserIds = [];

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createUser = async (role, email) => {
  const user = await prisma.user.create({
    data: {
      name: `${role} email test`,
      email,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role,
      gender: role === "doctor" ? "female" : "male",
      status: "active",
      ...(role === "doctor" && {
        doctorProfile: {
          create: {
            verificationStatus: "verified",
            practitionerLicense: `LIC-${stamp()}`,
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
    select: { id: true },
  });

  createdUserIds.push(user.id);
  return user;
};

test.after(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }

  await prisma.$disconnect();
});

test("admin createUser stores normalized email and rejects case-insensitive duplicate", async () => {
  const token = stamp();
  const result = await adminService.createUser({
    fullName: "Admin Created Patient",
    email: `  Admin.Created.${token}@Example.COM  `,
    role: "patient",
    gender: "male",
    password: "Str0ng!Pass2026",
  });

  createdUserIds.push(result.data.userId);
  assert.equal(result.data.email, `admin.created.${token}@example.com`);

  await assert.rejects(
    adminService.createUser({
      fullName: "Duplicate Admin Created Patient",
      email: `ADMIN.CREATED.${token}@EXAMPLE.COM`,
      role: "patient",
      gender: "female",
      password: "Str0ng!Pass2026",
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "Email sudah terdaftar");
      return true;
    }
  );
});

test("admin updateUser normalizes email and rejects duplicate", async () => {
  const token = stamp();
  const userA = await createUser("patient", `admin.update.a.${token}@example.com`);
  const userB = await createUser("patient", `admin.update.b.${token}@example.com`);

  await adminService.updateUser(userA.id, {
    email: `  Admin.Updated.${token}@Example.COM  `,
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id: userA.id },
    select: { email: true },
  });
  assert.equal(updatedUser.email, `admin.updated.${token}@example.com`);

  await assert.rejects(
    adminService.updateUser(userA.id, {
      email: `ADMIN.UPDATE.B.${token}@EXAMPLE.COM`,
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "Email sudah terdaftar");
      return true;
    }
  );

  assert.ok(userB.id);
});

test("admin account settings normalizes email and rejects duplicate", async () => {
  const token = stamp();
  const admin = await createUser("admin", `admin.settings.${token}@example.com`);
  await createUser("patient", `admin.settings.duplicate.${token}@example.com`);

  await adminService.updateAdminSettingsAccount(
    admin.id,
    `  Admin.Settings.Updated.${token}@Example.COM  `
  );

  const updatedAdmin = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { email: true },
  });
  assert.equal(updatedAdmin.email, `admin.settings.updated.${token}@example.com`);

  await assert.rejects(
    adminService.updateAdminSettingsAccount(
      admin.id,
      `ADMIN.SETTINGS.DUPLICATE.${token}@EXAMPLE.COM`
    ),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "Email sudah terdaftar");
      return true;
    }
  );
});

test("admin account settings requires a valid email when email is provided", async () => {
  const token = stamp();
  const admin = await createUser("admin", `admin.invalid.${token}@example.com`);

  await assert.rejects(
    adminService.updateAdminSettingsAccount(admin.id, "bad-email"),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Email harus memiliki tepat satu simbol @");
      return true;
    }
  );
});

test("doctor account settings normalizes email and rejects duplicate", async () => {
  const token = stamp();
  const doctor = await createUser("doctor", `doctor.email.${token}@example.com`);
  await createUser("patient", `doctor.duplicate.${token}@example.com`);

  await doctorService.updateAccountSettings(doctor.id, {
    email: `  Doctor.Settings.${token}@Example.COM  `,
  });

  const updatedDoctor = await prisma.user.findUnique({
    where: { id: doctor.id },
    select: { email: true },
  });
  assert.equal(updatedDoctor.email, `doctor.settings.${token}@example.com`);

  await assert.rejects(
    doctorService.updateAccountSettings(doctor.id, {
      email: `DOCTOR.DUPLICATE.${token}@EXAMPLE.COM`,
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "Email sudah terdaftar");
      return true;
    }
  );
});

test("patient account settings normalizes email and rejects duplicate", async () => {
  const token = stamp();
  const patient = await createUser("patient", `patient.email.${token}@example.com`);
  await createUser("doctor", `patient.duplicate.${token}@example.com`);

  await patientService.updateAccountSettings(patient.id, {
    email: `  Patient.Settings.${token}@Example.COM  `,
  });

  const updatedPatient = await prisma.user.findUnique({
    where: { id: patient.id },
    select: { email: true },
  });
  assert.equal(updatedPatient.email, `patient.settings.${token}@example.com`);

  await assert.rejects(
    patientService.updateAccountSettings(patient.id, {
      email: `PATIENT.DUPLICATE.${token}@EXAMPLE.COM`,
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "Email sudah terdaftar");
      return true;
    }
  );
});
