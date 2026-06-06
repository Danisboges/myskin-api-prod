require('dotenv').config();

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/password.util');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = 'password123';

const dt = (value) => new Date(value);

const demoAccounts = [
  { email: 'admin.demo@myskin.local', name: 'Aryo Jaty', role: 'admin', status: 'active', gender: 'male' },
  { email: 'ops.admin@myskin.local', name: 'Nadia Pratama', role: 'admin', status: 'active', gender: 'female' },
  { email: 'elena.aris@myskin.local', name: 'Dr. Elena Aris', role: 'doctor', status: 'active', gender: 'female' },
  { email: 'james.mitchell@myskin.local', name: 'Dr. James Mitchell', role: 'doctor', status: 'active', gender: 'male' },
  { email: 'pending.doctor@myskin.local', name: 'Dr. Pending Review', role: 'doctor', status: 'active', gender: 'female' },
  { email: 'rejected.doctor@myskin.local', name: 'Dr. Rejected Demo', role: 'doctor', status: 'inactive', gender: 'male' },
  { email: 'sarah.johnson@myskin.local', name: 'Sarah Johnson', role: 'patient', status: 'active', gender: 'female', birthDate: dt('1984-05-12T00:00:00Z') },
  { email: 'robert.taylor@myskin.local', name: 'Robert Taylor', role: 'patient', status: 'active', gender: 'male', birthDate: dt('1976-11-03T00:00:00Z') },
  { email: 'michael.chen@myskin.local', name: 'Michael Chen', role: 'patient', status: 'active', gender: 'male', birthDate: dt('1990-02-22T00:00:00Z') },
  { email: 'inactive.patient@myskin.local', name: 'Inactive Patient', role: 'patient', status: 'inactive', gender: 'female' },
];

const clinics = [
  { clinicId: 'clinic-kosambi-demo', name: 'Kosambi Dermatology Clinic', city: 'Jakarta', isActive: true },
  { clinicId: 'clinic-jakarta-skin-demo', name: 'Jakarta Skin Center', city: 'Jakarta', isActive: true },
  { clinicId: 'clinic-bandung-derma-demo', name: 'Bandung Derma Care', city: 'Bandung', isActive: true },
  { clinicId: 'clinic-inactive-demo', name: 'Inactive Demo Clinic', city: 'Depok', isActive: false },
];

const doctorProfiles = [
  {
    email: 'elena.aris@myskin.local',
    clinicId: 'clinic-kosambi-demo',
    verificationStatus: 'verified',
    practitionerLicense: 'TDR-3000',
    specialization: 'Senior Dermatologist',
    joinedAt: dt('2026-02-01T09:00:00Z'),
  },
  {
    email: 'james.mitchell@myskin.local',
    clinicId: 'clinic-jakarta-skin-demo',
    verificationStatus: 'verified',
    practitionerLicense: 'TDR-3001',
    specialization: 'Dermatologist',
    joinedAt: dt('2026-02-05T09:00:00Z'),
  },
  {
    email: 'pending.doctor@myskin.local',
    clinicId: 'clinic-bandung-derma-demo',
    verificationStatus: 'pending',
    practitionerLicense: 'TDR-3999',
    specialization: 'Dermatologist',
    licenseFile: '/uploads/demo/medical-license-pending.pdf',
    joinedAt: dt('2026-05-01T09:00:00Z'),
  },
  {
    email: 'rejected.doctor@myskin.local',
    clinicId: 'clinic-kosambi-demo',
    verificationStatus: 'rejected',
    practitionerLicense: 'TDR-3998',
    specialization: 'Dermatologist',
    licenseFile: '/uploads/demo/medical-license-rejected.pdf',
    joinedAt: dt('2026-04-01T09:00:00Z'),
  },
];

