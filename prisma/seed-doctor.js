const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { hashPassword } = require('../src/utils/password.util');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const password = 'Str0ng!Pass2026';

const doctors = [
  {
    email: 'elenaaris@icloud.com',
    name: 'Dr. Elena Aris',
    phone: '+628134567890',
    gender: 'female',
    birthDate: new Date('1996-04-23'),
    avatarUrl: '/uploads/doctors/elena.png',
    practitionerLicense: 'DRS-2023-001',
    specialization: 'Dermatology',
    joinedAt: new Date('2023-10-01'),
    settings: {
      twoFactorEnabled: true,
      emailNotifications: true,
      verificationAlerts: false,
      dataVisibility: 'restricted_clinical_team_only',
      language: 'English (US)',
    },
  },
  {
    email: 'jamesmitchell@clinic.com',
    name: 'Dr. James Mitchell',
    phone: '+628567890123',
    gender: 'male',
    birthDate: new Date('1988-07-15'),
    avatarUrl: '/uploads/doctors/james.png',
    practitionerLicense: 'DRS-2023-002',
    specialization: 'Dermatology',
    joinedAt: new Date('2023-08-15'),
    settings: {
      twoFactorEnabled: false,
      emailNotifications: true,
      verificationAlerts: true,
      dataVisibility: 'restricted_clinical_team_only',
      language: 'English (US)',
    },
  },
];

