const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_NOTIFICATION_TEST_DISABLE = "true";

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");

const createdUserIds = [];
const createdClinicIds = [];

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createClinic = async ({ name, isActive = true }) => {
  const clinic = await prisma.clinic.create({
    data: { name, isActive },
    select: { clinicId: true, name: true, isActive: true },
  });

  createdClinicIds.push(clinic.clinicId);
  return clinic;
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

test("admin createUser stores clinicId and returns clinic fields for doctor", async () => {
  const token = stamp();
  const clinic = await createClinic({
    name: `Admin Create Doctor Clinic ${token}`,
  });

  const result = await adminService.createUser({
    fullName: "Admin Created Doctor",
    email: `admin.created.doctor.${token}@example.com`,
    role: "doctor",
    gender: "male",
    password: "Str0ng!Pass2026",
    clinicId: ` ${clinic.clinicId} `,
    specialization: "Dermatology",
    licenseNumber: `LIC-${token}`,
  });

  createdUserIds.push(result.data.userId);

  assert.equal(result.data.doctorProfile.clinicId, clinic.clinicId);
  assert.equal(result.data.doctorProfile.clinicName, clinic.name);
  assert.deepEqual(result.data.doctorProfile.clinic, {
    clinicId: clinic.clinicId,
    name: clinic.name,
  });

  const storedDoctor = await prisma.doctorProfile.findUnique({
    where: { userId: result.data.userId },
    select: { clinicId: true },
  });
  assert.equal(storedDoctor.clinicId, clinic.clinicId);
});

test("admin createUser rejects doctor without clinicId", async () => {
  const token = stamp();

  await assert.rejects(
    adminService.createUser({
      fullName: "Doctor Without Clinic",
      email: `doctor.no.clinic.${token}@example.com`,
      role: "doctor",
      gender: "female",
      password: "Str0ng!Pass2026",
      clinicId: " ",
      specialization: "Dermatology",
      licenseNumber: `LIC-NO-CLINIC-${token}`,
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Clinic wajib dipilih untuk doctor");
      return true;
    }
  );
});

test("admin createUser rejects doctor with inactive or missing clinic", async () => {
  const token = stamp();
  const inactiveClinic = await createClinic({
    name: `Inactive Clinic ${token}`,
    isActive: false,
  });

  await assert.rejects(
    adminService.createUser({
      fullName: "Doctor Inactive Clinic",
      email: `doctor.inactive.clinic.${token}@example.com`,
      role: "doctor",
      gender: "male",
      password: "Str0ng!Pass2026",
      clinicId: inactiveClinic.clinicId,
      specialization: "Dermatology",
      licenseNumber: `LIC-INACTIVE-${token}`,
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Clinic tidak ditemukan atau tidak aktif");
      return true;
    }
  );

  await assert.rejects(
    adminService.createUser({
      fullName: "Doctor Missing Clinic",
      email: `doctor.missing.clinic.${token}@example.com`,
      role: "doctor",
      gender: "female",
      password: "Str0ng!Pass2026",
      clinicId: `missing-${token}`,
      specialization: "Dermatology",
      licenseNumber: `LIC-MISSING-${token}`,
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Clinic tidak ditemukan atau tidak aktif");
      return true;
    }
  );
});