const scans = [
  {
    scanId: 'SCAN-SARAH-FEB-2026',
    patientEmail: 'sarah.johnson@myskin.local',
    doctorEmail: 'elena.aris@myskin.local',
    caseId: 'DEMO-CASE-SARAH-FEB-2026',
    date: dt('2026-02-10T09:15:00Z'),
    bodySite: 'Left forearm',
    aiPrediction: 'Benign Nevus',
    aiConfidence: 0.72,
    imageUrl: '/uploads/demo/lesion-baseline.jpg',
    note: 'Baseline photo of the same spot before visible color change.',
    reviewStatus: 'approved',
    finalDiagnosis: 'Benign Nevus',
    physicianObservation: 'Baseline image shows a symmetric lesion without alarming features.',
  },
  {
    scanId: 'SCAN-SARAH-APR-2026',
    patientEmail: 'sarah.johnson@myskin.local',
    doctorEmail: 'elena.aris@myskin.local',
    caseId: 'DEMO-CASE-SARAH-APR-2026',
    date: dt('2026-04-23T10:30:00Z'),
    bodySite: 'Left forearm',
    aiPrediction: 'Melanocytic Nevus',
    aiConfidence: 0.81,
    imageUrl: '/uploads/demo/lesion-followup-1.jpg',
    note: 'Noticed this spot changing color over the last 3 months.',
    reviewStatus: 'approved',
    finalDiagnosis: 'Melanocytic Nevus',
    physicianObservation: 'No concerning evolution compared with baseline, but patient should continue monitoring.',
  },
  {
    scanId: 'SCAN-SARAH-MAY-2026',
    patientEmail: 'sarah.johnson@myskin.local',
    doctorEmail: 'elena.aris@myskin.local',
    caseId: 'DEMO-CASE-SARAH-MAY-2026',
    date: dt('2026-05-12T08:45:00Z'),
    bodySite: 'Left forearm',
    aiPrediction: 'Melanocytic Nevus',
    aiConfidence: 0.86,
    imageUrl: '/uploads/demo/lesion-followup-2.jpg',
    note: 'Follow-up scan after noticing the spot became slightly darker.',
    growthPercentage: 14,
    reviewStatus: 'approved',
    finalDiagnosis: 'Melanocytic Nevus',
    physicianObservation: 'No alarming asymmetry or border change. Continue monthly monitoring.',
  },
  {
    scanId: 'SCAN-ROBERT-APR-2026',
    patientEmail: 'robert.taylor@myskin.local',
    doctorEmail: 'elena.aris@myskin.local',
    caseId: 'DEMO-CASE-ROBERT-APR-2026',
    date: dt('2026-04-18T14:20:00Z'),
    bodySite: 'Upper back',
    aiPrediction: 'Malignant Melanoma',
    aiConfidence: 0.91,
    imageUrl: '/uploads/demo/robert-false-positive.jpg',
    note: 'AI flagged the lesion, but the physician review identified an image artifact.',
    reviewStatus: 'rejected',
    finalDiagnosis: 'False Positive',
    physicianObservation: 'Image artifact caused false positive.',
    rejectionReason: 'Image artifact caused false positive.',
  },
  {
    scanId: 'SCAN-MICHAEL-MAY-2026',
    patientEmail: 'michael.chen@myskin.local',
    doctorEmail: 'james.mitchell@myskin.local',
    caseId: 'DEMO-CASE-MICHAEL-MAY-2026',
    date: dt('2026-05-06T11:10:00Z'),
    bodySite: 'Right shoulder',
    aiPrediction: 'Seborrheic Keratosis',
    aiConfidence: 0.88,
    imageUrl: '/uploads/demo/michael-seborrheic-keratosis.jpg',
    note: 'Routine follow-up scan reviewed by doctor.',
    reviewStatus: 'approved',
    finalDiagnosis: 'Seborrheic Keratosis',
    physicianObservation: 'Lesion appears consistent with seborrheic keratosis.',
  },
  {
    scanId: 'SCAN-PENDING-ELENA-DEMO',
    patientEmail: 'sarah.johnson@myskin.local',
    doctorEmail: 'elena.aris@myskin.local',
    caseId: 'DEMO-CASE-PENDING-ELENA',
    date: dt('2026-05-20T09:00:00Z'),
    bodySite: 'Left calf',
    aiPrediction: 'Melanocytic Nevus',
    aiConfidence: 0.67,
    imageUrl: '/uploads/demo/pending-review-lesion.jpg',
    note: 'Pending review case for doctor dashboard demo.',
    reviewStatus: 'pending_review',
  },
];

const clinicRequests = [
  {
    requestId: 'DEMO-CLINIC-REQ-PENDING',
    clinicName: 'Cempaka Skin Clinic',
    address: 'Cempaka, Jakarta',
    requesterName: 'Dr. Ratna Ayu',
    requesterEmail: 'ratna.ayu@myskin.local',
    requesterPhone: '+628111000200',
    status: 'pending',
    message: 'Requesting clinic onboarding for demo presentation.',
  },
  {
    requestId: 'DEMO-CLINIC-REQ-APPROVED',
    clinicName: 'North Jakarta Derma',
    address: 'North Jakarta',
    requesterName: 'Dr. Bima Santoso',
    requesterEmail: 'bima.santoso@myskin.local',
    requesterPhone: '+628111000201',
    status: 'approved',
    reviewedByAdminName: 'Aryo Jaty',
    reviewedAt: dt('2026-04-30T12:00:00Z'),
  },
  {
    requestId: 'DEMO-CLINIC-REQ-REJECTED',
    clinicName: 'Demo Rejected Clinic',
    address: 'Depok',
    requesterName: 'Dr. Lala Putri',
    requesterEmail: 'lala.putri@myskin.local',
    requesterPhone: '+628111000202',
    status: 'rejected',
    reviewNote: 'Dokumen legal belum lengkap',
    reviewedByAdminName: 'Aryo Jaty',
    reviewedAt: dt('2026-05-03T12:00:00Z'),
  },
];

