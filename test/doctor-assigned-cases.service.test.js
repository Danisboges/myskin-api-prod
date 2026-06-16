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

const createVerificationRequestForScan = async ({
  doctor,
  patient,
  scan,
  suffix = '',
  status = 'pending',
  submittedAt = new Date(),
}) => {
  const request = await prisma.verificationRequest.create({
    data: {
      requestId: `VER-${Date.now()}-${Math.random().toString(36).slice(2, 5)}${suffix}`,
      patientId: patient.patientProfile.id,
      scanId: scan.id,
      assignedDoctorId: doctor.doctorProfile.id,
      assignedDoctorName: doctor.name,
      message: `Please review ${scan.scanId}.`,
      status,
      submittedAt,
    },
  });

  return request;
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

test("getAssignedCases uses verification request scan and returns newest request first", async () => {
  const doctor = await createDoctor();
  const patient = await createPatientWithScan();
  const scanA = patient.patientProfile.scans[0];
  await prisma.scan.update({
    where: { id: scanA.id },
    data: {
      imageUrl: "/uploads/scan-a.jpg",
      bodySite: "arm",
      complaint: "Older lesion on arm",
    },
  });

  const now = Date.now();
  const requestA = await createVerificationRequestForScan({
    doctor,
    patient,
    scan: scanA,
    suffix: '-a',
    submittedAt: new Date(now),
  });
  const scanB = await prisma.scan.create({
    data: {
      patientId: patient.patientProfile.id,
      imageUrl: "/uploads/scan-b-new.jpg",
      complaint: "Newest lesion on back",
      bodySite: "back",
      uploadedAt: new Date(Date.now() + 1000),
    },
  });
  const requestB = await createVerificationRequestForScan({
    doctor,
    patient,
    scan: scanB,
    suffix: '-b',
    submittedAt: new Date(now + 2000),
  });

  const cases = await getAssignedCases(doctor.id);
  const verificationCases = cases.filter((item) => (
    item.type === "verification_request" &&
    [requestA.requestId, requestB.requestId].includes(item.requestId)
  ));

  assert.equal(verificationCases.length, 2);
  assert.equal(verificationCases[0].requestId, requestB.requestId);
  assert.equal(verificationCases[0].patientScanId, scanB.id);
  assert.equal(verificationCases[0].scanId, scanB.scanId);
  assert.equal(verificationCases[0].caseId, scanB.scanId);
  assert.equal(verificationCases[0].scanImageUrl, "/uploads/scan-b-new.jpg");
  assert.equal(verificationCases[0].imageUrl, "/uploads/scan-b-new.jpg");
  assert.equal(verificationCases[0].bodySite, "back");
  assert.equal(verificationCases[0].complaint, "Newest lesion on back");
  assert.equal(verificationCases[0].status, "pending");

  assert.equal(verificationCases[1].requestId, requestA.requestId);
  assert.equal(verificationCases[1].patientScanId, scanA.id);
  assert.equal(verificationCases[1].scanId, scanA.scanId);
  assert.equal(verificationCases[1].scanImageUrl, "/uploads/scan-a.jpg");
});

test("getAssignedCases includes only active verification request statuses", async () => {
  const doctor = await createDoctor();
  const patient = await createPatientWithScan();
  const scan = patient.patientProfile.scans[0];
  const pendingRequest = await createVerificationRequestForScan({
    doctor,
    patient,
    scan,
    suffix: "-pending",
    status: "pending",
  });
  const pendingReviewRequest = await createVerificationRequestForScan({
    doctor,
    patient,
    scan,
    suffix: "-pending-review",
    status: "pending_review",
  });
  const underReviewRequest = await createVerificationRequestForScan({
    doctor,
    patient,
    scan,
    suffix: "-under-review",
    status: "under_review",
  });
  const submittedRequest = await createVerificationRequestForScan({
    doctor,
    patient,
    scan,
    suffix: "-submitted",
    status: "submitted",
  });
  const approvedRequest = await createVerificationRequestForScan({
    doctor,
    patient,
    scan,
    suffix: "-approved",
    status: "approved",
  });
  const rejectedRequest = await createVerificationRequestForScan({
    doctor,
    patient,
    scan,
    suffix: "-rejected",
    status: "rejected",
  });
  const completedRequest = await createVerificationRequestForScan({
    doctor,
    patient,
    scan,
    suffix: "-completed",
    status: "completed",
  });
  const resolvedRequest = await createVerificationRequestForScan({
    doctor,
    patient,
    scan,
    suffix: "-resolved",
    status: "resolved",
  });

  const cases = await getAssignedCases(doctor.id);
  const requestIds = cases.map((item) => item.requestId).filter(Boolean);

  assert.ok(requestIds.includes(pendingRequest.requestId));
  assert.ok(requestIds.includes(pendingReviewRequest.requestId));
  assert.ok(requestIds.includes(underReviewRequest.requestId));
  assert.ok(!requestIds.includes(submittedRequest.requestId));
  assert.ok(!requestIds.includes(approvedRequest.requestId));
  assert.ok(!requestIds.includes(rejectedRequest.requestId));
  assert.ok(!requestIds.includes(completedRequest.requestId));
  assert.ok(!requestIds.includes(resolvedRequest.requestId));
});

test("getAssignedCases removes verification request after approve or reject", async () => {
  const approveTarget = await createVerificationTarget();
  const rejectTarget = await createVerificationTarget();

  const beforeApprove = await getAssignedCases(approveTarget.doctor.id);
  assert.ok(beforeApprove.some((item) => item.requestId === approveTarget.request.requestId));

  await approveCase(
    approveTarget.scan.scanId,
    approveTarget.doctor.id,
    "Approved from assigned cases.",
    "Benign"
  );

  const afterApprove = await getAssignedCases(approveTarget.doctor.id);
  assert.ok(!afterApprove.some((item) => item.requestId === approveTarget.request.requestId));

  const beforeReject = await getAssignedCases(rejectTarget.doctor.id);
  assert.ok(beforeReject.some((item) => item.requestId === rejectTarget.request.requestId));

  await rejectCase(
    rejectTarget.scan.scanId,
    rejectTarget.doctor.id,
    "False positive prediction",
    "Rejected from assigned cases.",
    "Rejected"
  );

  const afterReject = await getAssignedCases(rejectTarget.doctor.id);
  assert.ok(!afterReject.some((item) => item.requestId === rejectTarget.request.requestId));
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

  const result = await approveCase(scan.scanId, doctor.id, "  Looks clinically malignant.  ", "  Malignant  ");

  assert.equal(result.caseId, scan.scanId);
  assert.equal(result.scanId, scan.scanId);
  assert.equal(result.requestId, request.requestId);

  const updatedRequest = await prisma.verificationRequest.findUnique({
    where: { id: request.id },
  });
  assert.equal(updatedRequest.status, "approved");

  const caseReview = await prisma.caseReview.findUnique({
    where: { caseId: scan.scanId },
  });
  assert.equal(caseReview.physicianObservation, "Looks clinically malignant.");
  assert.equal(caseReview.finalDiagnosis, "Malignant");
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
    "  False positive prediction  ",
    "  No malignant features seen.  ",
    "  Rejected  "
  );

  assert.equal(result.caseId, scan.scanId);
  assert.equal(result.scanId, scan.scanId);
  assert.equal(result.requestId, request.requestId);

  const updatedRequest = await prisma.verificationRequest.findUnique({
    where: { id: request.id },
  });
  assert.equal(updatedRequest.status, "rejected");

  const caseReview = await prisma.caseReview.findUnique({
    where: { caseId: scan.scanId },
  });
  assert.equal(caseReview.rejectionReason, "False positive prediction");
  assert.equal(caseReview.physicianObservation, "No malignant features seen.");
  assert.equal(caseReview.finalDiagnosis, "Rejected");
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

test("approveCase fails only when physicianObservation is empty", async () => {
  const { doctor, scan } = await createVerificationTarget();

  await assert.rejects(
    approveCase(scan.scanId, doctor.id, "   ", "Approved"),
    /Physician observation is required/
  );
});

test("rejectCase fails only when physicianObservation is empty", async () => {
  const { doctor, scan } = await createVerificationTarget();

  await assert.rejects(
    rejectCase(scan.scanId, doctor.id, "False positive prediction", "   ", "Rejected"),
    /Physician observation is required/
  );
});

test("approveCase accepts database UUID identifiers", async () => {
  const scanTarget = await createVerificationTarget();
  const requestTarget = await createVerificationTarget();
  const reviewTarget = await createVerificationTarget();

  const scanResult = await approveCase(
    scanTarget.scan.id,
    scanTarget.doctor.id,
    "Approved using scan UUID.",
    "Benign"
  );
  assert.equal(scanResult.scanId, scanTarget.scan.scanId);
  assert.equal(scanResult.requestId, scanTarget.request.requestId);

  const requestResult = await approveCase(
    requestTarget.request.id,
    requestTarget.doctor.id,
    "Approved using request UUID.",
    "Benign"
  );
  assert.equal(requestResult.scanId, requestTarget.scan.scanId);
  assert.equal(requestResult.requestId, requestTarget.request.requestId);

  const review = await prisma.caseReview.create({
    data: {
      caseId: `CASE-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      scanId: reviewTarget.scan.id,
      doctorId: reviewTarget.doctor.doctorProfile.id,
      reviewStatus: "pending_review",
    },
  });

  const reviewResult = await approveCase(
    review.id,
    reviewTarget.doctor.id,
    "Approved using case review UUID.",
    "Benign"
  );
  assert.equal(reviewResult.caseId, review.caseId);
  assert.equal(reviewResult.scanId, reviewTarget.scan.scanId);
});

test("rejectCase accepts database UUID identifiers", async () => {
  const scanTarget = await createVerificationTarget();
  const requestTarget = await createVerificationTarget();

  const scanResult = await rejectCase(
    scanTarget.scan.id,
    scanTarget.doctor.id,
    "False positive prediction",
    "Rejected using scan UUID.",
    "Benign"
  );
  assert.equal(scanResult.scanId, scanTarget.scan.scanId);
  assert.equal(scanResult.requestId, scanTarget.request.requestId);

  const requestResult = await rejectCase(
    requestTarget.request.id,
    requestTarget.doctor.id,
    "False positive prediction",
    "Rejected using request UUID.",
    "Benign"
  );
  assert.equal(requestResult.scanId, requestTarget.scan.scanId);
  assert.equal(requestResult.requestId, requestTarget.request.requestId);
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
