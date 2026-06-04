const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const FormData = require('form-data');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = 'false';
process.env.ADMIN_NOTIFICATION_TEST_DISABLE = 'true';

const prisma = require('../src/config/prisma');
const consultationRoutes = require('../src/routes/consultation.route');

const created = {
  userIds: [],
  scanIds: [],
  consultationIds: [],
  attachmentPaths: [],
  deletedConsultationIds: [],
};

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/v1/doctor/consultations', consultationRoutes);
  app.use('/api/v1/patient/consultations', consultationRoutes);
  return app;
};

const createToken = (user) => jwt.sign(
  { id: user.id, name: user.name, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const request = async (app, { method, urlPath, token, body, form }) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = {
      ...(payload && {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }),
      ...(form && form.getHeaders()),
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const req = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path: urlPath,
      method,
      headers,
    }, (res) => {
      let rawBody = '';
      res.on('data', (chunk) => {
        rawBody += chunk;
      });
      res.on('end', () => {
        server.close(() => {
          resolve({
            statusCode: res.statusCode,
            body: rawBody ? JSON.parse(rawBody) : null,
          });
        });
      });
    });

    req.on('error', (error) => {
      server.close(() => reject(error));
    });

    if (form) {
      form.pipe(req);
      return;
    }

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
});

async function createUser(role, name) {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name,
      email: `${role}.doctor-chat.${token}@example.com`,
      password: await bcrypt.hash('Str0ng!Pass2026', 10),
      role,
      gender: role === 'doctor' ? 'female' : 'male',
      status: 'active',
      ...(role === 'doctor' && {
        doctorProfile: {
          create: {
            verificationStatus: 'verified',
            practitionerLicense: `LIC-${token}`,
            specialization: 'Dermatology',
          },
        },
      }),
      ...(role === 'patient' && {
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
}

async function createConsultationFixture() {
  const patient = await createUser('patient', `Patient ${stamp()}`);
  const doctor = await createUser('doctor', `Doctor ${stamp()}`);
  const otherDoctor = await createUser('doctor', `Other Doctor ${stamp()}`);

  const scan = await prisma.scan.create({
    data: {
      patientId: patient.patientProfile.id,
      imageUrl: '/uploads/test-lesion.jpg',
      complaint: 'Changing lesion on left arm',
      bodySite: 'arms',
      isAnalyzed: true,
      aiPrediction: 'Benign',
      aiConfidence: 0.85,
      aiDetails: 'ABCDE criteria within benign range',
      analyzeCompletedAt: new Date(),
    },
  });
  created.scanIds.push(scan.id);

  const consultation = await prisma.consultation.create({
    data: {
      scanId: scan.id,
      patientId: patient.id,
      doctorId: doctor.id,
      status: 'OPEN',
      messages: {
        create: {
          senderId: patient.id,
          message: 'Initial patient concern',
          timestamp: new Date(),
        },
      },
    },
  });
  created.consultationIds.push(consultation.id);

  return { patient, doctor, otherDoctor, scan, consultation };
}

test.after(async () => {
  for (const attachmentPath of created.attachmentPaths) {
    if (fs.existsSync(attachmentPath)) {
      fs.unlinkSync(attachmentPath);
    }
  }

  if (created.scanIds.length > 0) {
    await prisma.report.deleteMany({
      where: { scanId: { in: created.scanIds } },
    });
  }

  if (created.consultationIds.length > 0) {
    await prisma.prescription.deleteMany({
      where: { consultationId: { in: created.consultationIds } },
    });
    await prisma.chatMessageReadReceipt.deleteMany({
      where: { message: { consultationId: { in: created.consultationIds } } },
    });
    await prisma.chatMessageAttachment.deleteMany({
      where: { message: { consultationId: { in: created.consultationIds } } },
    });
    await prisma.chatMessage.deleteMany({
      where: { consultationId: { in: created.consultationIds } },
    });
    await prisma.consultation.deleteMany({
      where: { id: { in: created.consultationIds } },
    });
  }

  if (created.scanIds.length > 0) {
    await prisma.scan.deleteMany({
      where: { id: { in: created.scanIds } },
    });
  }

  if (created.userIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { doctor: { userId: { in: created.userIds } } },
    });
    await prisma.patientNotification.deleteMany({
      where: { patient: { userId: { in: created.userIds } } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: created.userIds } },
    });
  }

  await prisma.$disconnect();
});

