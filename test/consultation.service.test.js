const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = require('../src/config/prisma');
const {
  createPrescription,
  getAiAnalysis,
  getChatMessages,
  getConsultationList,
  initiateConsultation,
  markMessagesAsRead,
  sendMessage,
} = require('../src/services/consultation.service');

const AI_BOT_SYSTEM_ID = 'GEMMA_AI_BOT_SYSTEM';
const AI_BOT_EMAIL = 'gemma.ai.system@myskin.local';

const created = {
  userIds: [],
  scanIds: [],
  consultationIds: [],
  attachmentPaths: [],
};

let existingAiBotBeforeTests = null;

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

test.before(async () => {
  existingAiBotBeforeTests = await prisma.user.findUnique({
    where: { id: AI_BOT_SYSTEM_ID },
    select: { id: true },
  });
});

async function createUser(role, name) {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name,
      email: `${role}.${token}@example.com`,
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
      patientProfile: true,
      doctorProfile: true,
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

async function ensureAiBotUser() {
  return prisma.user.upsert({
    where: { id: AI_BOT_SYSTEM_ID },
    update: {
      name: 'Gemma AI',
      email: AI_BOT_EMAIL,
      status: 'active',
    },
    create: {
      id: AI_BOT_SYSTEM_ID,
      name: 'Gemma AI',
      email: AI_BOT_EMAIL,
      password: await bcrypt.hash('GemmaSystemBotOnly2026!', 10),
      role: 'doctor',
      status: 'active',
    },
  });
}

test.after(async () => {
  for (const attachmentPath of created.attachmentPaths) {
    if (fs.existsSync(attachmentPath)) {
      fs.unlinkSync(attachmentPath);
    }
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

  if (!existingAiBotBeforeTests) {
    await prisma.user.deleteMany({
      where: { id: AI_BOT_SYSTEM_ID },
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

test('doctor consultation list supports filters and unread counts', async () => {
  const { doctor, patient, consultation } = await createConsultationFixture();

  const result = await getConsultationList(doctor.id, 'doctor', {
    page: 1,
    limit: 10,
    search: patient.name,
    status: 'OPEN',
  });

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].consultationId, consultation.id);
  assert.equal(result.data[0].patient.name, patient.name);
  assert.equal(result.data[0].status, 'OPEN');
  assert.equal(result.data[0].lastMessage.message, 'Initial patient concern');
  assert.equal(result.data[0].lastMessage.senderRole, 'patient');
  assert.equal(result.data[0].unreadCount, 1);
  assert.equal(result.pagination.lastPage, 1);
});

test('initiateConsultation accepts doctor User.id from available doctors response', async () => {
  const patient = await createUser('patient', `Patient ${stamp()}`);
  const doctor = await createUser('doctor', `Doctor ${stamp()}`);

  const scan = await prisma.scan.create({
    data: {
      patientId: patient.patientProfile.id,
      imageUrl: '/uploads/test-lesion-initiate.jpg',
      complaint: 'New lesion consultation request',
      bodySite: 'back',
      isAnalyzed: true,
      aiPrediction: 'Benign',
      aiConfidence: 0.82,
      aiDetails: 'No concerning pattern detected',
      analyzeCompletedAt: new Date(),
    },
  });
  created.scanIds.push(scan.id);

  const result = await initiateConsultation(
    patient.id,
    doctor.id,
    scan.scanId,
    'Saya ingin konsultasi hasil scan ini.'
  );
  created.consultationIds.push(result.id);

  assert.equal(result.doctor.id, doctor.id);
  assert.equal(result.scan.scanId, scan.scanId);

  const consultation = await prisma.consultation.findUnique({
    where: { id: result.id },
  });

  assert.equal(consultation.doctorId, doctor.id);
});

test('markMessagesAsRead creates read receipts for unread participant messages', async () => {
  const { doctor, consultation } = await createConsultationFixture();

  const result = await markMessagesAsRead(consultation.id, doctor.id);
  assert.equal(result.markedCount, 1);

  const afterRead = await getConsultationList(doctor.id, 'doctor', {
    page: 1,
    limit: 10,
  });

  const item = afterRead.data.find((entry) => entry.consultationId === consultation.id);
  assert.equal(item.unreadCount, 0);
});

test('sendMessage accepts attachments without text and returns attachment metadata', async () => {
  const { doctor, consultation } = await createConsultationFixture();

  const result = await sendMessage(consultation.id, doctor.id, '', [
    {
      originalname: 'clinical-photo.jpg',
      mimetype: 'image/jpeg',
      size: 12,
      buffer: Buffer.from('fake-jpeg'),
    },
  ]);

  assert.equal(result.message, '');
  assert.equal(result.senderRole, 'doctor');
  assert.equal(result.attachments.length, 1);
  assert.equal(result.attachments[0].fileName, 'clinical-photo.jpg');
  assert.equal(result.attachments[0].mimeType, 'image/jpeg');
  assert.match(result.attachments[0].url, /^\/uploads\/chat-attachments\//);

  created.attachmentPaths.push(
    path.join(__dirname, '..', result.attachments[0].url.replace(/^\//, ''))
  );
});

test('sendMessage creates doctor notification when patient sends chat', async () => {
  const { patient, doctor, consultation } = await createConsultationFixture();

  await sendMessage(
    consultation.id,
    patient.id,
    'Dokter, saya ingin menanyakan hasil scan ini.'
  );

  const notification = await prisma.notification.findFirst({
    where: {
      doctorId: doctor.doctorProfile.id,
      title: { contains: patient.name },
      type: 'system_message',
      isRead: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  assert.ok(notification);
  assert.equal(notification.message, 'Dokter, saya ingin menanyakan hasil scan ini.');
});

test('shared consultation chat maps Gemma AI system messages as assistant', async () => {
  const { patient, doctor, consultation } = await createConsultationFixture();
  await ensureAiBotUser();

  await prisma.chatMessage.create({
    data: {
      consultationId: consultation.id,
      senderId: AI_BOT_SYSTEM_ID,
      message: 'Saya bantu jelaskan hasil scan ini secara umum.',
      timestamp: new Date(Date.now() + 1000),
    },
  });

  const messages = await getChatMessages(consultation.id, doctor.id, {
    page: 1,
    limit: 10,
  });
  const aiMessage = messages.data.find((message) => message.senderId === AI_BOT_SYSTEM_ID);

  assert.ok(aiMessage);
  assert.equal(aiMessage.sender.name, 'Gemma AI');
  assert.equal(aiMessage.sender.role, 'assistant');
  assert.equal(aiMessage.senderRole, 'assistant');
  assert.match(aiMessage.sender.avatarUrl, /dicebear\.com\/9\.x\/bottts-neutral\/svg/);

  const list = await getConsultationList(patient.id, 'patient', {
    page: 1,
    limit: 10,
  });
  const item = list.data.find((entry) => entry.consultationId === consultation.id);

  assert.ok(item);
  assert.equal(item.lastMessage.message, 'Saya bantu jelaskan hasil scan ini secara umum.');
  assert.equal(item.lastMessage.senderRole, 'assistant');
});

test('only assigned doctor can create prescriptions', async () => {
  const { doctor, otherDoctor, consultation } = await createConsultationFixture();

  await assert.rejects(
    createPrescription(consultation.id, otherDoctor.id, {
      medicationName: 'Hydrocortisone cream',
    }),
    /Only assigned doctor can create prescriptions/
  );

  const prescription = await createPrescription(consultation.id, doctor.id, {
    medicationName: 'Hydrocortisone cream',
    dosage: '1%',
    frequency: '2x daily',
    duration: '7 days',
    notes: 'Apply thin layer to affected area.',
  });

  assert.equal(prescription.consultationId, consultation.id);
  assert.equal(prescription.doctorId, doctor.id);
  assert.equal(prescription.medicationName, 'Hydrocortisone cream');
});

test('getAiAnalysis returns scan and case review context for participants', async () => {
  const { doctor, scan, consultation } = await createConsultationFixture();

  const result = await getAiAnalysis(consultation.id, doctor.id);

  assert.equal(result.consultationId, consultation.id);
  assert.equal(result.scan.id, scan.id);
  assert.equal(result.scan.scanId, scan.scanId);
  assert.equal(result.scan.aiPrediction, 'Benign');
  assert.equal(result.scan.aiConfidence, 0.85);
  assert.equal(result.aiTriageRequired, false);
});