const consultations = [
  {
    id: 'CONSULT-SARAH-ELENA-DEMO',
    scanId: 'SCAN-SARAH-MAY-2026',
    patientEmail: 'sarah.johnson@myskin.local',
    doctorEmail: 'elena.aris@myskin.local',
    status: 'OPEN',
    createdAt: dt('2026-05-12T09:00:00Z'),
    messages: [
      {
        sender: 'patient',
        message: 'Hello Doctor, I noticed this spot has become darker over the past few weeks.',
        timestamp: dt('2026-05-12T09:05:00Z'),
      },
      {
        sender: 'doctor',
        message: 'Thank you Sarah. I reviewed the scan and will compare it with your previous images.',
        timestamp: dt('2026-05-12T09:12:00Z'),
      },
      {
        sender: 'patient',
        message: 'I uploaded the latest photo from today.',
        timestamp: dt('2026-05-12T09:18:00Z'),
      },
    ],
  },
  {
    id: 'CONSULT-MICHAEL-JAMES-DEMO',
    scanId: 'SCAN-MICHAEL-MAY-2026',
    patientEmail: 'michael.chen@myskin.local',
    doctorEmail: 'james.mitchell@myskin.local',
    status: 'CLOSED',
    createdAt: dt('2026-05-06T11:30:00Z'),
    messages: [
      {
        sender: 'patient',
        message: 'Hi Doctor, can you confirm whether this spot needs urgent treatment?',
        timestamp: dt('2026-05-06T11:35:00Z'),
      },
      {
        sender: 'doctor',
        message: 'The review is reassuring. I will close this with a clinical summary.',
        timestamp: dt('2026-05-06T12:15:00Z'),
      },
    ],
  },
];

const reports = [
  {
    reportId: 'RPT-SARAH-DEMO',
    scanId: 'SCAN-SARAH-MAY-2026',
    patientEmail: 'sarah.johnson@myskin.local',
    title: 'Sarah Johnson - Lesion Evolution Report',
    description: 'Demo report summarizing lesion evolution from February to May 2026.',
    diagnosis: 'Melanocytic Nevus',
    recommendation: 'Continue monthly monitoring and schedule an in-person visit if the lesion grows, bleeds, or changes border.',
    status: 'approved',
    approvedByDoctorEmail: 'elena.aris@myskin.local',
    approvedAt: dt('2026-05-12T10:00:00Z'),
    pdfUrl: '/uploads/demo/reports/RPT-SARAH-DEMO.pdf',
  },
  {
    reportId: 'RPT-MICHAEL-DEMO',
    scanId: 'SCAN-MICHAEL-MAY-2026',
    patientEmail: 'michael.chen@myskin.local',
    title: 'Michael Chen - Consultation Summary',
    description: 'Closed consultation report for seborrheic keratosis review.',
    diagnosis: 'Seborrheic Keratosis',
    recommendation: 'No urgent intervention needed. Continue routine skin checks.',
    caseDisposition: 'case_resolved',
    finalClinicalNotes: 'Lesion appears consistent with seborrheic keratosis. No urgent intervention needed.',
    status: 'approved',
    approvedByDoctorEmail: 'james.mitchell@myskin.local',
    approvedAt: dt('2026-05-06T12:25:00Z'),
    pdfUrl: '/uploads/demo/reports/RPT-MICHAEL-DEMO.pdf',
  },
];