const patients = [
  {
    scanId: 'SCAN-SEED-001',
    caseId: 'SK-9921',
    email: 'sarah.johnson@example.com',
    name: 'Sarah Johnson',
    gender: 'female',
    birthDate: new Date('1984-02-11'),
    imageUrl: '/uploads/cases/sk-9921-lesion.png',
    bodySite: 'Left Shoulder',
    complaint: 'Noticed this spot changing color over the last 3 months.',
    notes: 'Patient reports gradual color change.',
    aiPrediction: 'Melanocytic Nevus',
    aiConfidence: 0.88,
    aiDetails: [
      { label: 'Seborrheic Keratosis', confidence: 0.07 },
      { label: 'Malignant Melanoma', confidence: 0.05 },
    ],
    doctorIndex: 0,
    caseReview: {
      zoom: '4.0x',
      light: 'Polarized',
      physicianObservation: 'The lesion appears consistent with benign melanocytic nevus.',
      finalDiagnosis: 'Melanocytic Nevus',
      reviewStatus: 'approved',
      receivedAt: new Date('2026-04-22T10:30:00Z'),
      reviewedAt: new Date('2026-04-22T11:30:00Z'),
    },
    observation: 'Patient has good sun protection habits. Recommended continued monitoring.',
    consultation: {
      status: 'OPEN',
      createdAt: new Date('2026-04-22T10:40:00Z'),
      messages: [
        {
          sender: 'patient',
          message: 'Hello Doctor, I uploaded this scan because the spot has changed color recently. Should I be worried?',
          timestamp: new Date('2026-04-22T10:42:00Z'),
        },
        {
          sender: 'doctor',
          message: 'Hello Sarah, thank you for sharing the details. I will review the scan and compare it with the AI findings.',
          timestamp: new Date('2026-04-22T10:47:00Z'),
        },
        {
          sender: 'doctor',
          message: 'The lesion looks consistent with a benign melanocytic nevus. Please monitor it monthly and update me if the border, color, or size changes.',
          timestamp: new Date('2026-04-22T11:32:00Z'),
        },
      ],
    },
  },
  {
    scanId: 'SCAN-SEED-002',
    caseId: 'SK-9920',
    email: 'michael.chen@example.com',
    name: 'Michael Chen',
    gender: 'male',
    birthDate: new Date('1971-09-19'),
    imageUrl: '/uploads/cases/sk-9920-lesion.png',
    bodySite: 'Back',
    complaint: 'Found during annual screening.',
    notes: 'Routine annual screening finding.',
    aiPrediction: 'Seborrheic Keratosis',
    aiConfidence: 0.72,
    aiDetails: [
      { label: 'Melanocytic Nevus', confidence: 0.2 },
      { label: 'Malignant Melanoma', confidence: 0.08 },
    ],
    doctorIndex: 1,
    caseReview: {
      zoom: '2.5x',
      light: 'Polarized',
      physicianObservation: 'Consistent with seborrheic keratosis. No malignant features.',
      finalDiagnosis: 'Seborrheic Keratosis',
      reviewStatus: 'approved',
      receivedAt: new Date('2026-04-20T14:00:00Z'),
      reviewedAt: new Date('2026-04-20T15:15:00Z'),
    },
  },
  {
    scanId: 'SCAN-SEED-003',
    caseId: 'SK-9919',
    email: 'emma.wilson@example.com',
    name: 'Emma Wilson',
    gender: 'female',
    birthDate: new Date('1988-12-03'),
    imageUrl: '/uploads/cases/sk-9919-lesion.png',
    bodySite: 'Chest',
    complaint: 'Present for several years, no changes noted.',
    notes: 'Longstanding lesion without reported changes.',
    aiPrediction: 'Melanocytic Nevus',
    aiConfidence: 0.85,
    aiDetails: [
      { label: 'Seborrheic Keratosis', confidence: 0.12 },
      { label: 'Malignant Melanoma', confidence: 0.03 },
    ],
    doctorIndex: 0,
    caseReview: {
      zoom: '3.0x',
      light: 'Natural',
      reviewStatus: 'pending_review',
      receivedAt: new Date('2026-04-25T09:00:00Z'),
    },
    consultation: {
      status: 'OPEN',
      createdAt: new Date('2026-04-25T09:10:00Z'),
      messages: [
        {
          sender: 'patient',
          message: 'Hi Dr. Elena, this lesion has been there for years. I just want to confirm if it still looks safe.',
          timestamp: new Date('2026-04-25T09:12:00Z'),
        },
        {
          sender: 'doctor',
          message: 'Hi Emma, I received your scan. Since there are no reported changes, I will still review the dermoscopic features carefully.',
          timestamp: new Date('2026-04-25T09:18:00Z'),
        },
        {
          sender: 'patient',
          message: 'Thank you, Doctor. I can provide another photo if needed.',
          timestamp: new Date('2026-04-25T09:20:00Z'),
        },
      ],
    },
  },
  {
    scanId: 'SCAN-SEED-004',
    caseId: 'SK-9918',
    email: 'robert.taylor@example.com',
    name: 'Robert Taylor',
    gender: 'male',
    birthDate: new Date('1964-06-08'),
    imageUrl: '/uploads/cases/sk-9918-lesion.png',
    bodySite: 'Right Arm',
    complaint: 'Patient concerned about rapid growth.',
    notes: 'Rapid growth reported by patient.',
    aiPrediction: 'Malignant Melanoma',
    aiConfidence: 0.65,
    aiDetails: [
      { label: 'Melanocytic Nevus', confidence: 0.25 },
      { label: 'Seborrheic Keratosis', confidence: 0.1 },
    ],
    doctorIndex: 0,
    caseReview: {
      zoom: '2.0x',
      light: 'Polarized',
      physicianObservation: 'AI prediction does not match clinical features. Appears more consistent with seborrheic keratosis.',
      finalDiagnosis: 'Seborrheic Keratosis',
      reviewStatus: 'rejected',
      rejectionReason: 'False positive prediction',
      receivedAt: new Date('2026-04-23T16:45:00Z'),
      reviewedAt: new Date('2026-04-23T17:30:00Z'),
    },
    consultation: {
      status: 'OPEN',
      createdAt: new Date('2026-04-23T16:50:00Z'),
      messages: [
        {
          sender: 'patient',
          message: 'Dr. Elena, the AI result says melanoma and I am very concerned. What should I do next?',
          timestamp: new Date('2026-04-23T16:52:00Z'),
        },
        {
          sender: 'doctor',
          message: 'Robert, I understand your concern. I am reviewing it now. The AI confidence is moderate, so clinical review is important here.',
          timestamp: new Date('2026-04-23T16:58:00Z'),
        },
        {
          sender: 'doctor',
          message: 'After review, the clinical features look more like seborrheic keratosis than melanoma. I recommend an in-person check if the lesion keeps growing rapidly.',
          timestamp: new Date('2026-04-23T17:34:00Z'),
        },
      ],
    },
  },
];

