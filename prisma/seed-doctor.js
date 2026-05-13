const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// 1. Setup koneksi pool
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
const adapter = new PrismaPg(pool);

// 2. Inisialisasi Client dengan adapter (WAJIB di Prisma 7)
const prisma = new PrismaClient({ adapter });

async function generateDoctorId() {
  const random = Math.floor(Math.random() * 10000);
  return `MS-${String(random).padStart(4, '0')}`;
}

async function generateCaseId() {
  const random = Math.floor(Math.random() * 9999);
  return `SK-${String(random).padStart(4, '0')}`;
}

async function generateNotificationId() {
  const random = Math.floor(Math.random() * 9999);
  return `N-${String(random).padStart(4, '0')}`;
}

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  console.log('🌱 Sedang mengisi data doctor dashboard...');

  // ==================== CREATE DOCTOR USERS ====================

  // Doctor 1: Dr. Elena Aris
  const doctor1User = await prisma.user.upsert({
    where: { email: 'elenaaris@icloud.com' },
    update: {},
    create: {
      email: 'elenaaris@icloud.com',
      name: 'Dr. Elena Aris',
      password: hashedPassword,
      phone: '+628134567890',
      role: 'doctor',
      gender: 'female',
      birthDate: new Date('1996-04-23'),
    },
  });

  console.log('✅ Doctor 1 created:', doctor1User.name);

  // Doctor 2: Dr. James Mitchell
  const doctor2User = await prisma.user.upsert({
    where: { email: 'jamesmitchell@clinic.com' },
    update: {},
    create: {
      email: 'jamesmitchell@clinic.com',
      name: 'Dr. James Mitchell',
      password: hashedPassword,
      phone: '+628567890123',
      role: 'doctor',
      gender: 'male',
      birthDate: new Date('1988-07-15'),
    },
  });

  console.log('✅ Doctor 2 created:', doctor2User.name);

  // ==================== CREATE DOCTOR PROFILES ====================

  const doctor1Profile = await prisma.doctorProfile.create({
    data: {
      userId: doctor1User.id,
      doctorId: await generateDoctorId(),
      profileImageUrl: '/uploads/doctors/elena.png',
      verificationStatus: 'verified',
      practitionerLicense: 'DRS-2023-001',
      specialization: 'Dermatology',
      joinedAt: new Date('2023-10-01'),
    },
  });

  console.log('✅ Doctor 1 Profile created:', doctor1Profile.doctorId);

  const doctor2Profile = await prisma.doctorProfile.create({
    data: {
      userId: doctor2User.id,
      doctorId: await generateDoctorId(),
      profileImageUrl: '/uploads/doctors/james.png',
      verificationStatus: 'verified',
      practitionerLicense: 'DRS-2023-002',
      specialization: 'Dermatology',
      joinedAt: new Date('2023-08-15'),
    },
  });

  console.log('✅ Doctor 2 Profile created:', doctor2Profile.doctorId);

  // ==================== CREATE DOCTOR SETTINGS ====================

  await prisma.doctorSettings.create({
    data: {
      doctorId: doctor1Profile.id,
      twoFactorEnabled: true,
      emailNotifications: true,
      verificationAlerts: false,
      dataVisibility: 'restricted_clinical_team_only',
      language: 'English (US)',
    },
  });

  console.log('✅ Doctor 1 Settings created');

  await prisma.doctorSettings.create({
    data: {
      doctorId: doctor2Profile.id,
      twoFactorEnabled: false,
      emailNotifications: true,
      verificationAlerts: true,
      dataVisibility: 'restricted_clinical_team_only',
      language: 'English (US)',
    },
  });

  console.log('✅ Doctor 2 Settings created');

  // ==================== CREATE SAMPLE CASE REVIEWS ====================

  const caseReviews = [
    {
      caseId: await generateCaseId(),
      patientId: 'P-001',
      patientName: 'Sarah Johnson',
      patientAge: 42,
      patientGender: 'Female',
      clinicalImageUrl: '/uploads/cases/sk-9921-lesion.png',
      zoom: '4.0x',
      light: 'Polarized',
      bodySite: 'Left Shoulder',
      aiConfidence: 'HIGH CONFIDENCE',
      aiPredictionLabel: 'Melanocytic Nevus',
      aiConfidencePercentage: 88,
      alternativePredictions: JSON.stringify([
        { label: 'Seborrheic Keratosis', percentage: 7 },
        { label: 'Malignant Melanoma', percentage: 5 }
      ]),
      patientNotes: 'Noticed this spot changing color over the last 3 months.',
      doctorId: doctor1Profile.id,
      physicianObservation: 'The lesion appears consistent with benign melanocytic nevus.',
      finalDiagnosis: 'Melanocytic Nevus',
      reviewStatus: 'approved',
      receivedAt: new Date('2026-04-22T10:30:00Z'),
      reviewedAt: new Date('2026-04-22T11:30:00Z'),
    },
    {
      caseId: await generateCaseId(),
      patientId: 'P-002',
      patientName: 'Michael Chen',
      patientAge: 55,
      patientGender: 'Male',
      clinicalImageUrl: '/uploads/cases/sk-9920-lesion.png',
      zoom: '2.5x',
      light: 'Polarized',
      bodySite: 'Back',
      aiConfidence: 'MEDIUM CONFIDENCE',
      aiPredictionLabel: 'Seborrheic Keratosis',
      aiConfidencePercentage: 72,
      alternativePredictions: JSON.stringify([
        { label: 'Melanocytic Nevus', percentage: 20 },
        { label: 'Malignant Melanoma', percentage: 8 }
      ]),
      patientNotes: 'Found during annual screening.',
      doctorId: doctor2Profile.id,
      physicianObservation: 'Consistent with seborrheic keratosis. No malignant features.',
      finalDiagnosis: 'Seborrheic Keratosis',
      reviewStatus: 'approved',
      receivedAt: new Date('2026-04-20T14:00:00Z'),
      reviewedAt: new Date('2026-04-20T15:15:00Z'),
    },
    {
      caseId: await generateCaseId(),
      patientId: 'P-003',
      patientName: 'Emma Wilson',
      patientAge: 38,
      patientGender: 'Female',
      clinicalImageUrl: '/uploads/cases/sk-9919-lesion.png',
      zoom: '3.0x',
      light: 'Natural',
      bodySite: 'Chest',
      aiConfidence: 'HIGH CONFIDENCE',
      aiPredictionLabel: 'Melanocytic Nevus',
      aiConfidencePercentage: 85,
      alternativePredictions: JSON.stringify([
        { label: 'Seborrheic Keratosis', percentage: 12 },
        { label: 'Malignant Melanoma', percentage: 3 }
      ]),
      patientNotes: 'Present for several years, no changes noted.',
      reviewStatus: 'pending_review',
      receivedAt: new Date('2026-04-25T09:00:00Z'),
    },
    {
      caseId: await generateCaseId(),
      patientId: 'P-004',
      patientName: 'Robert Taylor',
      patientAge: 62,
      patientGender: 'Male',
      clinicalImageUrl: '/uploads/cases/sk-9918-lesion.png',
      zoom: '2.0x',
      light: 'Polarized',
      bodySite: 'Right Arm',
      aiConfidence: 'MEDIUM CONFIDENCE',
      aiPredictionLabel: 'Malignant Melanoma',
      aiConfidencePercentage: 65,
      alternativePredictions: JSON.stringify([
        { label: 'Melanocytic Nevus', percentage: 25 },
        { label: 'Seborrheic Keratosis', percentage: 10 }
      ]),
      patientNotes: 'Patient concerned about rapid growth.',
      doctorId: doctor1Profile.id,
      physicianObservation: 'AI prediction does not match clinical features. Appears more consistent with seborrheic keratosis.',
      finalDiagnosis: 'Seborrheic Keratosis',
      reviewStatus: 'rejected',
      rejectionReason: 'False positive prediction',
      receivedAt: new Date('2026-04-23T16:45:00Z'),
      reviewedAt: new Date('2026-04-23T17:30:00Z'),
    },
  ];

  for (const caseData of caseReviews) {
    await prisma.caseReview.create({
      data: caseData,
    });
  }

  console.log('✅ Case Reviews created:', caseReviews.length);

  // ==================== CREATE CASE ASSIGNMENTS ====================

  // Assign cases to doctors
  for (let i = 0; i < caseReviews.length; i++) {
    const doctorProfile = i % 2 === 0 ? doctor1Profile : doctor2Profile;
    
    await prisma.caseAssignment.create({
      data: {
        doctorId: doctorProfile.id,
        caseId: caseReviews[i].caseId,
      },
    });
  }

  console.log('✅ Case Assignments created');

  // ==================== CREATE NOTIFICATIONS ====================

  const notifications = [
    {
      doctorId: doctor1Profile.id,
      notificationId: await generateNotificationId(),
      title: 'You have a patient waiting',
      message: 'A patient is waiting for your attention.',
      type: 'case_request',
      isRead: false,
      createdAt: new Date('2026-04-25T10:30:00Z'),
    },
    {
      doctorId: doctor1Profile.id,
      notificationId: await generateNotificationId(),
      title: 'New scan analysis complete',
      message: 'Scan #8421 is ready for review.',
      type: 'scan_complete',
      isRead: false,
      createdAt: new Date('2026-04-25T09:45:00Z'),
    },
    {
      doctorId: doctor1Profile.id,
      notificationId: await generateNotificationId(),
      title: 'Case approved',
      message: 'Case SK-9921 has been successfully approved.',
      type: 'verification_alert',
      isRead: true,
      createdAt: new Date('2026-04-22T11:35:00Z'),
    },
    {
      doctorId: doctor2Profile.id,
      notificationId: await generateNotificationId(),
      title: 'System maintenance scheduled',
      message: 'System maintenance will be performed on 2026-04-30.',
      type: 'system_message',
      isRead: false,
      createdAt: new Date('2026-04-24T14:00:00Z'),
    },
  ];

  for (const notification of notifications) {
    await prisma.notification.create({
      data: notification,
    });
  }

  console.log('✅ Notifications created:', notifications.length);

  // ==================== CREATE DOCTOR OBSERVATIONS ====================

  const caseReview1 = await prisma.caseReview.findFirst({
    where: { patientName: 'Sarah Johnson' }
  });

  if (caseReview1) {
    await prisma.doctorObservation.create({
      data: {
        caseReviewId: caseReview1.id,
        doctorId: doctor1Profile.id,
        observation: 'Patient has good sun protection habits. Recommended continued monitoring.',
      },
    });

    console.log('✅ Doctor Observations created');
  }

  console.log('\n✨ Seeding selesai! Data doctor dashboard sudah siap.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