const systemLogs = [
  {
    logId: 'DEMO-SYSLOG-SECURITY-001',
    severity: 'warning',
    category: 'security',
    title: 'Suspicious login attempt',
    description: 'Multiple failed login attempts were detected for a demo account.',
    metadata: { email: 'unknown@myskin.local', ipAddress: '127.0.0.1' },
    createdAt: dt('2026-05-12T08:00:00Z'),
  },
  {
    logId: 'DEMO-SYSLOG-AI-001',
    severity: 'warning',
    category: 'ai_engine',
    title: 'AI confidence below review threshold',
    description: 'Scan analysis requires doctor review.',
    metadata: { scanId: 'SCAN-PENDING-ELENA-DEMO', confidence: 0.67, threshold: 0.7 },
    createdAt: dt('2026-05-20T09:05:00Z'),
  },
  {
    logId: 'DEMO-SYSLOG-USER-001',
    severity: 'info',
    category: 'user_management',
    title: 'Doctor approval queue checked',
    description: 'Admin reviewed pending doctor verification queue.',
    metadata: { adminEmail: 'admin.demo@myskin.local' },
    createdAt: dt('2026-05-21T10:00:00Z'),
  },
  {
    logId: 'DEMO-SYSLOG-INFRA-001',
    severity: 'critical',
    category: 'infrastructure',
    title: 'Demo API worker failed and recovered',
    description: 'A demo worker process restarted successfully after a simulated failure.',
    metadata: { worker: 'demo-report-worker', recovered: true },
    createdAt: dt('2026-05-22T10:00:00Z'),
  },
  {
    logId: 'DEMO-SYSLOG-SYSTEM-001',
    severity: 'info',
    category: 'system',
    title: 'Audit log cleanup completed',
    description: 'Expired audit logs were cleaned up.',
    metadata: { deletedCount: 12, retentionDays: 180 },
    createdAt: dt('2026-05-23T10:00:00Z'),
  },
];

const auditLogs = [
  {
    auditId: 'DEMO-AUDIT-CREATE-USER',
    adminEmail: 'admin.demo@myskin.local',
    adminName: 'Aryo Jaty',
    action: 'CREATE_USER',
    description: 'Created demo user accounts for presentation.',
    targetResourceType: 'User',
    targetResourceId: 'DEMO-USERS',
  },
  {
    auditId: 'DEMO-AUDIT-APPROVE-DOCTOR',
    adminEmail: 'admin.demo@myskin.local',
    adminName: 'Aryo Jaty',
    action: 'APPROVE_DOCTOR',
    description: 'Approved Dr. Elena Aris for demo clinic operations.',
    targetResourceType: 'DoctorProfile',
    targetResourceId: 'elena.aris@myskin.local',
  },
  {
    auditId: 'DEMO-AUDIT-CREATE-CLINIC',
    adminEmail: 'admin.demo@myskin.local',
    adminName: 'Aryo Jaty',
    action: 'CREATE_CLINIC',
    description: 'Created demo clinics for presentation.',
    targetResourceType: 'Clinic',
    targetResourceId: 'clinic-kosambi-demo',
  },
  {
    auditId: 'DEMO-AUDIT-UPDATE-SETTINGS',
    adminEmail: 'ops.admin@myskin.local',
    adminName: 'Nadia Pratama',
    action: 'UPDATE_SYSTEM_SETTINGS',
    description: 'Updated demo admin settings.',
    targetResourceType: 'AdminSettings',
    targetResourceId: 'ops.admin@myskin.local',
  },
  {
    auditId: 'DEMO-AUDIT-GENERATE-REPORT',
    adminEmail: 'admin.demo@myskin.local',
    adminName: 'Aryo Jaty',
    action: 'GENERATE_REPORT',
    description: 'Generated demo report for Sarah Johnson.',
    targetResourceType: 'Report',
    targetResourceId: 'RPT-SARAH-DEMO',
  },
];

const byEmail = new Map();
const doctorByEmail = new Map();
const patientByEmail = new Map();
const scanById = new Map();

async function upsertUser(account, hashedPassword) {
  const user = await prisma.user.upsert({
    where: { email: account.email },
    update: {
      name: account.name,
      password: hashedPassword,
      role: account.role,
      gender: account.gender,
      birthDate: account.birthDate,
      status: account.status,
      avatarUrl: `/uploads/demo/avatars/${account.email.split('@')[0]}.jpg`,
    },
    create: {
      email: account.email,
      name: account.name,
      password: hashedPassword,
      role: account.role,
      gender: account.gender,
      birthDate: account.birthDate,
      status: account.status,
      avatarUrl: `/uploads/demo/avatars/${account.email.split('@')[0]}.jpg`,
    },
  });

  byEmail.set(account.email, user);
  return user;
}

async function upsertClinic(clinic) {
  return prisma.clinic.upsert({
    where: { clinicId: clinic.clinicId },
    update: {
      name: clinic.name,
      address: clinic.city,
      isActive: clinic.isActive,
      phone: '+628111000100',
      email: `${clinic.clinicId}@myskin.local`,
    },
    create: {
      clinicId: clinic.clinicId,
      name: clinic.name,
      address: clinic.city,
      isActive: clinic.isActive,
      phone: '+628111000100',
      email: `${clinic.clinicId}@myskin.local`,
    },
  });
}

