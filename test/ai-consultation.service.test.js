const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const axios = require('axios');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = 'false';
process.env.GEMMA_API_URL = process.env.GEMMA_API_URL || 'https://gemma.test/api/generate';
delete process.env.AI_BOT_USER_ID;

const prisma = require('../src/config/prisma');
const aiConsultationService = require('../src/services/ai-consultation.service');

const AI_BOT_SYSTEM_ID = 'GEMMA_AI_BOT_SYSTEM';
const AI_BOT_EMAIL = 'gemma.ai.system@myskin.local';

const created = {
  userIds: [],
  scanIds: [],
  consultationIds: [],
};

const originalAxiosPost = axios.post;
let existingBotBeforeTests = null;

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

test.before(async () => {
  existingBotBeforeTests = await prisma.user.findUnique({
    where: { id: AI_BOT_SYSTEM_ID },
    select: { id: true },
  });
});

test.beforeEach(() => {
  delete process.env.AI_BOT_USER_ID;
  axios.post = async () => ({
    status: 200,
    data: {
      response: 'Ini penjelasan AI untuk hasil scan Anda.',
    },
  });
});

test.afterEach(() => {
  axios.post = originalAxiosPost;
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
    const bot = await prisma.user.findUnique({
      where: { id: AI_BOT_SYSTEM_ID },
      select: { id: true },
    });

    if (bot) {
      await prisma.user.delete({ where: { id: bot.id } });
    }
  }

  if (created.userIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: created.userIds } },
    });
  }

  await prisma.$disconnect();
});

const createConsultationFixture = async () => {
  const token = stamp();
  const password = await bcrypt.hash('Str0ng!Pass2026', 10);

  const patient = await prisma.user.create({
    data: {
      name: `AI Patient ${token}`,
      email: `ai.patient.${token}@example.com`,
      password,
      role: 'patient',
      status: 'active',
      gender: 'male',
      patientProfile: {
        create: {},
      },
    },
    include: { patientProfile: true },
  });
  created.userIds.push(patient.id);

  const doctor = await prisma.user.create({
    data: {
      name: `AI Doctor ${token}`,
      email: `ai.doctor.${token}@example.com`,
      password,
      role: 'doctor',
      status: 'active',
      gender: 'female',
      doctorProfile: {
        create: {
          verificationStatus: 'verified',
          practitionerLicense: `AI-LIC-${token}`,
          specialization: 'Dermatology',
        },
      },
    },
  });
  created.userIds.push(doctor.id);

  const scan = await prisma.scan.create({
    data: {
      patientId: patient.patientProfile.id,
      imageUrl: '/uploads/ai-chatbot-test.jpg',
      complaint: 'Mole changed color recently',
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
};

test('sendAiMessage uses static Gemma AI system sender in a human doctor consultation room', async () => {
  const { patient, doctor, consultation } = await createConsultationFixture();

  const aiMessage = await aiConsultationService.sendAiMessage(
    patient.id,
    consultation.id,
    'Apa arti hasil scan saya?'
  );

  assert.equal(aiMessage.message, 'Ini penjelasan AI untuk hasil scan Anda.');
  assert.equal(aiMessage.senderId, AI_BOT_SYSTEM_ID);
  assert.notEqual(aiMessage.senderId, doctor.id);
  assert.equal(consultation.doctorId, doctor.id);
  assert.equal(aiMessage.sender.name, 'Gemma AI');
  assert.equal(aiMessage.sender.role, 'assistant');
  assert.match(aiMessage.sender.avatarUrl, /dicebear\.com\/9\.x\/bottts-neutral\/svg/);
  assert.equal(aiMessage.senderRole, 'assistant');
  assert.equal(aiMessage.sender.email, undefined);

  const bot = await prisma.user.findUnique({
    where: { id: AI_BOT_SYSTEM_ID },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  assert.ok(bot);
  assert.equal(bot.id, AI_BOT_SYSTEM_ID);
  assert.equal(bot.email, AI_BOT_EMAIL);
  assert.equal(bot.name, 'Gemma AI');
  assert.equal(bot.role, 'doctor');
  assert.equal(bot.status, 'active');

  const history = await aiConsultationService.getAiChatHistory(patient.id, consultation.id);
  const mappedAiMessage = history.find((chatMessage) => chatMessage.senderId === AI_BOT_SYSTEM_ID);

  assert.ok(mappedAiMessage);
  assert.equal(mappedAiMessage.sender.name, 'Gemma AI');
  assert.equal(mappedAiMessage.sender.role, 'assistant');
  assert.equal(mappedAiMessage.senderRole, 'assistant');
});