test('doctor consultation endpoints satisfy frontend contract', async () => {
  const app = createApp();
  const { doctor, patient, consultation } = await createConsultationFixture();
  const token = createToken(doctor);

  const list = await request(app, {
    method: 'GET',
    urlPath: '/api/v1/doctor/consultations?page=1&limit=10',
    token,
  });
  assert.equal(list.statusCode, 200);
  assert.ok(Array.isArray(list.body.data));
  assert.equal(list.body.data.some((item) => item.consultationId === consultation.id), true);
  assert.equal(list.body.meta.page, 1);
  assert.equal(list.body.pagination.limit, 10);

  const detail = await request(app, {
    method: 'GET',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}`,
    token,
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.body.data.patient.id, patient.id);
  assert.equal(detail.body.data.doctor.id, doctor.id);
  assert.equal(detail.body.data.status, 'OPEN');
  assert.equal(detail.body.data.subject, 'Changing lesion on left arm');
  assert.equal(detail.body.data.aiTriageRequired, false);
  assert.ok(detail.body.data.scan);
  assert.ok(Array.isArray(detail.body.data.messages));
  assert.ok(Array.isArray(detail.body.data.prescriptions));

  const messages = await request(app, {
    method: 'GET',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/messages?page=1&limit=20`,
    token,
  });
  assert.equal(messages.statusCode, 200);
  assert.ok(Array.isArray(messages.body.data));
  assert.equal(messages.body.meta.limit, 20);

  const form = new FormData();
  form.append('message', 'Doctor follow-up with attachment');
  form.append('attachments', Buffer.from('fake-image'), {
    filename: 'follow-up.png',
    contentType: 'image/png',
  });

  const sent = await request(app, {
    method: 'POST',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/messages`,
    token,
    form,
  });
  assert.equal(sent.statusCode, 201);
  assert.equal(sent.body.data.message, 'Doctor follow-up with attachment');
  assert.equal(sent.body.data.senderRole, 'doctor');
  assert.equal(sent.body.data.attachments.length, 1);
  assert.match(sent.body.data.attachments[0].url, /^\/uploads\/chat-attachments\//);
  created.attachmentPaths.push(
    path.join(__dirname, '..', sent.body.data.attachments[0].url.replace(/^\//, ''))
  );

  const readAll = await request(app, {
    method: 'PATCH',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/read-all`,
    token,
    body: {},
  });
  assert.equal(readAll.statusCode, 200);
  assert.equal(typeof readAll.body.data.markedCount, 'number');

  const prescription = await request(app, {
    method: 'POST',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/prescriptions`,
    token,
    body: {
      medicationName: 'Hydrocortisone cream',
      dosage: '1%',
      frequency: '2x daily',
      duration: '7 days',
      notes: 'Apply a thin layer.',
    },
  });
  assert.equal(prescription.statusCode, 201);
  assert.equal(prescription.body.data.consultationId, consultation.id);
  assert.equal(prescription.body.data.doctorId, doctor.id);

  const aiAnalysis = await request(app, {
    method: 'GET',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/ai-analysis`,
    token,
  });
  assert.equal(aiAnalysis.statusCode, 200);
  assert.equal(aiAnalysis.body.data.consultationId, consultation.id);
  assert.equal(aiAnalysis.body.data.scan.aiPrediction, 'Benign');

  const closed = await request(app, {
    method: 'PATCH',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/close`,
    token,
    body: {
      diagnosis: 'Benign nevus',
      recommendation: 'Routine monitoring',
      notes: 'No alarming features.',
      caseDisposition: 'case_resolved',
      finalClinicalNotes: 'Clinical review completed. Lesion appears benign with no urgent intervention needed.',
      emailClinicalSummary: true,
    },
  });
  assert.equal(closed.statusCode, 200);
  assert.equal(closed.body.data.status, 'CLOSED');
  assert.ok(closed.body.data.report.reportId);
  assert.equal(closed.body.data.report.caseDisposition, 'case_resolved');
  assert.equal(
    closed.body.data.report.finalClinicalNotes,
    'Clinical review completed. Lesion appears benign with no urgent intervention needed.'
  );
  assert.equal(closed.body.data.emailClinicalSummaryQueued, true);

  const closedForm = new FormData();
  closedForm.append('message', 'Message after close');

  const messageAfterClose = await request(app, {
    method: 'POST',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/messages`,
    token,
    form: closedForm,
  });
  assert.equal(messageAfterClose.statusCode, 409);
  assert.equal(messageAfterClose.body.status, 'error');
  assert.match(messageAfterClose.body.message, /closed consultation/);

  const deleted = await request(app, {
    method: 'DELETE',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}`,
    token,
  });
  assert.equal(deleted.statusCode, 200);
  assert.deepEqual(deleted.body, {
    status: 'success',
    message: 'Consultation deleted successfully',
  });
  created.deletedConsultationIds.push(consultation.id);

  assert.equal(await prisma.consultation.count({ where: { id: consultation.id } }), 0);
  assert.equal(await prisma.chatMessage.count({ where: { consultationId: consultation.id } }), 0);
  assert.equal(await prisma.prescription.count({ where: { consultationId: consultation.id } }), 0);
});

test('doctor close consultation validates required clinical close fields', async () => {
  const app = createApp();
  const { doctor, consultation } = await createConsultationFixture();

  const response = await request(app, {
    method: 'PATCH',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/close`,
    token: createToken(doctor),
    body: {
      diagnosis: 'Benign nevus',
      recommendation: 'Routine monitoring',
      notes: 'No alarming features.',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    status: 'error',
    message: 'caseDisposition is required and must be a string',
  });
});