async function upsertDoctorProfile(profile) {
  const user = byEmail.get(profile.email);
  const doctorProfile = await prisma.doctorProfile.upsert({
    where: { userId: user.id },
    update: {
      clinicId: profile.clinicId,
      verificationStatus: profile.verificationStatus,
      practitionerLicense: profile.practitionerLicense,
      licenseFile: profile.licenseFile,
      specialization: profile.specialization,
      joinedAt: profile.joinedAt,
    },
    create: {
      userId: user.id,
      clinicId: profile.clinicId,
      verificationStatus: profile.verificationStatus,
      practitionerLicense: profile.practitionerLicense,
      licenseFile: profile.licenseFile,
      specialization: profile.specialization,
      joinedAt: profile.joinedAt,
    },
  });

  await prisma.doctorSettings.upsert({
    where: { doctorId: doctorProfile.id },
    update: {
      emailNotifications: profile.email === 'elena.aris@myskin.local',
      verificationAlerts: profile.email === 'elena.aris@myskin.local',
      language: 'English (US)',
    },
    create: {
      doctorId: doctorProfile.id,
      emailNotifications: profile.email === 'elena.aris@myskin.local',
      verificationAlerts: profile.email === 'elena.aris@myskin.local',
      language: 'English (US)',
    },
  });

  doctorByEmail.set(profile.email, doctorProfile);
  return doctorProfile;
}

async function upsertPatientProfile(account) {
  const user = byEmail.get(account.email);
  const profile = await prisma.patientProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  await prisma.patientSettings.upsert({
    where: { patientId: profile.id },
    update: {
      emailNotifications: true,
      scanNotifications: true,
      reportNotifications: true,
      language: 'English (US)',
    },
    create: {
      patientId: profile.id,
      emailNotifications: true,
      scanNotifications: true,
      reportNotifications: true,
      language: 'English (US)',
    },
  });

  patientByEmail.set(account.email, profile);
  return profile;
}

async function upsertClinicRequest(request) {
  const admin = byEmail.get('admin.demo@myskin.local');
  return prisma.clinicRequest.upsert({
    where: { requestId: request.requestId },
    update: {
      clinicName: request.clinicName,
      address: request.address,
      phone: '+628111000203',
      email: `${request.requestId.toLowerCase()}@myskin.local`,
      requesterName: request.requesterName,
      requesterEmail: request.requesterEmail,
      requesterPhone: request.requesterPhone,
      message: request.message,
      status: request.status,
      reviewNote: request.reviewNote,
      reviewedByAdminId: request.reviewedAt ? admin.id : null,
      reviewedByAdminName: request.reviewedByAdminName,
      reviewedAt: request.reviewedAt,
    },
    create: {
      requestId: request.requestId,
      clinicName: request.clinicName,
      address: request.address,
      phone: '+628111000203',
      email: `${request.requestId.toLowerCase()}@myskin.local`,
      requesterName: request.requesterName,
      requesterEmail: request.requesterEmail,
      requesterPhone: request.requesterPhone,
      message: request.message,
      status: request.status,
      reviewNote: request.reviewNote,
      reviewedByAdminId: request.reviewedAt ? admin.id : null,
      reviewedByAdminName: request.reviewedByAdminName,
      reviewedAt: request.reviewedAt,
    },
  });
}

async function upsertScanAndReview(item) {
  const patient = patientByEmail.get(item.patientEmail);
  const doctor = doctorByEmail.get(item.doctorEmail);
  const doctorUser = byEmail.get(item.doctorEmail);
  const aiDetails = {
    source: 'demo-seed',
    growthPercentage: item.growthPercentage,
    labels: [
      { label: item.aiPrediction, confidence: item.aiConfidence },
      { label: 'Malignant Melanoma', confidence: Number(Math.max(0.01, 1 - item.aiConfidence).toFixed(2)) },
    ],
  };

  const scan = await prisma.scan.upsert({
    where: { scanId: item.scanId },
    update: {
      patientId: patient.id,
      imageUrl: item.imageUrl,
      complaint: item.note,
      bodySite: item.bodySite,
      notes: item.note,
      isAnalyzed: true,
      aiPrediction: item.aiPrediction,
      aiConfidence: item.aiConfidence,
      aiDetails: JSON.stringify(aiDetails),
      analyzeCompletedAt: item.date,
      isSharedWithDoctor: true,
      sharedWith: JSON.stringify([doctorUser.id]),
      uploadedAt: item.date,
    },
    create: {
      scanId: item.scanId,
      patientId: patient.id,
      imageUrl: item.imageUrl,
      complaint: item.note,
      bodySite: item.bodySite,
      notes: item.note,
      isAnalyzed: true,
      aiPrediction: item.aiPrediction,
      aiConfidence: item.aiConfidence,
      aiDetails: JSON.stringify(aiDetails),
      analyzeCompletedAt: item.date,
      isSharedWithDoctor: true,
      sharedWith: JSON.stringify([doctorUser.id]),
      uploadedAt: item.date,
      createdAt: item.date,
    },
  });

  scanById.set(item.scanId, scan);

  const caseReview = await prisma.caseReview.upsert({
    where: { caseId: item.caseId },
    update: {
      scanId: scan.id,
      doctorId: doctor.id,
      physicianObservation: item.physicianObservation,
      finalDiagnosis: item.finalDiagnosis,
      reviewStatus: item.reviewStatus,
      rejectionReason: item.rejectionReason,
      receivedAt: item.date,
      reviewedAt: item.reviewStatus === 'pending_review' ? null : item.date,
    },
    create: {
      caseId: item.caseId,
      scanId: scan.id,
      doctorId: doctor.id,
      physicianObservation: item.physicianObservation,
      finalDiagnosis: item.finalDiagnosis,
      reviewStatus: item.reviewStatus,
      rejectionReason: item.rejectionReason,
      receivedAt: item.date,
      reviewedAt: item.reviewStatus === 'pending_review' ? null : item.date,
      createdAt: item.date,
    },
  });

  await prisma.caseAssignment.upsert({
    where: {
      doctorId_caseId: {
        doctorId: doctor.id,
        caseId: caseReview.caseId,
      },
    },
    update: {
      assignedAt: item.date,
    },
    create: {
      doctorId: doctor.id,
      caseId: caseReview.caseId,
      assignedAt: item.date,
    },
  });

  return { scan, caseReview };
}

