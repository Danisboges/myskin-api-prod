const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.ADMIN_NOTIFICATION_TEST_DISABLE = "true";
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = "false";

const app = require("../server");
const prisma = require("../src/config/prisma");

const created = {
  userIds: [],
  patientIds: [],
  requestIds: [],
  scanIds: [],
};

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const requestJson = async ({ method, path, token, body }) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request({
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    }, (res) => {
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
    req.end(payload);
  });
});

const createPatient = async () => {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name: `Verification Patient ${token}`,
      email: `verification.patient.${token}@example.com`,
      password: "hashed-password",
      role: "patient",
      gender: "female",
      status: "active",
      patientProfile: {
        create: {},
      },
    },
    include: {
      patientProfile: true,
    },
  });

  created.userIds.push(user.id);
  created.patientIds.push(user.patientProfile.id);

  const authToken = jwt.sign(
    { id: user.id, email: user.email, role: "patient", name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { user, token: authToken };
};

const createDoctor = async ({ status = "active", verificationStatus = "verified" } = {}) => {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name: `Verification Doctor ${verificationStatus} ${token}`,
      email: `verification.doctor.${verificationStatus}.${token}@example.com`,
      password: "hashed-password",
      role: "doctor",
      gender: "male",
      status,
      doctorProfile: {
        create: {
          verificationStatus,
          practitionerLicense: `LIC-${token}`,
          specialization: "Dermatology",
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  created.userIds.push(user.id);
  return user;
};

test.after(async () => {
  if (created.patientIds.length > 0) {
    await prisma.patientNotification.deleteMany({
      where: { patientId: { in: created.patientIds } },
    });
    await prisma.verificationRequest.deleteMany({
      where: { patientId: { in: created.patientIds } },
    });
    await prisma.scan.deleteMany({
      where: { id: { in: created.scanIds } },
    });
  }

  if (created.userIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: created.userIds } },
    });
  }

  await prisma.$disconnect();
});

test("GET /api/v1/patient/doctors/available returns only active verified or approved doctors", async () => {
  const { token } = await createPatient();
  const verifiedDoctor = await createDoctor({ verificationStatus: "verified" });
  const approvedDoctor = await createDoctor({ verificationStatus: "approved" });
  const pendingDoctor = await createDoctor({ verificationStatus: "pending" });
  const rejectedDoctor = await createDoctor({ verificationStatus: "rejected" });
  const inactiveVerifiedDoctor = await createDoctor({ status: "inactive", verificationStatus: "verified" });

  const res = await requestJson({
    method: "GET",
    path: "/api/v1/patient/doctors/available",
    token,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "success");

  const returnedIds = res.body.data.map((doctor) => doctor.id);
  assert.ok(returnedIds.includes(verifiedDoctor.id));
  assert.ok(returnedIds.includes(approvedDoctor.id));
  assert.equal(returnedIds.includes(pendingDoctor.id), false);
  assert.equal(returnedIds.includes(rejectedDoctor.id), false);
  assert.equal(returnedIds.includes(inactiveVerifiedDoctor.id), false);
});

test("POST /api/v1/patient/verification-requests creates a pending request", async () => {
  const { user, token } = await createPatient();

  const res = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: { message: "Please verify my case with a dermatologist." },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.status, "success");
  assert.match(res.body.data.requestId, /^VER-/);
  assert.equal(res.body.data.status, "pending");
  assert.equal(res.body.data.message, "Verification request submitted successfully");

  const request = await prisma.verificationRequest.findUnique({
    where: { requestId: res.body.data.requestId },
  });
  created.requestIds.push(request.id);

  assert.equal(request.patientId, user.patientProfile.id);
  assert.equal(request.message, "Please verify my case with a dermatologist.");

  const notification = await prisma.patientNotification.findFirst({
    where: {
      patientId: user.patientProfile.id,
      type: "verification_alert",
    },
  });
  assert.ok(notification);
});

test("POST /api/v1/patient/verification-requests accepts initialMessage, doctorId, and scanId", async () => {
  const { user, token } = await createPatient();
  const doctor = await createDoctor({ verificationStatus: "verified" });
  const scan = await prisma.scan.create({
    data: {
      patientId: user.patientProfile.id,
      imageUrl: "/uploads/test-verification-scan.jpg",
      complaint: "Suspicious mole on shoulder",
      bodySite: "shoulder",
    },
  });
  created.scanIds.push(scan.id);

  const res = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: {
      scanId: scan.scanId,
      doctorId: doctor.id,
      initialMessage: "Please review this scan with a doctor.",
    },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.doctorId, doctor.id);
  assert.equal(res.body.data.doctorProfileId, doctor.doctorProfile.id);
  assert.equal(res.body.data.scanId, scan.scanId);

  const request = await prisma.verificationRequest.findUnique({
    where: { requestId: res.body.data.requestId },
  });
  created.requestIds.push(request.id);

  assert.equal(request.message, "Please review this scan with a doctor.");
  assert.equal(request.scanId, scan.id);
  assert.equal(request.assignedDoctorId, doctor.doctorProfile.id);
  assert.equal(request.assignedDoctorName, doctor.name);
});