test('doctor consultation routes require doctor token and assigned participant', async () => {
  const app = createApp();
  const { patient, otherDoctor, consultation } = await createConsultationFixture();

  const noToken = await request(app, {
    method: 'GET',
    urlPath: '/api/v1/doctor/consultations',
  });
  assert.equal(noToken.statusCode, 401);

  const patientTokenResponse = await request(app, {
    method: 'GET',
    urlPath: '/api/v1/doctor/consultations',
    token: createToken(patient),
  });
  assert.equal(patientTokenResponse.statusCode, 403);
  assert.equal(patientTokenResponse.body.message, 'Akses ditolak. Endpoint ini hanya untuk Dokter.');

  const otherDoctorToken = createToken(otherDoctor);
  const unauthorizedDetail = await request(app, {
    method: 'GET',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}`,
    token: otherDoctorToken,
  });
  assert.equal(unauthorizedDetail.statusCode, 403);
  assert.match(unauthorizedDetail.body.message, /not part of this consultation/);

  const unauthorizedReadAll = await request(app, {
    method: 'PATCH',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}/read-all`,
    token: otherDoctorToken,
    body: {},
  });
  assert.equal(unauthorizedReadAll.statusCode, 403);
  assert.match(unauthorizedReadAll.body.message, /not part of this consultation/);

  const unauthorizedDelete = await request(app, {
    method: 'DELETE',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}`,
    token: otherDoctorToken,
  });
  assert.equal(unauthorizedDelete.statusCode, 403);
  assert.match(unauthorizedDelete.body.message, /Only assigned doctor can delete consultation/);
});

test('doctor can delete only closed consultations', async () => {
  const app = createApp();
  const { doctor, consultation } = await createConsultationFixture();

  const openDelete = await request(app, {
    method: 'DELETE',
    urlPath: `/api/v1/doctor/consultations/${consultation.id}`,
    token: createToken(doctor),
  });

  assert.equal(openDelete.statusCode, 409);
  assert.deepEqual(openDelete.body, {
    status: 'error',
    message: 'Only closed consultations can be deleted',
  });

  const notFoundDelete = await request(app, {
    method: 'DELETE',
    urlPath: '/api/v1/doctor/consultations/00000000-0000-0000-0000-000000000000',
    token: createToken(doctor),
  });

  assert.equal(notFoundDelete.statusCode, 404);
  assert.deepEqual(notFoundDelete.body, {
    status: 'error',
    message: 'Consultation not found',
  });
});
