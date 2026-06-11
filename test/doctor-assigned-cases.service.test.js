const test = require("node:test");
const assert = require("node:assert/strict");

const prisma = require("../src/config/prisma");
const {
  approveCase,
  getAssignedCases,
  getCaseDetail,
  rejectCase,
  saveCaseAnnotation,
  saveObservation,
} = require("../src/services/doctor.service");
const fs = require("fs");
const path = require("path");

const created = {
  userIds: [],
  patientIds: [],
  annotationPaths: [],
};

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createDoctor = async () => {
  const token = stamp();
  const doctor = await prisma.user.create({
    data: {
      name: `Assigned Doctor ${token}`,
      email: `assigned.doctor.${token}@example.com`,
      password: "hashed-password",
      role: "doctor",
      gender: "female",
      status: "active",
      doctorProfile: {
        create: {
          verificationStatus: "verified",
          practitionerLicense: `LIC-${token}`,
          specialization: "Dermatology",
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  created.userIds.push(doctor.id);
  return doctor;
};

const createPatientWithScan = async () => {
  const token = stamp();
  const patient = await prisma.user.create({
    data: {
      name: `Assigned Patient ${token}`,
      email: `assigned.patient.${token}@example.com`,
      password: "hashed-password",
      role: "patient",
      gender: "male",
      status: "active",
      patientProfile: {
        create: {
          scans: {
            create: {
              imageUrl: "/uploads/test-assigned-verification.jpg",
              complaint: "Changing lesion near neck",
              bodySite: "neck",
            },
          },
        },
      },
    },
    include: {
      patientProfile: {
        include: {
          scans: true,
        },
      },
    },
  });

  created.userIds.push(patient.id);
  created.patientIds.push(patient.patientProfile.id);
  return patient;
};

const createVerificationTarget = async () => {
  const doctor = await createDoctor();
  const patient = await createPatientWithScan();
  const scan = patient.patientProfile.scans[0];
  const request = await prisma.verificationRequest.create({
    data: {
      requestId: `VER-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      patientId: patient.patientProfile.id,
      scanId: scan.scanId,
      assignedDoctorId: doctor.doctorProfile.id,
      assignedDoctorName: doctor.name,
      message: "Please review this scan.",
      status: "pending",
    },
  });

  return { doctor, patient, scan, request };
};

test.after(async () => {
  if (created.patientIds.length > 0) {
    await prisma.verificationRequest.deleteMany({
      where: { patientId: { in: created.patientIds } },
    });
  }

  if (created.userIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: created.userIds } },
    });
  }

  for (const annotationPath of created.annotationPaths) {
    if (fs.existsSync(annotationPath)) {
      fs.unlinkSync(annotationPath);
    }
  }

  await prisma.$disconnect();
});

test("getAssignedCases returns pending verification requests assigned to logged-in doctor profile", async () => {
  const { doctor, patient, scan, request } = await createVerificationTarget();

  const cases = await getAssignedCases(doctor.id);
  const assignedRequest = cases.find((item) => item.requestId === request.requestId);

  assert.ok(assignedRequest);
  assert.equal(assignedRequest.id, request.id);
  assert.equal(assignedRequest.requestId, request.requestId);
  assert.equal(assignedRequest.caseId, scan.scanId);
  assert.equal(assignedRequest.scanId, scan.scanId);
  assert.equal(assignedRequest.detailCaseId, scan.scanId);
  assert.equal(assignedRequest.actionCaseId, scan.scanId);
  assert.equal(assignedRequest.patientName, patient.name);
  assert.equal(assignedRequest.status, "pending");
  assert.equal(assignedRequest.type, "verification_request");
  assert.equal(typeof assignedRequest.createdAt, "string");
  assert.equal(typeof assignedRequest.receivedAt, "string");
});

test("getCaseDetail resolves verification request detail by scanId and requestId", async () => {
  const { patient, scan, request } = await createVerificationTarget();

  const detailByScan = await getCaseDetail(scan.scanId);
  assert.equal(detailByScan.caseId, scan.scanId);
  assert.equal(detailByScan.requestId, request.requestId);
  assert.equal(detailByScan.scanId, scan.scanId);
  assert.equal(detailByScan.patient.name, patient.name);
  assert.equal(detailByScan.status, "pending");

  const detailByRequest = await getCaseDetail(request.requestId);
  assert.equal(detailByRequest.caseId, scan.scanId);
  assert.equal(detailByRequest.requestId, request.requestId);
  assert.equal(detailByRequest.scanId, scan.scanId);
});

test("approveCase accepts scanId and updates verification request", async () => {
  const { doctor, scan, request } = await createVerificationTarget();

  const result = await approveCase(scan.scanId, doctor.id, "Looks clinically malignant.", "Malignant");

  assert.equal(result.caseId, scan.scanId);
  assert.equal(result.scanId, scan.scanId);
  assert.equal(result.requestId, request.requestId);

  const updatedRequest = await prisma.verificationRequest.findUnique({
    where: { id: request.id },
  });
  assert.equal(updatedRequest.status, "approved");
});

test("approveCase accepts verification requestId", async () => {
  const { doctor, scan, request } = await createVerificationTarget();

  const result = await approveCase(request.requestId, doctor.id, "Diagnosis approved.", "Malignant");

  assert.equal(result.caseId, scan.scanId);
  assert.equal(result.scanId, scan.scanId);
  assert.equal(result.requestId, request.requestId);
});

test("rejectCase accepts scanId and updates verification request", async () => {
  const { doctor, scan, request } = await createVerificationTarget();

  const result = await rejectCase(
    scan.scanId,
    doctor.id,
    "False positive prediction",
    "No malignant features seen.",
    "Rejected"
  );

  assert.equal(result.caseId, scan.scanId);
  assert.equal(result.scanId, scan.scanId);
  assert.equal(result.requestId, request.requestId);

  const updatedRequest = await prisma.verificationRequest.findUnique({
    where: { id: request.id },
  });
  assert.equal(updatedRequest.status, "rejected");
});

test("rejectCase accepts verification requestId", async () => {
  const { doctor, scan, request } = await createVerificationTarget();

  const result = await rejectCase(
    request.requestId,
    doctor.id,
    "False positive prediction",
    "No malignant features seen.",
    "Rejected"
  );

  assert.equal(result.caseId, scan.scanId);
  assert.equal(result.scanId, scan.scanId);
  assert.equal(result.requestId, request.requestId);
});

test("observation accepts scanId and verification requestId", async () => {
  const scanTarget = await createVerificationTarget();
  const requestTarget = await createVerificationTarget();

  await saveObservation(scanTarget.scan.scanId, scanTarget.doctor.id, "Observation via scan id.");
  await saveObservation(requestTarget.request.requestId, requestTarget.doctor.id, "Observation via request id.");

  assert.equal(await prisma.doctorObservation.count({
    where: { doctorId: scanTarget.doctor.doctorProfile.id },
  }), 1);
  assert.equal(await prisma.doctorObservation.count({
    where: { doctorId: requestTarget.doctor.doctorProfile.id },
  }), 1);
});

test("annotation accepts scanId and verification requestId", async () => {
  const scanTarget = await createVerificationTarget();
  const requestTarget = await createVerificationTarget();

  const fileData = {
    originalname: "annotation.png",
    buffer: Buffer.from([137, 80, 78, 71]),
  };

  const scanResult = await saveCaseAnnotation(scanTarget.scan.scanId, fileData);
  const requestResult = await saveCaseAnnotation(requestTarget.request.requestId, fileData);

  for (const result of [scanResult, requestResult]) {
    assert.equal(result.success, true);
    assert.match(result.annotatedImageUrl, /^\/uploads\/annotations\/annotation_/);
    created.annotationPaths.push(path.join(__dirname, "..", result.annotatedImageUrl.replace(/^\//, "")));
  }
});