test("POST /api/v1/patient/verification-requests accepts patientScanId UUID and doctorUserId payload", async () => {
  const { user, token } = await createPatient();
  const doctor = await createDoctor({ verificationStatus: "verified" });
  const scan = await prisma.scan.create({
    data: {
      patientId: user.patientProfile.id,
      imageUrl: "/uploads/test-verification-new-upload.jpg",
      complaint: "Newest uploaded lesion",
      bodySite: "back",
    },
  });
  created.scanIds.push(scan.id);

  const res = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: {
      doctorUserId: doctor.id,
      doctorId: doctor.doctorProfile.id,
      scanId: scan.id,
      patientScanId: scan.id,
      source: "verification_request",
      createConsultation: false,
      triggerChatbot: false,
      autoStartChatbot: false,
    },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.doctorId, doctor.id);
  assert.equal(res.body.data.doctorProfileId, doctor.doctorProfile.id);
  assert.equal(res.body.data.scanId, scan.scanId);
  assert.equal(res.body.data.patientScanId, scan.id);

  const request = await prisma.verificationRequest.findUnique({
    where: { requestId: res.body.data.requestId },
  });
  created.requestIds.push(request.id);

  assert.equal(request.scanId, scan.id);
  assert.equal(request.assignedDoctorId, doctor.doctorProfile.id);
  assert.equal(request.message, "Please review this scan with a doctor.");

  const consultationCount = await prisma.consultation.count({
    where: { scanId: scan.id },
  });
  const chatMessageCount = await prisma.chatMessage.count({
    where: {
      consultation: {
        scanId: scan.id,
      },
    },
  });

  assert.equal(consultationCount, 0);
  assert.equal(chatMessageCount, 0);
});

test("POST /api/v1/patient/verification-requests creates a new request for a new scan despite existing pending request", async () => {
  const { user, token } = await createPatient();
  const doctor = await createDoctor({ verificationStatus: "verified" });
  const scanA = await prisma.scan.create({
    data: {
      patientId: user.patientProfile.id,
      imageUrl: "/uploads/test-verification-a.jpg",
      complaint: "Scan A",
      bodySite: "arm",
    },
  });
  const scanB = await prisma.scan.create({
    data: {
      patientId: user.patientProfile.id,
      imageUrl: "/uploads/test-verification-b.jpg",
      complaint: "Scan B",
      bodySite: "neck",
    },
  });
  created.scanIds.push(scanA.id, scanB.id);

  const first = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: {
      doctorId: doctor.id,
      patientScanId: scanA.id,
      message: "Please review scan A.",
    },
  });
  assert.equal(first.statusCode, 201);

  const second = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: {
      doctorId: doctor.id,
      patientScanId: scanB.id,
      message: "Please review scan B.",
    },
  });
  assert.equal(second.statusCode, 201);
  assert.notEqual(second.body.data.requestId, first.body.data.requestId);
  assert.equal(second.body.data.patientScanId, scanB.id);

  const requests = await prisma.verificationRequest.findMany({
    where: {
      requestId: { in: [first.body.data.requestId, second.body.data.requestId] },
    },
    orderBy: { submittedAt: "asc" },
  });
  created.requestIds.push(...requests.map((request) => request.id));

  assert.equal(requests.length, 2);
  assert.equal(requests[0].scanId, scanA.id);
  assert.equal(requests[1].scanId, scanB.id);
});

test("POST /api/v1/patient/verification-requests rejects unavailable doctorId", async () => {
  const { user, token } = await createPatient();
  const pendingDoctor = await createDoctor({ verificationStatus: "pending" });
  const scan = await prisma.scan.create({
    data: {
      patientId: user.patientProfile.id,
      imageUrl: "/uploads/test-verification-unavailable.jpg",
      complaint: "Changing mole on arm",
      bodySite: "arm",
    },
  });
  created.scanIds.push(scan.id);

  const res = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: {
      scanId: scan.scanId,
      doctorId: pendingDoctor.id,
      message: "Please review this scan.",
    },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    status: "error",
    message: "Selected doctor is not available",
  });
});

test("POST /api/v1/patient/verification-requests rejects short messages", async () => {
  const { token } = await createPatient();

  const res = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: { message: "bad" },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    status: "error",
    message: "Message must be at least 5 characters",
  });
});

test("POST /api/v1/patient/verification-requests rejects duplicate pending requests", async () => {
  const { token } = await createPatient();

  const first = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: { message: "First verification request message." },
  });
  assert.equal(first.statusCode, 201);

  const second = await requestJson({
    method: "POST",
    path: "/api/v1/patient/verification-requests",
    token,
    body: { message: "Second verification request message." },
  });

  assert.equal(second.statusCode, 400);
  assert.deepEqual(second.body, {
    status: "error",
    message: "You already have a pending verification request",
  });
});