async function upsertConsultation(item) {
  const scan = scanById.get(item.scanId) || await prisma.scan.findUnique({ where: { scanId: item.scanId } });
  const patientUser = byEmail.get(item.patientEmail);
  const doctorUser = byEmail.get(item.doctorEmail);

  const existingForScan = await prisma.consultation.findUnique({
    where: { scanId: scan.id },
  });

  if (existingForScan && existingForScan.id !== item.id) {
    await prisma.consultation.delete({ where: { id: existingForScan.id } });
  }

  const consultation = await prisma.consultation.upsert({
    where: { id: item.id },
    update: {
      scanId: scan.id,
      patientId: patientUser.id,
      doctorId: doctorUser.id,
      status: item.status,
      createdAt: item.createdAt,
    },
    create: {
      id: item.id,
      scanId: scan.id,
      patientId: patientUser.id,
      doctorId: doctorUser.id,
      status: item.status,
      createdAt: item.createdAt,
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

  for (const message of item.messages) {
    const senderId = message.sender === 'doctor' ? doctorUser.id : patientUser.id;
    await prisma.chatMessage.create({
      data: {
        consultationId: consultation.id,
        senderId,
        message: message.message,
        timestamp: message.timestamp,
        readReceipts: {
          create: {
            userId: senderId,
            readAt: message.timestamp,
          },
        },
      },
    });
  }

  return consultation;
}

async function upsertReport(item) {
  const scan = scanById.get(item.scanId) || await prisma.scan.findUnique({ where: { scanId: item.scanId } });
  const patient = patientByEmail.get(item.patientEmail);
  const doctor = item.approvedByDoctorEmail ? doctorByEmail.get(item.approvedByDoctorEmail) : null;

  return prisma.report.upsert({
    where: { reportId: item.reportId },
    update: {
      scanId: scan.id,
      patientId: patient.id,
      title: item.title,
      description: item.description,
      diagnosis: item.diagnosis,
      recommendation: item.recommendation,
      caseDisposition: item.caseDisposition,
      finalClinicalNotes: item.finalClinicalNotes,
      status: item.status,
      approvedByDoctorId: doctor?.id,
      approvedAt: item.approvedAt,
      pdfUrl: item.pdfUrl,
    },
    create: {
      reportId: item.reportId,
      scanId: scan.id,
      patientId: patient.id,
      title: item.title,
      description: item.description,
      diagnosis: item.diagnosis,
      recommendation: item.recommendation,
      caseDisposition: item.caseDisposition,
      finalClinicalNotes: item.finalClinicalNotes,
      status: item.status,
      approvedByDoctorId: doctor?.id,
      approvedAt: item.approvedAt,
      pdfUrl: item.pdfUrl,
    },
  });
}

async function upsertNotifications() {
  const admins = [
    byEmail.get('admin.demo@myskin.local'),
    byEmail.get('ops.admin@myskin.local'),
  ];
  const adminNotifications = [
    {
      notificationId: 'DEMO-ADMIN-NOTIF-DOCTOR-APPROVAL',
      type: 'doctor_approval',
      title: 'New doctor approval request',
      message: 'Dr. Pending Review is waiting for approval',
    },
    {
      notificationId: 'DEMO-ADMIN-NOTIF-CLINIC-REQUEST',
      type: 'clinic_request',
      title: 'New clinic request',
      message: 'Cempaka Skin Clinic is waiting for approval',
    },
    {
      notificationId: 'DEMO-ADMIN-NOTIF-SYSTEM-ALERT',
      type: 'system_alert',
      title: 'Critical system alert',
      message: 'Demo API error threshold exceeded',
    },
  ];

  for (const admin of admins) {
    for (const notification of adminNotifications) {
      await prisma.adminNotification.upsert({
        where: { notificationId: `${notification.notificationId}-${admin.email.split('@')[0]}` },
        update: {
          adminId: admin.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
        },
        create: {
          adminId: admin.id,
          notificationId: `${notification.notificationId}-${admin.email.split('@')[0]}`,
          type: notification.type,
          title: notification.title,
          message: notification.message,
        },
      });
    }
  }

  const elena = doctorByEmail.get('elena.aris@myskin.local');
  const doctorNotifications = [
    {
      notificationId: 'DEMO-DOCTOR-NOTIF-CASE-ASSIGNED',
      title: 'New case assigned',
      message: 'Sarah Johnson has a new case ready for review.',
      type: 'case_request',
    },
    {
      notificationId: 'DEMO-DOCTOR-NOTIF-SARAH-MESSAGE',
      title: 'Sarah Johnson sent a new message',
      message: 'Sarah Johnson sent a new message in consultation.',
      type: 'system_message',
    },
  ];

  for (const notification of doctorNotifications) {
    await prisma.notification.upsert({
      where: { notificationId: notification.notificationId },
      update: {
        doctorId: elena.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
      },
      create: {
        doctorId: elena.id,
        notificationId: notification.notificationId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
      },
    });
  }

  const sarah = patientByEmail.get('sarah.johnson@myskin.local');
  await prisma.patientNotification.upsert({
    where: { notificationId: 'DEMO-PATIENT-NOTIF-SARAH-DOCTOR-REPLY' },
    update: {
      patientId: sarah.id,
      title: 'Doctor replied to your consultation',
      message: 'Dr. Elena Aris replied to your consultation.',
      type: 'consultation_reply',
    },
    create: {
      patientId: sarah.id,
      notificationId: 'DEMO-PATIENT-NOTIF-SARAH-DOCTOR-REPLY',
      title: 'Doctor replied to your consultation',
      message: 'Dr. Elena Aris replied to your consultation.',
      type: 'consultation_reply',
    },
  });
}

async function upsertSystemLogs() {
  for (const log of systemLogs) {
    await prisma.systemLog.upsert({
      where: { logId: log.logId },
      update: {
        title: log.title,
        description: log.description,
        severity: log.severity,
        category: log.category,
        metadata: JSON.stringify(log.metadata),
        createdAt: log.createdAt,
      },
      create: {
        logId: log.logId,
        title: log.title,
        description: log.description,
        severity: log.severity,
        category: log.category,
        metadata: JSON.stringify(log.metadata),
        createdAt: log.createdAt,
      },
    });
  }
}

async function upsertAuditLogs() {
  for (const log of auditLogs) {
    const admin = byEmail.get(log.adminEmail);
    await prisma.auditLog.upsert({
      where: { auditId: log.auditId },
      update: {
        adminId: admin.id,
        adminName: log.adminName,
        action: log.action,
        description: log.description,
        targetResourceType: log.targetResourceType,
        targetResourceId: log.targetResourceId,
        status: 'success',
      },
      create: {
        auditId: log.auditId,
        adminId: admin.id,
        adminName: log.adminName,
        action: log.action,
        description: log.description,
        targetResourceType: log.targetResourceType,
        targetResourceId: log.targetResourceId,
        status: 'success',
      },
    });
  }
}

async function upsertAdminSettings() {
  const admin = byEmail.get('admin.demo@myskin.local');
  const opsAdmin = byEmail.get('ops.admin@myskin.local');

  await prisma.adminSettings.upsert({
    where: { adminId: admin.id },
    update: {
      emailNotifications: true,
      verificationAlerts: true,
      doctorApprovalAlerts: true,
      clinicRequestAlerts: true,
      systemAlerts: true,
      weeklyDigest: false,
      defaultPageSize: 8,
      auditLogRetentionDays: 180,
      maintenanceMode: false,
      deleteConfirmationRequired: true,
      language: 'English (US)',
      timezone: 'Asia/Jakarta',
    },
    create: {
      adminId: admin.id,
      emailNotifications: true,
      verificationAlerts: true,
      doctorApprovalAlerts: true,
      clinicRequestAlerts: true,
      systemAlerts: true,
      weeklyDigest: false,
      defaultPageSize: 8,
      auditLogRetentionDays: 180,
      maintenanceMode: false,
      deleteConfirmationRequired: true,
      language: 'English (US)',
      timezone: 'Asia/Jakarta',
    },
  });

  await prisma.adminSettings.upsert({
    where: { adminId: opsAdmin.id },
    update: {
      emailNotifications: true,
      doctorApprovalAlerts: true,
      clinicRequestAlerts: true,
      systemAlerts: true,
      weeklyDigest: false,
      defaultPageSize: 8,
      auditLogRetentionDays: 180,
      maintenanceMode: false,
      deleteConfirmationRequired: true,
      language: 'English (US)',
      timezone: 'Asia/Jakarta',
    },
    create: {
      adminId: opsAdmin.id,
      emailNotifications: true,
      doctorApprovalAlerts: true,
      clinicRequestAlerts: true,
      systemAlerts: true,
      weeklyDigest: false,
      defaultPageSize: 8,
      auditLogRetentionDays: 180,
      maintenanceMode: false,
      deleteConfirmationRequired: true,
      language: 'English (US)',
      timezone: 'Asia/Jakarta',
    },
  });
}

async function printSummary() {
  const scanIds = scans.map((scan) => scan.scanId);
  const reportIds = reports.map((report) => report.reportId);
  const consultationIds = consultations.map((consultation) => consultation.id);

  const [
    clinicCount,
    userCount,
    scanCount,
    consultationCount,
    reportCount,
    adminNotificationCount,
    doctorNotificationCount,
    patientNotificationCount,
    systemLogCount,
    auditLogCount,
  ] = await Promise.all([
    prisma.clinic.count({ where: { clinicId: { in: clinics.map((clinic) => clinic.clinicId) } } }),
    prisma.user.count({ where: { email: { endsWith: '@myskin.local' } } }),
    prisma.scan.count({ where: { scanId: { in: scanIds } } }),
    prisma.consultation.count({ where: { id: { in: consultationIds } } }),
    prisma.report.count({ where: { reportId: { in: reportIds } } }),
    prisma.adminNotification.count({ where: { notificationId: { startsWith: 'DEMO-ADMIN-NOTIF' } } }),
    prisma.notification.count({ where: { notificationId: { startsWith: 'DEMO-DOCTOR-NOTIF' } } }),
    prisma.patientNotification.count({ where: { notificationId: { startsWith: 'DEMO-PATIENT-NOTIF' } } }),
    prisma.systemLog.count({ where: { logId: { startsWith: 'DEMO-SYSLOG' } } }),
    prisma.auditLog.count({ where: { auditId: { startsWith: 'DEMO-AUDIT' } } }),
  ]);

  console.log('\nDemo accounts:');
  for (const account of demoAccounts) {
    console.log(`- ${account.email} (${account.role}, ${account.status})`);
  }
  console.log(`Password semua akun demo: ${DEMO_PASSWORD}`);

  console.log('\nDemo seed summary:');
  console.log(`- Clinics: ${clinicCount}`);
  console.log(`- Users: ${userCount}`);
  console.log(`- Scans: ${scanCount}`);
  console.log(`- Consultations: ${consultationCount}`);
  console.log(`- Reports: ${reportCount}`);
  console.log(`- Notifications: ${adminNotificationCount + doctorNotificationCount + patientNotificationCount}`);
  console.log(`  - Admin: ${adminNotificationCount}`);
  console.log(`  - Doctor: ${doctorNotificationCount}`);
  console.log(`  - Patient: ${patientNotificationCount}`);
  console.log(`- System logs: ${systemLogCount}`);
  console.log(`- Audit logs: ${auditLogCount}`);
}

async function main() {
  console.log('Starting MySkin demo seed...');

  const hashedPassword = await hashPassword(DEMO_PASSWORD, { validate: false });

  for (const account of demoAccounts) {
    await upsertUser(account, hashedPassword);
  }

  for (const clinic of clinics) {
    await upsertClinic(clinic);
  }

  for (const profile of doctorProfiles) {
    await upsertDoctorProfile(profile);
  }

  for (const account of demoAccounts.filter((account) => account.role === 'patient')) {
    await upsertPatientProfile(account);
  }

  await upsertAdminSettings();

  for (const request of clinicRequests) {
    await upsertClinicRequest(request);
  }

  for (const scan of scans) {
    await upsertScanAndReview(scan);
  }

  for (const consultation of consultations) {
    await upsertConsultation(consultation);
  }

  for (const report of reports) {
    await upsertReport(report);
  }

  await upsertNotifications();
  await upsertSystemLogs();
  await upsertAuditLogs();
  await printSummary();

  console.log('\nMySkin demo seed completed.');
}

main()
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