const notifications = [
  {
    notificationId: 'N-SEED-001',
    doctorIndex: 0,
    title: 'You have a patient waiting',
    message: 'A patient is waiting for your attention.',
    type: 'case_request',
    isRead: false,
    createdAt: new Date('2026-04-25T10:30:00Z'),
  },
  {
    notificationId: 'N-SEED-002',
    doctorIndex: 0,
    title: 'New scan analysis complete',
    message: 'Scan #8421 is ready for review.',
    type: 'scan_complete',
    isRead: false,
    createdAt: new Date('2026-04-25T09:45:00Z'),
  },
  {
    notificationId: 'N-SEED-003',
    doctorIndex: 0,
    title: 'Case approved',
    message: 'Case SK-9921 has been successfully approved.',
    type: 'verification_alert',
    isRead: true,
    createdAt: new Date('2026-04-22T11:35:00Z'),
  },
  {
    notificationId: 'N-SEED-004',
    doctorIndex: 1,
    title: 'System maintenance scheduled',
    message: 'System maintenance will be performed on 2026-04-30.',
    type: 'system_message',
    isRead: false,
    createdAt: new Date('2026-04-24T14:00:00Z'),
  },
];

async function upsertDoctor(doctor, hashedPassword) {
  const user = await prisma.user.upsert({
    where: { email: doctor.email },
    update: {
      name: doctor.name,
      password: hashedPassword,
      phone: doctor.phone,
      role: 'doctor',
      gender: doctor.gender,
      birthDate: doctor.birthDate,
      avatarUrl: doctor.avatarUrl,
      status: 'active',
    },
    create: {
      email: doctor.email,
      name: doctor.name,
      password: hashedPassword,
      phone: doctor.phone,
      role: 'doctor',
      gender: doctor.gender,
      birthDate: doctor.birthDate,
      avatarUrl: doctor.avatarUrl,
      status: 'active',
    },
  });

  const profile = await prisma.doctorProfile.upsert({
    where: { userId: user.id },
    update: {
      verificationStatus: 'verified',
      practitionerLicense: doctor.practitionerLicense,
      specialization: doctor.specialization,
      joinedAt: doctor.joinedAt,
    },
    create: {
      userId: user.id,
      verificationStatus: 'verified',
      practitionerLicense: doctor.practitionerLicense,
      specialization: doctor.specialization,
      joinedAt: doctor.joinedAt,
    },
  });

  await prisma.doctorSettings.upsert({
    where: { doctorId: profile.id },
    update: doctor.settings,
    create: {
      doctorId: profile.id,
      ...doctor.settings,
    },
  });

  return { user, profile };
}

async function upsertPatient(patient, hashedPassword) {
  const user = await prisma.user.upsert({
    where: { email: patient.email },
    update: {
      name: patient.name,
      password: hashedPassword,
      role: 'patient',
      gender: patient.gender,
      birthDate: patient.birthDate,
      status: 'active',
    },
    create: {
      email: patient.email,
      name: patient.name,
      password: hashedPassword,
      role: 'patient',
      gender: patient.gender,
      birthDate: patient.birthDate,
      status: 'active',
    },
  });

  const profile = await prisma.patientProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  return { user, profile };
}

async function upsertScan(patient, patientProfile, doctorUserId) {
  return prisma.scan.upsert({
    where: { scanId: patient.scanId },
    update: {
      patientId: patientProfile.id,
      imageUrl: patient.imageUrl,
      complaint: patient.complaint,
      bodySite: patient.bodySite,
      notes: patient.notes,
      isAnalyzed: true,
      aiPrediction: patient.aiPrediction,
      aiConfidence: patient.aiConfidence,
      aiDetails: JSON.stringify(patient.aiDetails),
      analyzeCompletedAt: patient.caseReview.receivedAt,
      isSharedWithDoctor: true,
      sharedWith: JSON.stringify([doctorUserId]),
      uploadedAt: patient.caseReview.receivedAt,
    },
    create: {
      scanId: patient.scanId,
      patientId: patientProfile.id,
      imageUrl: patient.imageUrl,
      complaint: patient.complaint,
      bodySite: patient.bodySite,
      notes: patient.notes,
      isAnalyzed: true,
      aiPrediction: patient.aiPrediction,
      aiConfidence: patient.aiConfidence,
      aiDetails: JSON.stringify(patient.aiDetails),
      analyzeCompletedAt: patient.caseReview.receivedAt,
      isSharedWithDoctor: true,
      sharedWith: JSON.stringify([doctorUserId]),
      uploadedAt: patient.caseReview.receivedAt,
    },
  });
}

async function upsertCaseReview(patient, scan, doctorProfileId) {
  const caseReviewData = {
    scanId: scan.id,
    doctorId: doctorProfileId,
    zoom: patient.caseReview.zoom,
    light: patient.caseReview.light,
    physicianObservation: patient.caseReview.physicianObservation,
    finalDiagnosis: patient.caseReview.finalDiagnosis,
    reviewStatus: patient.caseReview.reviewStatus,
    rejectionReason: patient.caseReview.rejectionReason,
    receivedAt: patient.caseReview.receivedAt,
    reviewedAt: patient.caseReview.reviewedAt,
  };

  return prisma.caseReview.upsert({
    where: { caseId: patient.caseId },
    update: caseReviewData,
    create: {
      caseId: patient.caseId,
      ...caseReviewData,
    },
  });
}

