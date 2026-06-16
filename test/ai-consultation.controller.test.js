const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = 'false';

const prisma = require('../src/config/prisma');
const aiConsultationRoutes = require('../src/routes/ai-consultation.route');

const AI_BOT_SYSTEM_ID = 'GEMMA_AI_BOT_SYSTEM';

const created = {
  userIds: [],
  scanIds: [],
  consultationIds: [],
};

const originalAxiosPost = axios.post;
const originalGemmaApiUrl = process.env.GEMMA_API_URL;
let existingBotBeforeTests = null;

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/patient/ai-consultations', aiConsultationRoutes);
  return app;
};

const createToken = (user) => jwt.sign(
  { id: user.id, name: user.name, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const request = async (app, { method, urlPath, token, body }) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = {
      ...(payload && {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }),
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

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
});

test.before(async () => {
  existingBotBeforeTests = await prisma.user.findUnique({
    where: { id: AI_BOT_SYSTEM_ID },
    select: { id: true },
  });
});

test.afterEach(() => {
  axios.post = originalAxiosPost;
  if (originalGemmaApiUrl === undefined) {
    delete process.env.GEMMA_API_URL;
  } else {
    process.env.GEMMA_API_URL = originalGemmaApiUrl;
  }
});

test.after(async () => {
  if (created.consultationIds.length > 0) {
    await prisma.chatMessageReadReceipt.deleteMany({
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

  if (!existingBotBeforeTests) {
    await prisma.user.deleteMany({
      where: { id: AI_BOT_SYSTEM_ID },
    });
  }

  if (created.userIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: created.userIds } },
    });
  }

  await prisma.$disconnect();
});

async function createUser(role, name) {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name,
      email: `${role}.ai-controller.${token}@example.com`,
      password: await bcrypt.hash('Str0ng!Pass2026', 10),
      role,
      gender: role === 'doctor' ? 'female' : 'male',
      status: 'active',
      ...(role === 'doctor' && {
        doctorProfile: {
          create: {
            verificationStatus: 'verified',
            practitionerLicense: `AI-CTRL-LIC-${token}`,
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
      patientProfile: true,
      doctorProfile: true,
    },
  });

  created.userIds.push(user.id);
  return user;
}

async function createConsultationFixture() {
  const patient = await createUser('patient', `AI Controller Patient ${stamp()}`);
  const doctor = await createUser('doctor', `AI Controller Doctor ${stamp()}`);

  const scan = await prisma.scan.create({
    data: {
      patientId: patient.patientProfile.id,
      imageUrl: '/uploads/ai-controller-test.jpg',
      complaint: 'Lesi berubah warna',
      bodySite: 'arm',
      isAnalyzed: true,
      aiPrediction: 'Benign',
      aiConfidence: 0.91,
    },
  });
  created.scanIds.push(scan.id);

  const consultation = await prisma.consultation.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      scanId: scan.id,
      status: 'OPEN',
    },
  });
  created.consultationIds.push(consultation.id);

  return { patient, doctor, consultation };
}

test('POST AI consultation messages returns 503 when GEMMA_API_URL is missing', async () => {
  const app = createApp();
  const { patient, consultation } = await createConsultationFixture();
  delete process.env.GEMMA_API_URL;

  const response = await request(app, {
    method: 'POST',
    urlPath: `/api/v1/patient/ai-consultations/${consultation.id}/messages`,
    token: createToken(patient),
    body: { message: 'Bagaimana kondisi kulit saya berdasarkan gambar?' },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.status, 'error');
  assert.equal(
    response.body.message,
    'AI chatbot service is unavailable: GEMMA_API_URL is not configured'
  );
});

test('POST AI consultation messages returns Gemma assistant sender for a human doctor room', async () => {
  const app = createApp();
  const { patient, doctor, consultation } = await createConsultationFixture();
  process.env.GEMMA_API_URL = 'https://gemma.test/api/generate';
  axios.post = async () => ({
    status: 200,
    data: {
      response: 'Berdasarkan gambar, tetap konsultasikan ke dokter untuk konfirmasi.',
    },
  });

  const response = await request(app, {
    method: 'POST',
    urlPath: `/api/v1/patient/ai-consultations/${consultation.id}/messages`,
    token: createToken(patient),
    body: { message: 'Bagaimana kondisi kulit saya berdasarkan gambar?' },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.status, 'success');
  assert.equal(response.body.data.senderId, AI_BOT_SYSTEM_ID);
  assert.notEqual(response.body.data.senderId, doctor.id);
  assert.equal(response.body.data.sender.name, 'Gemma AI');
  assert.equal(response.body.data.sender.role, 'assistant');
  assert.equal(response.body.data.senderRole, 'assistant');
});
