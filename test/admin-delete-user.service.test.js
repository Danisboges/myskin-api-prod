const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");

const created = {
  userIds: [],
  scanIds: [],
  consultationIds: [],
  caseReviewIds: [],
  reportIds: [],
  verificationRequestIds: [],
};

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createUser = async (role, name) => {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name,
      email: `${role}.delete.${token}@example.com`,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role,
      gender: role === "doctor" ? "female" : "male",
      status: "active",
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
          create: {},
        },
      }),
    },
    include: {
      doctorProfile: true,
      patientProfile: true,
    },
  });

  created.userIds.push(user.id);
  return user;
};

test.after(async () => {
  await prisma.chatMessageReadReceipt.deleteMany({
    where: { message: { consultationId: { in: created.consultationIds } } },
  });
  await prisma.chatMessageAttachment.deleteMany({
    where: { message: { consultationId: { in: created.consultationIds } } },
  });
  await prisma.chatMessage.deleteMany({
    where: { consultationId: { in: created.consultationIds } },
  });
  await prisma.prescription.deleteMany({
    where: { consultationId: { in: created.consultationIds } },
  });
  await prisma.consultation.deleteMany({
    where: { id: { in: created.consultationIds } },
  });
  await prisma.doctorObservation.deleteMany({
    where: { caseReviewId: { in: created.caseReviewIds } },
  });
  await prisma.report.deleteMany({
    where: { id: { in: created.reportIds } },
  });
  await prisma.verificationRequest.deleteMany({
    where: { id: { in: created.verificationRequestIds } },
  });
  await prisma.caseReview.deleteMany({
    where: { id: { in: created.caseReviewIds } },
  });
  await prisma.scan.deleteMany({
    where: { id: { in: created.scanIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: created.userIds } },
  });

  await prisma.$disconnect();
});

test("deleteUser hard deletes doctor with consultation and doctor-profile relations", async () => {
  const doctor = await createUser("doctor", `Doctor Delete ${stamp()}`);
  const patient = await createUser("patient", `Patient Delete ${stamp()}`);

  const scan = await prisma.scan.create({
    data: {
      patientId: patient.patientProfile.id,
      imageUrl: "/uploads/delete-test.jpg",
      complaint: "Delete test complaint",
      isAnalyzed: true,
      aiPrediction: "Benign",
      aiConfidence: 0.8,
    },
  });
  created.scanIds.push(scan.id);

  const consultation = await prisma.consultation.create({
    data: {
      scanId: scan.id,
      patientId: patient.id,
      doctorId: doctor.id,
      status: "OPEN",
    },
  });
  created.consultationIds.push(consultation.id);

  const message = await prisma.chatMessage.create({
    data: {
      consultationId: consultation.id,
      senderId: doctor.id,
      message: "Doctor message before delete",
    },
  });

  await prisma.chatMessageAttachment.create({
    data: {
      messageId: message.id,
      url: "/uploads/delete-attachment.jpg",
      fileName: "delete-attachment.jpg",
      mimeType: "image/jpeg",
      size: 123,
    },
  });
  await prisma.chatMessageReadReceipt.create({
    data: {
      messageId: message.id,
      userId: doctor.id,
    },
  });
  await prisma.prescription.create({
    data: {
      consultationId: consultation.id,
      doctorId: doctor.id,
      patientId: patient.id,
      medicationName: "Delete Test Medication",
    },
  });

  const caseReview = await prisma.caseReview.create({
    data: {
      scanId: scan.id,
      doctorId: doctor.doctorProfile.id,
      physicianObservation: "Observation before delete",
    },
  });
  created.caseReviewIds.push(caseReview.id);

  await prisma.doctorObservation.create({
    data: {
      caseReviewId: caseReview.id,
      doctorId: doctor.doctorProfile.id,
      observation: "Doctor observation before delete",
    },
  });
  await prisma.notification.create({
    data: {
      doctorId: doctor.doctorProfile.id,
      title: "Delete test notification",
      message: "Notification before delete",
    },
  });
  await prisma.caseAssignment.create({
    data: {
      doctorId: doctor.doctorProfile.id,
      caseId: caseReview.caseId,
    },
  });
  const report = await prisma.report.create({
    data: {
      scanId: scan.id,
      patientId: patient.patientProfile.id,
      title: "Delete test report",
      diagnosis: "Benign",
      approvedByDoctorId: doctor.id,
      approvedAt: new Date(),
    },
  });
  created.reportIds.push(report.id);

  const verificationRequest = await prisma.verificationRequest.create({
    data: {
      patientId: patient.patientProfile.id,
      assignedDoctorId: doctor.doctorProfile.id,
      assignedDoctorName: doctor.name,
    },
  });
  created.verificationRequestIds.push(verificationRequest.id);

  const result = await adminService.deleteUser(doctor.id);

  assert.deepEqual(result, { message: "User deleted successfully" });
  assert.equal(await prisma.user.findUnique({ where: { id: doctor.id } }), null);
  assert.equal(await prisma.doctorProfile.findUnique({ where: { userId: doctor.id } }), null);
  assert.equal(await prisma.consultation.count({ where: { id: consultation.id } }), 0);
  assert.equal(await prisma.chatMessage.count({ where: { consultationId: consultation.id } }), 0);
  assert.equal(await prisma.prescription.count({ where: { consultationId: consultation.id } }), 0);
  assert.equal(await prisma.doctorObservation.count({ where: { doctorId: doctor.doctorProfile.id } }), 0);
  assert.equal(await prisma.notification.count({ where: { doctorId: doctor.doctorProfile.id } }), 0);
  assert.equal(await prisma.doctorSettings.count({ where: { doctorId: doctor.doctorProfile.id } }), 0);
  assert.equal(await prisma.caseAssignment.count({ where: { doctorId: doctor.doctorProfile.id } }), 0);

  const updatedCaseReview = await prisma.caseReview.findUnique({ where: { id: caseReview.id } });
  assert.equal(updatedCaseReview.doctorId, null);

  const updatedReport = await prisma.report.findUnique({ where: { id: report.id } });
  assert.equal(updatedReport.approvedByDoctorId, null);
  assert.equal(updatedReport.approvedAt, null);

  const updatedVerificationRequest = await prisma.verificationRequest.findUnique({
    where: { id: verificationRequest.id },
  });
  assert.equal(updatedVerificationRequest.assignedDoctorId, null);
  assert.equal(updatedVerificationRequest.assignedDoctorName, null);
});

test("deleteUser returns a 404-friendly error for missing user", async () => {
  await assert.rejects(
    adminService.deleteUser("missing-user-id"),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.message, "User not found");
      return true;
    }
  );
});
