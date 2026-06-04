const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prisma = require("../src/config/prisma");
const clinicService = require("../src/services/clinic.service");
const {
  validateClinicPayload,
  validateClinicQuery,
} = require("../src/validators/clinic.validator");

const createdClinicIds = [];
const createdUserIds = [];

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

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

test("clinic service creates, lists, updates, and hard deletes clinics", async () => {
  const token = stamp();
  const createdClinic = await clinicService.createClinic({
    name: `Clinic ${token}`,
    address: "123 Health Street",
    phone: "+628123456789",
    email: `clinic.${token}@example.com`,
  });

  createdClinicIds.push(createdClinic.clinicId);

  assert.equal(createdClinic.name, `Clinic ${token}`);
  assert.equal(createdClinic.isActive, true);
  assert.equal(createdClinic.doctorsCount, 0);

  const listResult = await clinicService.getClinics({
    search: token,
    isActive: "true",
    page: 1,
    limit: 5,
  });

  assert.equal(listResult.meta.total, 1);
  assert.equal(listResult.data[0].clinicId, createdClinic.clinicId);

  const detail = await clinicService.getClinicById(createdClinic.clinicId);
  assert.equal(detail.email, `clinic.${token}@example.com`);

  const updatedClinic = await clinicService.updateClinic(createdClinic.clinicId, {
    name: `Updated Clinic ${token}`,
    phone: "+628987654321",
  });

  assert.equal(updatedClinic.name, `Updated Clinic ${token}`);
  assert.equal(updatedClinic.phone, "+628987654321");

  const deletedClinic = await clinicService.deleteClinic(createdClinic.clinicId);
  assert.equal(deletedClinic.clinicId, createdClinic.clinicId);

  const storedClinic = await prisma.clinic.findUnique({
    where: { clinicId: createdClinic.clinicId },
  });
  assert.equal(storedClinic, null);
});

test("deleteClinic returns 404 when clinic is not found", async () => {
  await assert.rejects(
    clinicService.deleteClinic(`missing-${stamp()}`),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.message, "Clinic not found");
      return true;
    }
  );
});

test("deleteClinic hard deletes clinic and clears doctor relation when schema allows set null", async () => {
  const token = stamp();
  const clinic = await clinicService.createClinic({
    name: `Doctor Relation Clinic ${token}`,
  });
  createdClinicIds.push(clinic.clinicId);

  const user = await prisma.user.create({
    data: {
      name: `Clinic Doctor ${token}`,
      email: `clinic.doctor.${token}@example.com`,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role: "doctor",
      gender: "male",
      status: "active",
      doctorProfile: {
        create: {
          clinicId: clinic.clinicId,
          verificationStatus: "verified",
          practitionerLicense: `LIC-${token}`,
          specialization: "Dermatology",
        },
      },
    },
    select: {
      id: true,
      doctorProfile: {
        select: { id: true },
      },
    },
  });
  createdUserIds.push(user.id);

  await clinicService.deleteClinic(clinic.clinicId);

  const storedClinic = await prisma.clinic.findUnique({
    where: { clinicId: clinic.clinicId },
  });
  assert.equal(storedClinic, null);

  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: user.doctorProfile.id },
    select: { clinicId: true },
  });
  assert.equal(doctorProfile.clinicId, null);
});

test("clinic validators reject invalid payloads and queries", () => {
  assert.deepEqual(validateClinicPayload({}), {
    name: "Clinic name is required",
  });

  assert.deepEqual(validateClinicPayload({ name: "Clinic", email: "bad-email" }), {
    email: "Valid email is required",
  });

  assert.deepEqual(validateClinicQuery({ page: "0", limit: "101", isActive: "maybe" }), {
    page: "Page must be a positive number",
    limit: "Limit must be between 1 and 100",
    isActive: "isActive must be true, false, or all",
  });
});
