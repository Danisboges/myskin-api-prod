const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");

const createdUserIds = [];
const createdClinicIds = [];

const createClinic = async (name) => {
  const clinic = await prisma.clinic.create({
    data: { name },
    select: { clinicId: true, name: true },
  });

  createdClinicIds.push(clinic.clinicId);
  return clinic;
};

const createDoctor = async ({ clinicId, email, name }) => {
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role: "doctor",
      gender: "male",
      status: "active",
      doctorProfile: {
        create: {
          clinicId,
          verificationStatus: "verified",
          practitionerLicense: `LIC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          specialization: "Dermatology",
        },
      },
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

  if (createdClinicIds.length > 0) {
    await prisma.clinic.deleteMany({
      where: { clinicId: { in: createdClinicIds } },
    });
  }

  await prisma.$disconnect();
});

test("getAllDoctors filters by clinicId and returns clinic fields", async () => {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const clinicA = await createClinic(`Admin Doctors Clinic A ${stamp}`);
  const clinicB = await createClinic(`Admin Doctors Clinic B ${stamp}`);

  await createDoctor({
    clinicId: clinicA.clinicId,
    email: `doctor.a.${stamp}@example.com`,
    name: `Doctor A ${stamp}`,
  });
  await createDoctor({
    clinicId: clinicB.clinicId,
    email: `doctor.b.${stamp}@example.com`,
    name: `Doctor B ${stamp}`,
  });

  const result = await adminService.getAllDoctors({
    clinicId: clinicA.clinicId,
    status: "all",
    page: 1,
    limit: 10,
  });

  assert.equal(result.meta.total, 1);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].clinicId, clinicA.clinicId);
  assert.equal(result.data[0].clinicName, clinicA.name);
  assert.deepEqual(result.data[0].clinic, {
    clinicId: clinicA.clinicId,
    name: clinicA.name,
  });
});