async function upsertObservation(caseReview, doctorProfileId, observation) {
  if (!observation) {
    return;
  }

  const existingObservation = await prisma.doctorObservation.findFirst({
    where: {
      caseReviewId: caseReview.id,
      doctorId: doctorProfileId,
    },
  });

  if (existingObservation) {
    await prisma.doctorObservation.update({
      where: { id: existingObservation.id },
      data: { observation },
    });
    return;
  }

  await prisma.doctorObservation.create({
    data: {
      caseReviewId: caseReview.id,
      doctorId: doctorProfileId,
      observation,
    },
  });
}

async function upsertConsultationWithMessages(patient, patientUser, doctorUser, scan) {
  if (!patient.consultation) {
    return;
  }

  const consultation = await prisma.consultation.upsert({
    where: { scanId: scan.id },
    update: {
      patientId: patientUser.id,
      doctorId: doctorUser.id,
      status: patient.consultation.status,
      createdAt: patient.consultation.createdAt,
    },
    create: {
      scanId: scan.id,
      patientId: patientUser.id,
      doctorId: doctorUser.id,
      status: patient.consultation.status,
      createdAt: patient.consultation.createdAt,
    },
  });

  await prisma.chatMessageReadReceipt.deleteMany({
    where: { message: { consultationId: consultation.id } },
  });
  await prisma.chatMessageAttachment.deleteMany({
    where: { message: { consultationId: consultation.id } },
  });
  await prisma.chatMessage.deleteMany({
    where: { consultationId: consultation.id },
  });

  for (const seededMessage of patient.consultation.messages) {
    const senderId = seededMessage.sender === 'doctor' ? doctorUser.id : patientUser.id;
    await prisma.chatMessage.create({
      data: {
        consultationId: consultation.id,
        senderId,
        message: seededMessage.message,
        timestamp: seededMessage.timestamp,
        readReceipts: {
          create: {
            userId: senderId,
            readAt: seededMessage.timestamp,
          },
        },
      },
    });
  }

  await prisma.consultation.update({
    where: { id: consultation.id },
    data: {
      updatedAt: patient.consultation.messages.at(-1)?.timestamp || patient.consultation.createdAt,
    },
  });

  console.log(`Consultation chat siap: ${patient.scanId} -> ${doctorUser.email}`);
}

async function main() {
  console.log('Memulai seeding doctor dashboard...');

  const hashedPassword = await hashPassword(password, { validate: false });
  const doctorRecords = [];

  for (const doctor of doctors) {
    const record = await upsertDoctor(doctor, hashedPassword);
    doctorRecords.push(record);
    console.log(`Doctor siap: ${record.user.email}`);
  }

  for (const patient of patients) {
    const doctor = doctorRecords[patient.doctorIndex];
    const patientRecord = await upsertPatient(patient, hashedPassword);
    const scan = await upsertScan(patient, patientRecord.profile, doctor.user.id);
    const caseReview = await upsertCaseReview(patient, scan, doctor.profile.id);

    await prisma.caseAssignment.upsert({
      where: {
        doctorId_caseId: {
          doctorId: doctor.profile.id,
          caseId: caseReview.caseId,
        },
      },
      update: {},
      create: {
        doctorId: doctor.profile.id,
        caseId: caseReview.caseId,
      },
    });

    await upsertObservation(caseReview, doctor.profile.id, patient.observation);
    await upsertConsultationWithMessages(patient, patientRecord.user, doctor.user, scan);
    console.log(`Case siap: ${caseReview.caseId}`);
  }

  for (const notification of notifications) {
    const doctor = doctorRecords[notification.doctorIndex];
    await prisma.notification.upsert({
      where: { notificationId: notification.notificationId },
      update: {
        doctorId: doctor.profile.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
      create: {
        doctorId: doctor.profile.id,
        notificationId: notification.notificationId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
    });
  }

  console.log('\nSeeding selesai. Data doctor dashboard sudah siap.');
  console.log(`Login doctor: ${doctors.map((doctor) => doctor.email).join(', ')}`);
  console.log(`Password: ${password}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error('Seeding failed:', e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
