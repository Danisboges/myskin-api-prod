const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");
const doctorService = require("../src/services/doctor.service");
const { loginUser } = require("../src/services/auth.service");

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

const createDoctor = async ({
  clinicId,
  email,
  name,
  userStatus = "active",
  verificationStatus = "verified",
}) => {
  const password = "Str0ng!Pass2026";
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: "doctor",
      gender: "male",
      status: userStatus,
      doctorProfile: {
        create: {
          clinicId,
          verificationStatus,
          practitionerLicense: `LIC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          specialization: "Dermatology",
        },
      },
    },
    include: { doctorProfile: true },
  });

  createdUserIds.push(user.id);
  return { ...user, password };
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

test("admin approve doctor activates user, verifies profile, and login/profile return latest status", async () => {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const clinic = await createClinic(`Admin Approve Doctor Clinic ${stamp}`);
  const doctor = await createDoctor({
    clinicId: clinic.clinicId,
    email: `doctor.pending.${stamp}@example.com`,
    name: `Pending Doctor ${stamp}`,
    userStatus: "pending",
    verificationStatus: "pending",
  });

  await assert.rejects(
    loginUser(doctor.email, doctor.password),
    /Akun dokter Anda masih menunggu verifikasi admin/
  );

  const approval = await adminService.approveDoctorRequest(doctor.doctorProfile.id, "Approved by test");
  assert.equal(approval.data.userStatus, "active");
  assert.equal(approval.data.status, "verified");
  assert.equal(approval.data.verificationStatus, "verified");
  assert.equal(approval.data.practitionerStatus.status, "verified");

  const storedDoctor = await prisma.doctorProfile.findUnique({
    where: { id: doctor.doctorProfile.id },
    include: { user: true },
  });
  assert.equal(storedDoctor.verificationStatus, "verified");
  assert.equal(storedDoctor.user.status, "active");

  const login = await loginUser(doctor.email, doctor.password);
  assert.equal(login.role, "doctor");
  assert.equal(login.verificationStatus, "verified");
  assert.equal(login.doctorProfile.status, "verified");
  assert.equal(login.doctorProfile.verificationStatus, "verified");
  assert.equal(login.doctorProfile.practitionerStatus.status, "verified");
  assert.equal(login.user.doctorProfile.status, "verified");
  assert.equal(typeof login.token, "string");
  assert.equal(login.accessToken, login.token);

  const profile = await doctorService.getDoctorProfile(doctor.id);
  assert.equal(profile.id, doctor.doctorProfile.id);
  assert.equal(profile.status, "verified");
  assert.equal(profile.verificationStatus, "verified");
  assert.equal(profile.practitionerStatus.status, "verified");
});

test("admin reject doctor deactivates user, rejects profile, and login is denied", async () => {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const clinic = await createClinic(`Admin Reject Doctor Clinic ${stamp}`);
  const doctor = await createDoctor({
    clinicId: clinic.clinicId,
    email: `doctor.reject.${stamp}@example.com`,
    name: `Reject Doctor ${stamp}`,
    userStatus: "pending",
    verificationStatus: "pending",
  });

  const rejection = await adminService.rejectDoctorRequest(doctor.doctorProfile.id, "Rejected by test");
  assert.equal(rejection.data.userStatus, "inactive");
  assert.equal(rejection.data.status, "rejected");
  assert.equal(rejection.data.verificationStatus, "rejected");
  assert.equal(rejection.data.practitionerStatus.status, "rejected");

  const storedDoctor = await prisma.doctorProfile.findUnique({
    where: { id: doctor.doctorProfile.id },
    include: { user: true },
  });
  assert.equal(storedDoctor.verificationStatus, "rejected");
  assert.equal(storedDoctor.user.status, "inactive");

  await assert.rejects(
    loginUser(doctor.email, doctor.password),
    /Akun dokter Anda ditolak/
  );
});
