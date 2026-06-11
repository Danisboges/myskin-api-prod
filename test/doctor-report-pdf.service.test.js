const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = require('../src/config/prisma');
const doctorService = require('../src/services/doctor.service');

const created = {
  userIds: [],
  scanIds: [],
  caseReviewIds: [],
  caseIds: [],
  reportIds: [],
  pdfPaths: [],
};

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

async function createFixture() {
  const token = stamp();
  const doctor = await prisma.user.create({
    data: {
      name: `PDF Doctor ${token}`,
      email: `pdf.doctor.${token}@example.com`,
      password: await bcrypt.hash('Str0ng!Pass2026', 10),
      role: 'doctor',
      gender: 'female',
      status: 'active',
      doctorProfile: {
        create: {
          verificationStatus: 'verified',
          practitionerLicense: `PDF-LIC-${token}`,
          specialization: 'Dermatology',
        },
      },
    },
    include: { doctorProfile: true },
  });

  const patient = await prisma.user.create({
    data: {
      name: `PDF Patient ${token}`,
      email: `pdf.patient.${token}@example.com`,
      password: await bcrypt.hash('Str0ng!Pass2026', 10),
      role: 'patient',
      gender: 'male',
      status: 'active',
      birthDate: new Date('1988-01-12'),
      patientProfile: {
        create: {},
      },
    },
    include: { patientProfile: true },
  });

  created.userIds.push(doctor.id, patient.id);

  const scan = await prisma.scan.create({
    data: {
      patientId: patient.patientProfile.id,
      imageUrl: '/uploads/test-lesion.jpg',
      complaint: 'Changing mole on shoulder',
      bodySite: 'Left shoulder',
      notes: 'Patient reports itching and color change.',
      isAnalyzed: true,
      aiPrediction: 'Melanocytic Nevus',
      aiConfidence: 0.86,
      aiDetails: JSON.stringify([
        { label: 'Melanocytic Nevus', confidence: 0.86 },
        { label: 'Malignant Melanoma', confidence: 0.09 },
      ]),
      analyzeCompletedAt: new Date(),
    },
  });

  created.scanIds.push(scan.id);

  const caseReview = await prisma.caseReview.create({
    data: {
      scanId: scan.id,
      doctorId: doctor.doctorProfile.id,
      caseId: `PDF-CASE-${token}`,
      zoom: '4.0x',
      light: 'Polarized',
      physicianObservation: 'Symmetric lesion with stable benign features.',
      finalDiagnosis: 'Melanocytic Nevus',
      reviewStatus: 'approved',
      receivedAt: new Date(Date.now() - 60 * 60 * 1000),
      reviewedAt: new Date(),
      observations: {
        create: {
          doctorId: doctor.doctorProfile.id,
          observation: 'Recommend routine monitoring and sun protection.',
        },
      },
    },
  });

  created.caseReviewIds.push(caseReview.id);
  created.caseIds.push(caseReview.caseId);

  await prisma.caseAssignment.create({
    data: {
      doctorId: doctor.doctorProfile.id,
      caseId: caseReview.caseId,
    },
  });

  return { doctor, caseReview };
}

test.after(async () => {
  if (created.caseIds.length > 0) {
    await prisma.caseAssignment.deleteMany({
      where: { caseId: { in: created.caseIds } },
    });
  }

  if (created.caseReviewIds.length > 0) {
    await prisma.doctorObservation.deleteMany({
      where: { caseReviewId: { in: created.caseReviewIds } },
    });
    await prisma.caseReview.deleteMany({
      where: { id: { in: created.caseReviewIds } },
    });
  }

  if (created.reportIds.length > 0) {
    await prisma.report.deleteMany({
      where: { reportId: { in: created.reportIds } },
    });
  }

  if (created.scanIds.length > 0) {
    await prisma.scan.deleteMany({
      where: { id: { in: created.scanIds } },
    });
  }

  if (created.userIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: created.userIds } },
    });
  }

  created.pdfPaths.forEach((pdfPath) => {
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }
  });

  await prisma.$disconnect();
});

const expectStoredPdf = (result, fileNamePattern) => {
  assert.equal(result.success, true);
  assert.match(result.fileName, fileNamePattern);
  assert.match(result.pdfUrl, /^\/uploads\/reports\/.+\.pdf$/);
  assert.ok(result.reportId);
  assert.ok(result.fileSize > 1000);
  assert.equal(result.dbError, null);

  const pdfPath = path.join(__dirname, '..', result.pdfUrl);
  created.reportIds.push(result.reportId);
  created.pdfPaths.push(pdfPath);

  assert.equal(fs.existsSync(pdfPath), true);
  const pdfBuffer = fs.readFileSync(pdfPath);
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');
  assert.equal(pdfBuffer.length, result.fileSize);
};

test('doctor case report PDF returns stored report metadata', async () => {
  const { doctor, caseReview } = await createFixture();

  const result = await doctorService.generateDoctorCaseReportPdf(doctor.id, caseReview.caseId);

  expectStoredPdf(result, /MySkin_Doctor_Case_Report_/);
  assert.equal(result.caseId, caseReview.caseId);
  assert.equal(result.patientName.startsWith('PDF Patient'), true);
});

test('doctor case history download returns stored report metadata', async () => {
  const { doctor } = await createFixture();

  const result = await doctorService.generateDoctorCaseHistoryPdf(doctor.id, {
    status: 'approved',
  });

  expectStoredPdf(result, /MySkin_Doctor_Case_History_/);
  assert.equal(result.casesIncluded, 1);
  assert.equal(result.approvedCases, 1);
  assert.equal(result.rejectedCases, 0);
});
