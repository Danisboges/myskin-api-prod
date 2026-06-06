const prisma = require('../config/prisma');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const {
  validateAndNormalizeEmail,
  ensureEmailAvailable,
} = require('../utils/email.util');
const {
  hashPassword,
  verifyPassword,
  assertStrongPassword,
} = require('../utils/password.util');

// ==================== DASHBOARD SERVICES ====================

/**
 * Get doctor dashboard summary
 */
const getDashboardSummary = async (userId) => {
  try {
    // 1. Dapatkan doctor profile dari userId
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const doctorId = doctorProfile.id;

    // 2. Hitung totalRequests dari tabel CaseAssignment
    const totalRequests = await prisma.caseAssignment.count({
      where: { doctorId }
    });

    // 3. Ambil data CaseReview untuk menghitung status dan akurasi AI
    const caseReviews = await prisma.caseReview.findMany({
      where: { doctorId },
      include: {
        scan: {
          select: { aiConfidence: true }
        }
      }
    });

    // 4. Hitung pending dan completed dari CaseReview
    const pendingReview = caseReviews.filter(c => c.reviewStatus === 'pending_review').length;
    // Status selain 'pending_review' (seperti 'approved', 'rejected') dianggap selesai
    const completedScans = caseReviews.filter(c => c.reviewStatus !== 'pending_review').length;

    console.log("DEBUG getDashboardSummary - caseReviews:", caseReviews);
    console.log("DEBUG getDashboardSummary - pendingReview:", pendingReview);
    console.log("DEBUG getDashboardSummary - completedScans:", completedScans);

    // 5. Hitung rata-rata akurasi AI
    // Menggunakan opsional chaining (?.) untuk menghindari error jika scan tidak ada
    const totalConfidence = caseReviews.reduce((sum, c) => sum + (c.scan?.aiConfidence || 0), 0);
    const accuracy = caseReviews.length > 0 ? Math.round((totalConfidence / caseReviews.length) * 100) : 0;
    
    // 6. Hitung growth percentage berdasarkan CaseAssignment (Permintaan baru masuk)
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0); // Set ke awal hari di tanggal 1 bulan ini
    
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1); // Set ke tanggal 1 bulan lalu
    
    // Optimasi Query: Menghitung langsung dari database, bukan di memori JS
    const thisMonthCases = await prisma.caseAssignment.count({
      where: {
        doctorId,
        createdAt: { gte: thisMonth }
      }
    });
    
    const lastMonthCases = await prisma.caseAssignment.count({
      where: {
        doctorId,
        createdAt: {
          gte: lastMonth,
          lt: thisMonth
        }
      }
    });
    
    const growthPercentage = lastMonthCases > 0 
      ? Math.round(((thisMonthCases - lastMonthCases) / lastMonthCases) * 100) 
      : (thisMonthCases > 0 ? 100 : 0); // Jika bulan lalu 0 tapi bulan ini ada, anggap 100% growth

    return {
      totalRequests,
      pendingReview,
      completedScans,
      accuracy,
      growthPercentage
    };
  } catch (error) {
    throw new Error(`Failed to get dashboard summary: ${error.message}`);
  }
};
/**
 * Get assigned cases for a doctor
 */
const getAssignedCases = async (userId, filters = {}) => {
  try {
    // Get doctor profile from userId
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const assignments = await prisma.caseAssignment.findMany({
      where: { doctorId: doctorProfile.id },
      include: {
        doctor: true
      }
    });

    const caseIds = assignments.map(a => a.caseId);

    const cases = await prisma.caseReview.findMany({
      where: {
        caseId: { in: caseIds },
        reviewStatus: 'pending_review'
      },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: {
                  select: { name: true, gender: true, birthDate: true }
                }
              }
            }
          }
        }
      },
      orderBy: { receivedAt: 'desc' }
    });

    // Map to expected format
    return cases.map(c => ({
      caseId: c.caseId,
      patientName: c.scan.patient.user.name,
      patientAge: c.scan.patient.user.birthDate 
        ? new Date().getFullYear() - new Date(c.scan.patient.user.birthDate).getFullYear()
        : null,
      patientGender: c.scan.patient.user.gender,
      receivedAt: c.receivedAt.toISOString(),
      status: c.reviewStatus,
      scanImageUrl: c.scan.imageUrl,
      gradcamImageUrl: c.scan.gradcamUrl,
      avatarUrl: `/uploads/patients/${c.scan.patient.user.name.toLowerCase().replace(/\s+/g, '-')}.png`
    }));
  } catch (error) {
    throw new Error(`Failed to get assigned cases: ${error.message}`);
  }
};

const saveCaseAnnotation = async (caseId, fileData) => {
  try {
    if (!fileData) {
      throw new Error('File gambar anotasi (coretan) wajib disertakan');
    }

    // 1. Cari CaseReview berdasarkan caseId dan sertakan data Scan-nya
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId },
      include: { scan: true } // Ambil data scan agar kita dapat ID-nya
    });

    if (!caseReview || !caseReview.scan) {
      throw new Error('Case review atau data scan tidak ditemukan');
    }

    // 2. Simpan file gambar coretan ke folder fisik server
    const filename = `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileData.originalname.split('.').pop()}`;
    const uploadDir = path.join(__dirname, '../../uploads/annotations');
    const filepath = path.join(uploadDir, filename);

    // Buat folder jika belum ada
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Tulis data buffer ke file
    fs.writeFileSync(filepath, fileData.buffer);

    // 3. Path yang akan disimpan ke database
    const annotatedImageUrl = `/uploads/annotations/${filename}`;

    // 4. Update langsung tabel Scan
    const updatedScan = await prisma.scan.update({
      where: { id: caseReview.scan.id }, // Update berdasarkan ID scan yang terkait
      data: { 
        annotatedImageUrl: annotatedImageUrl 
      }
    });

    return {
      success: true,
      message: 'Coretan dokter berhasil disimpan pada data Scan',
      annotatedImageUrl: updatedScan.annotatedImageUrl
    };
  } catch (error) {
    throw new Error(`Failed to save annotation: ${error.message}`);
  }
};

/**
 * Get case details
 */
const getCaseDetail = async (caseId) => {
  try {
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true, gender: true, birthDate: true } }
              }
            }
          }
        }
      }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    // Get patient age from birthDate
    const patientBirthDate = caseReview.scan.patient.user.birthDate;
    const patientAge = patientBirthDate 
      ? new Date().getFullYear() - new Date(patientBirthDate).getFullYear()
      : null;

    return {
      caseId: caseReview.caseId,
      patient: {
        id: caseReview.scan.patientId,
        name: caseReview.scan.patient.user.name,
        age: patientAge,
        gender: caseReview.scan.patient.user.gender
      },
      clinicalImage: {
        imageUrl: caseReview.scan.imageUrl,
        annotatedImageUrl: caseReview.scan.annotatedImageUrl,
        zoom: caseReview.zoom || '4.0x',
        light: caseReview.light || 'Polarized',
        bodySite: caseReview.scan.bodySite || 'unspecified',
        complaint: caseReview.scan.complaint
      },
      aiPrediction: {
        confidence: caseReview.scan.aiConfidence || 0,
        prediction: caseReview.scan.aiPrediction,
        details: caseReview.scan.aiDetails,
        gradcamUrl: caseReview.scan.gradcamUrl
      },
      patientNotes: caseReview.scan.notes || 'No notes provided',
      physicianObservation: caseReview.physicianObservation,
      status: caseReview.reviewStatus,
      receivedAt: caseReview.receivedAt.toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to get case detail: ${error.message}`);
  }
};

/**
 * Save doctor observation
 */
const saveObservation = async (caseId, doctorId, observation) => {
  try {
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    // Create observation record
    const obs = await prisma.doctorObservation.create({
      data: {
        caseReviewId: caseReview.id,
        doctorId: doctorProfile.id,
        observation
      }
    });

    return {
      success: true,
      message: 'Observation saved successfully'
    };
  } catch (error) {
    throw new Error(`Failed to save observation: ${error.message}`);
  }
};

/**
 * Approve a case review
 */
const approveCase = async (caseId, doctorId, physicianObservation, finalDiagnosis) => {
  try {
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        },
        doctor: {
          include: {
            user: { select: { name: true } }
          }
        }
      }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const updated = await prisma.caseReview.update({
      where: { caseId },
      data: {
        doctorId: doctorProfile.id,
        physicianObservation,
        finalDiagnosis,
        reviewStatus: 'approved',
        reviewedAt: new Date()
      }
    });

    // ===== NOTIFIKASI KE PATIENT =====
    // Import createPatientNotification dari patient service
    const patientService = require('./patient.service');
    const patientId = caseReview.scan.patient.id;
    const patientName = caseReview.scan.patient.user.name;
    const doctorName = doctorProfile.user?.name || 'A doctor';

    await patientService.createPatientNotification(
      patientId,
      'Case Review Completed',
      `Dr. ${doctorName} has approved and completed the review of your scan (Case ID: ${caseId}). Check your dashboard for the diagnosis.`,
      'scan_complete'
    );

    return {
      success: true,
      message: 'Case approved successfully',
      caseId: updated.caseId
    };
  } catch (error) {
    throw new Error(`Failed to approve case: ${error.message}`);
  }
};

/**
 * Reject a case review
 */
const rejectCase = async (caseId, doctorId, reason, physicianObservation, finalDiagnosis) => {
  try {
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        },
        doctor: {
          include: {
            user: { select: { name: true } }
          }
        }
      }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const updated = await prisma.caseReview.update({
      where: { caseId },
      data: {
        doctorId: doctorProfile.id,
        rejectionReason: reason,
        physicianObservation,
        finalDiagnosis,
        reviewStatus: 'rejected',
        reviewedAt: new Date()
      }
    });

    // ===== NOTIFIKASI KE PATIENT =====
    const patientService = require('./patient.service');
    const patientId = caseReview.scan.patient.id;
    const patientName = caseReview.scan.patient.user.name;
    const doctorName = doctorProfile.user?.name || 'A doctor';

    await patientService.createPatientNotification(
      patientId,
      'Case Review Rejected',
      `Dr. ${doctorName} has rejected the review of your scan (Case ID: ${caseId}). Reason: ${reason}. You may resubmit if needed.`,
      'verification_alert'
    );

    return {
      success: true,
      message: 'Case rejected successfully',
      caseId: updated.caseId
    };
  } catch (error) {
    throw new Error(`Failed to reject case: ${error.message}`);
  }
};

// ==================== CASE HISTORY SERVICES ====================

const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const formatDate = (value) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta'
  });
};

const calculateAge = (birthDate) => {
  if (!birthDate) {
    return null;
  }

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
};

const parseAiDetails = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const normalizeReviewStatusLabel = (status) => ({
  approved: 'Approved',
  rejected: 'Rejected',
  pending_review: 'Pending Review',
  under_review: 'Under Review'
}[status] || status || '-');

const createPdfBuffer = async (render) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Producer: 'MySkin Doctor Reporting',
      Creator: 'MySkin Backend'
    }
  });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  render(doc);
  doc.end();
});

const ensureSpace = (doc, requiredHeight = 90) => {
  if (doc.y + requiredHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
};

const drawHeader = (doc, title, subtitle) => {
  doc.rect(0, 0, doc.page.width, 96).fill('#1f3f8b');
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('MY SKIN', 48, 28);
  doc.fontSize(16).font('Helvetica').text(title, 48, 54);
  doc.fontSize(9).text(subtitle, 48, 75);
  doc.moveDown(3);
  doc.fillColor('#172033');
};

const drawSectionTitle = (doc, title) => {
  ensureSpace(doc, 70);
  doc.moveDown(0.6);
  doc.fillColor('#1f3f8b').fontSize(13).font('Helvetica-Bold').text(title.toUpperCase());
  doc.moveTo(48, doc.y + 5).lineTo(doc.page.width - 48, doc.y + 5).strokeColor('#dbe3ef').stroke();
  doc.moveDown(0.9);
  doc.fillColor('#172033').strokeColor('#000000');
};

const drawKeyValue = (doc, label, value) => {
  ensureSpace(doc, 24);
  const startY = doc.y;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155').text(label, 48, startY, {
    width: 155
  });
  doc.font('Helvetica').fillColor('#172033').text(value === undefined || value === null || value === '' ? '-' : String(value), 210, startY, {
    width: doc.page.width - 258
  });
  doc.moveDown(0.35);
};

const drawParagraph = (doc, title, value) => {
  ensureSpace(doc, 80);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155').text(title);
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica').fillColor('#172033').text(value || '-', {
    align: 'left',
    lineGap: 2
  });
  doc.moveDown(0.6);
};

const buildCaseHistoryWhere = (doctorProfileId, filters = {}) => {
  const { search, diagnosis, status, startDate, endDate } = filters;
  const reviewStatus = normalizeReviewStatus(status);
  const parsedStartDate = parseOptionalDate(startDate, 'startDate');
  const parsedEndDate = parseOptionalDate(endDate, 'endDate');

  if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
    throw createHttpError('endDate must be after startDate', 400);
  }

  const whereClause = {
    doctorId: doctorProfileId,
    reviewStatus: { not: 'pending_review' }
  };

  if (reviewStatus) {
    whereClause.reviewStatus = reviewStatus;
  }

  if (diagnosis) {
    whereClause.finalDiagnosis = { contains: diagnosis, mode: 'insensitive' };
  }

  if (parsedStartDate || parsedEndDate) {
    whereClause.reviewedAt = {};
    if (parsedStartDate) {
      whereClause.reviewedAt.gte = parsedStartDate;
    }
    if (parsedEndDate) {
      whereClause.reviewedAt.lte = parsedEndDate;
    }
  }

  if (search) {
    whereClause.OR = [
      {
        scan: {
          is: {
            patient: {
              is: {
                user: {
                  is: {
                    name: { contains: search, mode: 'insensitive' }
                  }
                }
              }
            }
          }
        }
      },
      { caseId: { contains: search, mode: 'insensitive' } }
    ];
  }

  return whereClause;
};

const getDoctorProfileForUser = async (userId) => {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      clinic: {
        select: {
          clinicId: true,
          name: true
        }
      }
    }
  });

  if (!doctorProfile) {
    throw createHttpError('Doctor profile not found', 404);
  }

  return doctorProfile;
};

const parseOptionalDate = (value, fieldName) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(`${fieldName} must be a valid date`, 400);
  }

  return date;
};

const normalizeReviewStatus = (status) => {
  if (!status) {
    return undefined;
  }

  const statusAliases = {
    verified: 'approved',
    completed: 'approved'
  };
  const normalized = statusAliases[status] || status;
  const validStatuses = ['pending_review', 'approved', 'rejected', 'under_review'];

  if (!validStatuses.includes(normalized)) {
    throw createHttpError(
      `status must be one of: ${validStatuses.join(', ')}`,
      400
    );
  }

  return normalized;
};

/**
 * Get case history with filters and pagination
 */
const getCaseHistory = async (userId, filters = {}) => {
  try {
    const { page = 1, limit = 10 } = filters;
    const pageNumber = parsePositiveInteger(page, 1);
    const limitNumber = Math.min(parsePositiveInteger(limit, 10), 100);
    const skip = (pageNumber - 1) * limitNumber;

    // Get doctor profile from userId
    const doctorProfile = await getDoctorProfileForUser(userId);
    const whereClause = buildCaseHistoryWhere(doctorProfile.id, filters);

    const total = await prisma.caseReview.count({ where: whereClause });

    const cases = await prisma.caseReview.findMany({
      where: whereClause,
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        }
      },
      skip,
      take: limitNumber,
      orderBy: { reviewedAt: 'desc' }
    });

    return {
      data: cases.map(c => ({
        caseId: c.caseId,
        date: c.reviewedAt ? c.reviewedAt.toISOString().split('T')[0] : null,
        patient: {
          id: c.scan?.patientId || null,
          name: c.scan?.patient?.user?.name || null
        },
        clinicalImageUrl: c.scan?.imageUrl || null,
        aiPrediction: c.scan?.aiPrediction || null,
        finalDiagnosis: c.finalDiagnosis,
        verificationStatus: c.reviewStatus
      })),
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total
      }
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    console.error('[doctor.service.getCaseHistory] Prisma/query failure', {
      userId,
      filters,
      message: error.message,
      stack: error.stack
    });

    throw createHttpError(`Failed to get case history: ${error.message}`, 500);
  }
};

const fetchDoctorCaseForReport = async (userId, caseId) => {
  const doctorProfile = await getDoctorProfileForUser(userId);
  const caseReview = await prisma.caseReview.findUnique({
    where: { caseId },
    include: {
      doctor: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          clinic: { select: { clinicId: true, name: true } }
        }
      },
      scan: {
        include: {
          patient: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  gender: true,
                  birthDate: true
                }
              }
            }
          }
        }
      },
      observations: {
        orderBy: { createdAt: 'asc' },
        include: {
          doctor: {
            include: {
              user: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  if (!caseReview) {
    throw createHttpError('Case not found', 404);
  }

  const assignment = await prisma.caseAssignment.findUnique({
    where: {
      doctorId_caseId: {
        doctorId: doctorProfile.id,
        caseId
      }
    }
  });

  if (caseReview.doctorId !== doctorProfile.id && !assignment) {
    throw createHttpError('Unauthorized: Case is not assigned to this doctor', 403);
  }

  return { doctorProfile, caseReview };
};

const renderCaseReportPdf = (doc, caseReview, doctorProfile) => {
  const patientUser = caseReview.scan?.patient?.user || {};
  const scan = caseReview.scan || {};
  const doctorUser = doctorProfile.user || caseReview.doctor?.user || {};
  const aiDetails = parseAiDetails(scan.aiDetails);

  drawHeader(
    doc,
    'Doctor Case Report',
    `Generated at ${formatDate(new Date())}`
  );

  drawSectionTitle(doc, 'Report Summary');
  drawKeyValue(doc, 'Case ID', caseReview.caseId);
  drawKeyValue(doc, 'Status', normalizeReviewStatusLabel(caseReview.reviewStatus));
  drawKeyValue(doc, 'Received At', formatDate(caseReview.receivedAt));
  drawKeyValue(doc, 'Reviewed At', formatDate(caseReview.reviewedAt));
  drawKeyValue(doc, 'Doctor', doctorUser.name || '-');
  drawKeyValue(doc, 'Clinic', doctorProfile.clinic?.name || caseReview.doctor?.clinic?.name || '-');

  drawSectionTitle(doc, 'Patient Information');
  drawKeyValue(doc, 'Patient Name', patientUser.name);
  drawKeyValue(doc, 'Patient Email', patientUser.email);
  drawKeyValue(doc, 'Gender', patientUser.gender);
  drawKeyValue(doc, 'Age', calculateAge(patientUser.birthDate) || '-');
  drawKeyValue(doc, 'Date of Birth', patientUser.birthDate ? formatDate(patientUser.birthDate) : '-');

  drawSectionTitle(doc, 'Clinical Scan');
  drawKeyValue(doc, 'Scan ID', scan.scanId);
  drawKeyValue(doc, 'Body Site', scan.bodySite || '-');
  drawKeyValue(doc, 'Complaint', scan.complaint || '-');
  drawKeyValue(doc, 'Patient Notes', scan.notes || '-');
  drawKeyValue(doc, 'Image URL', scan.imageUrl || '-');
  drawKeyValue(doc, 'Uploaded At', formatDate(scan.uploadedAt || scan.createdAt));

  drawSectionTitle(doc, 'AI Analysis');
  drawKeyValue(doc, 'AI Prediction', scan.aiPrediction || '-');
  drawKeyValue(doc, 'AI Confidence', scan.aiConfidence !== null && scan.aiConfidence !== undefined ? `${Math.round(scan.aiConfidence * 100)}%` : '-');
  drawKeyValue(doc, 'Analyzed At', formatDate(scan.analyzeCompletedAt));
  if (aiDetails.length > 0) {
    aiDetails.forEach((item, index) => {
      const confidence = typeof item.confidence === 'number'
        ? `${Math.round(item.confidence * 100)}%`
        : item.confidence || '-';
      drawKeyValue(doc, `AI Differential ${index + 1}`, `${item.label || item.name || '-'} (${confidence})`);
    });
  } else {
    drawParagraph(doc, 'AI Details', scan.aiDetails || 'No structured AI details available.');
  }

  drawSectionTitle(doc, 'Doctor Review');
  drawKeyValue(doc, 'Final Diagnosis', caseReview.finalDiagnosis || '-');
  drawKeyValue(doc, 'Review Status', normalizeReviewStatusLabel(caseReview.reviewStatus));
  drawKeyValue(doc, 'Zoom', caseReview.zoom || '-');
  drawKeyValue(doc, 'Light', caseReview.light || '-');
  drawParagraph(doc, 'Physician Observation', caseReview.physicianObservation || 'No physician observation recorded.');
  if (caseReview.rejectionReason) {
    drawParagraph(doc, 'Rejection Reason', caseReview.rejectionReason);
  }

  drawSectionTitle(doc, 'Observation Timeline');
  if (caseReview.observations?.length) {
    caseReview.observations.forEach((observation, index) => {
      drawParagraph(
        doc,
        `${index + 1}. ${formatDate(observation.createdAt)} - ${observation.doctor?.user?.name || 'Doctor'}`,
        observation.observation
      );
    });
  } else {
    drawParagraph(doc, 'Timeline', 'No additional doctor observations recorded.');
  }

  drawSectionTitle(doc, 'Clinical Recommendation');
  const recommendation = caseReview.reviewStatus === 'rejected'
    ? 'AI diagnosis was rejected by the doctor. Follow the final clinical diagnosis and consider additional clinical review if symptoms progress.'
    : 'Continue patient monitoring according to the final clinical diagnosis. Escalate to in-person evaluation if lesion size, color, border, or symptoms change.';
  drawParagraph(doc, 'Recommendation', recommendation);
};

const generateDoctorCaseReportPdf = async (userId, caseId) => {
  try {
    const { doctorProfile, caseReview } = await fetchDoctorCaseForReport(userId, caseId);
    const buffer = await createPdfBuffer((doc) => renderCaseReportPdf(doc, caseReview, doctorProfile));

    // ===== SAVE PDF TO FILE SYSTEM =====
    const reportsDir = path.join(__dirname, '../../uploads/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileName = `MySkin_Doctor_Case_Report_${Date.now()}_${caseId}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const pdfUrl = `/uploads/reports/${fileName}`;

    // ===== SAVE TO DATABASE =====
    let reportId = null;
    let dbError = null;

    try {
      const patientUser = caseReview.scan?.patient?.user || {};
      const scan = caseReview.scan || {};

      console.log('[doctor.service.generateDoctorCaseReportPdf] DB Insert Info', {
        scanId: caseReview.scanId,
        patientId: scan.patientId,
        doctorId: doctorProfile.id,
        caseId
      });

      const report = await prisma.report.create({
        data: {
          scanId: caseReview.scanId,
          patientId: scan.patientId,
          title: `Doctor Case Report - ${caseId}`,
          description: `Case report for patient ${patientUser.name || 'Unknown'}. Case ID: ${caseId}`,
          diagnosis: caseReview.finalDiagnosis || 'Pending diagnosis',
          recommendation: caseReview.physicianObservation || 'No recommendation recorded',
          pdfUrl,
          status: 'completed',
          approvedByDoctorId: doctorProfile.id,
          approvedAt: new Date()
        }
      });

      reportId = report.reportId;
      console.log('[doctor.service.generateDoctorCaseReportPdf] Report saved successfully', { reportId, pdfUrl });
    } catch (dbErr) {
      dbError = dbErr;
      console.error('[doctor.service.generateDoctorCaseReportPdf] DB Error', {
        message: dbErr.message,
        code: dbErr.code,
        stack: dbErr.stack
      });
    }

    return {
      success: true,
      message: reportId 
        ? 'Case report PDF generated and saved successfully' 
        : 'Case report PDF generated (database save failed)',
      reportId,
      pdfUrl,
      fileName,
      caseId,
      patientName: caseReview.scan?.patient?.user?.name || 'Unknown',
      fileSize: buffer.length,
      generatedAt: new Date().toISOString(),
      dbError: dbError ? dbError.message : null
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    console.error('[doctor.service.generateDoctorCaseReportPdf] Outer Error', {
      userId,
      caseId,
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    throw createHttpError(`Failed to generate case report PDF: ${error.message}`, 500);
  }
};

const generateDoctorCaseHistoryPdf = async (userId, filters = {}) => {
  try {
    const doctorProfile = await getDoctorProfileForUser(userId);
    const whereClause = buildCaseHistoryWhere(doctorProfile.id, filters);
    const cases = await prisma.caseReview.findMany({
      where: whereClause,
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                    gender: true,
                    birthDate: true
                  }
                }
              }
            }
          }
        },
        observations: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { reviewedAt: 'desc' },
      take: 500
    });

    const buffer = await createPdfBuffer((doc) => {
      drawHeader(
        doc,
        'Doctor Case History',
        `Generated at ${formatDate(new Date())}`
      );

      drawSectionTitle(doc, 'Export Information');
      drawKeyValue(doc, 'Doctor', doctorProfile.user?.name || '-');
      drawKeyValue(doc, 'Email', doctorProfile.user?.email || '-');
      drawKeyValue(doc, 'Specialization', doctorProfile.specialization || '-');
      drawKeyValue(doc, 'Clinic', doctorProfile.clinic?.name || '-');
      drawKeyValue(doc, 'Total Cases', cases.length);
      drawKeyValue(doc, 'Filters', [
        filters.search ? `search=${filters.search}` : null,
        filters.diagnosis ? `diagnosis=${filters.diagnosis}` : null,
        filters.status ? `status=${filters.status}` : null,
        filters.startDate ? `startDate=${filters.startDate}` : null,
        filters.endDate ? `endDate=${filters.endDate}` : null
      ].filter(Boolean).join(', ') || 'No filters');

      const totalApproved = cases.filter((item) => item.reviewStatus === 'approved').length;
      const totalRejected = cases.filter((item) => item.reviewStatus === 'rejected').length;
      const averageConfidence = cases.length
        ? Math.round((cases.reduce((sum, item) => sum + (item.scan?.aiConfidence || 0), 0) / cases.length) * 100)
        : 0;

      drawSectionTitle(doc, 'Summary');
      drawKeyValue(doc, 'Approved Cases', totalApproved);
      drawKeyValue(doc, 'Rejected Cases', totalRejected);
      drawKeyValue(doc, 'Average AI Confidence', cases.length ? `${averageConfidence}%` : '-');

      drawSectionTitle(doc, 'Case Details');
      if (cases.length === 0) {
        drawParagraph(doc, 'No Data', 'No case history matched the selected filters.');
        return;
      }

      cases.forEach((caseReview, index) => {
        const patientUser = caseReview.scan?.patient?.user || {};
        const scan = caseReview.scan || {};
        ensureSpace(doc, 160);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#172033').text(`${index + 1}. ${caseReview.caseId}`);
        doc.moveDown(0.3);
        drawKeyValue(doc, 'Patient', `${patientUser.name || '-'} (${patientUser.gender || '-'}, ${calculateAge(patientUser.birthDate) || '-'} years)`);
        drawKeyValue(doc, 'Reviewed At', formatDate(caseReview.reviewedAt));
        drawKeyValue(doc, 'Status', normalizeReviewStatusLabel(caseReview.reviewStatus));
        drawKeyValue(doc, 'Body Site', scan.bodySite || '-');
        drawKeyValue(doc, 'AI Prediction', `${scan.aiPrediction || '-'}${scan.aiConfidence !== null && scan.aiConfidence !== undefined ? ` (${Math.round(scan.aiConfidence * 100)}%)` : ''}`);
        drawKeyValue(doc, 'Final Diagnosis', caseReview.finalDiagnosis || '-');
        drawParagraph(doc, 'Clinical Notes', caseReview.physicianObservation || scan.complaint || 'No clinical notes recorded.');
        if (caseReview.rejectionReason) {
          drawParagraph(doc, 'Rejection Reason', caseReview.rejectionReason);
        }
      });
    });

    // ===== SAVE PDF TO FILE SYSTEM =====
    const reportsDir = path.join(__dirname, '../../uploads/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileName = `MySkin_Doctor_Case_History_${Date.now()}_${doctorProfile.id}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const pdfUrl = `/uploads/reports/${fileName}`;

    // ===== SAVE TO DATABASE =====
    // Create a report record in the database
    let reportId = null;
    let dbError = null;

    if (cases.length > 0) {
      try {
        // Find first valid case with complete data
        let validCase = null;
        for (const caseItem of cases) {
          if (caseItem.scanId && caseItem.scan?.patientId) {
            validCase = caseItem;
            break;
          }
        }

        if (!validCase) {
          throw new Error('No valid cases with scan data found');
        }

        const filterDescription = [
          filters.search ? `search=${filters.search}` : null,
          filters.diagnosis ? `diagnosis=${filters.diagnosis}` : null,
          filters.status ? `status=${filters.status}` : null,
          filters.startDate ? `startDate=${filters.startDate}` : null,
          filters.endDate ? `endDate=${filters.endDate}` : null
        ].filter(Boolean).join(', ') || 'No filters';

        console.log('[doctor.service.generateDoctorCaseHistoryPdf] DB Insert Info', {
          scanId: validCase.scanId,
          patientId: validCase.scan?.patientId,
          doctorId: doctorProfile.id,
          caseCount: cases.length
        });

        const report = await prisma.report.create({
          data: {
            scanId: validCase.scanId,
            patientId: validCase.scan.patientId,
            title: `Doctor Case History Report - ${doctorProfile.user?.name || 'Unknown Doctor'}`,
            description: `Case history report containing ${cases.length} reviewed cases. Filters applied: ${filterDescription}`,
            diagnosis: `Batch Case History - ${cases.length} cases`,
            recommendation: `Review complete for ${cases.length} cases. Approved: ${cases.filter(c => c.reviewStatus === 'approved').length}, Rejected: ${cases.filter(c => c.reviewStatus === 'rejected').length}`,
            pdfUrl,
            status: 'completed',
            approvedByDoctorId: doctorProfile.id,
            approvedAt: new Date()
          }
        });

        reportId = report.reportId;
        console.log('[doctor.service.generateDoctorCaseHistoryPdf] Report saved successfully', { reportId, pdfUrl });
      } catch (dbErr) {
        dbError = dbErr;
        console.error('[doctor.service.generateDoctorCaseHistoryPdf] DB Error', {
          message: dbErr.message,
          code: dbErr.code,
          stack: dbErr.stack
        });
      }
    }

    return {
      success: true,
      message: reportId 
        ? 'Case history PDF generated and saved successfully' 
        : 'Case history PDF generated (database save failed)',
      reportId,
      pdfUrl,
      fileName,
      casesIncluded: cases.length,
      fileSize: buffer.length,
      approvedCases: cases.filter(c => c.reviewStatus === 'approved').length,
      rejectedCases: cases.filter(c => c.reviewStatus === 'rejected').length,
      dbError: dbError ? dbError.message : null
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    console.error('[doctor.service.generateDoctorCaseHistoryPdf] Outer Error', {
      userId,
      filters,
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    throw createHttpError(`Failed to generate case history PDF: ${error.message}`, 500);
  }
};

/**
 * Get patient evolution scans
 */
const getPatientEvolution = async (patientId) => {
  try {
    const cases = await prisma.caseReview.findMany({
      where: { scan: { patientId } },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true, gender: true, birthDate: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (cases.length === 0) {
      throw new Error('Patient not found');
    }

    const firstCase = cases[cases.length - 1]; // Oldest case
    const patient = cases[0].scan.patient;
    const patientBirthDate = patient.user.birthDate;
    const patientAge = patientBirthDate 
      ? new Date().getFullYear() - new Date(patientBirthDate).getFullYear()
      : null;

    // Calculate growth percentage (simplified)
    let growthPercentage = 0;
    if (cases.length > 1) {
      const firstConfidence = cases[cases.length - 1].scan.aiConfidence || 0;
      const lastConfidence = cases[0].scan.aiConfidence || 0;
      if (firstConfidence > 0) {
        growthPercentage = Math.round(((lastConfidence - firstConfidence) / firstConfidence) * 100);
      }
    }

    return {
      patient: {
        id: patientId,
        name: patient.user.name,
        age: patientAge,
        gender: patient.user.gender
      },
      evolution: cases.map((c, index) => ({
        caseId: c.caseId,
        date: c.createdAt.toISOString().split('T')[0],
        imageUrl: c.scan.imageUrl,
        prediction: c.scan.aiPrediction,
        confidence: c.scan.aiConfidence,
        diagnosis: c.finalDiagnosis,
        note: c.scan.complaint || 'Patient scan',
        growthPercentage: index === 0 ? growthPercentage : undefined
      }))
    };
  } catch (error) {
    throw new Error(`Failed to get patient evolution: ${error.message}`);
  }
};

// ==================== PROFILE SERVICES ====================

/**
 * Get doctor profile
 */
const getDoctorProfile = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'doctor') {
      throw new Error('User is not a doctor');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    return {
      doctorId: doctorProfile.id,
      fullName: user.name,
      email: user.email,
      gender: user.gender,
      role: user.role,
      phoneNumber: user.phone,
      birthDate: user.birthDate ? user.birthDate.toISOString().split('T')[0] : null,
      joinedAt: doctorProfile.joinedAt.toISOString().split('T')[0],
      profileImageUrl: user.avatarUrl || '',
      specialization: doctorProfile.specialization || 'Dermatology',
      practitionerStatus: {
        status: doctorProfile.verificationStatus,
        label: doctorProfile.verificationStatus === 'verified' ? 'Verified Doctor' : 'Pending Verification',
        description: `Your medical license and clinical specialization have been ${doctorProfile.verificationStatus} for Melanoma AI analysis.`
      }
    };
  } catch (error) {
    throw new Error(`Failed to get doctor profile: ${error.message}`);
  }
};

/**
 * Update doctor profile
 */
const updateDoctorProfile = async (userId, updates) => {
  try {
    const { fullName, phoneNumber, gender, birthDate } = updates;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: fullName,
        phone: phoneNumber,
        gender,
        birthDate: birthDate ? new Date(birthDate) : undefined
      }
    });

    return {
      success: true,
      message: 'Profile updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

/**
 * Update doctor profile photo
 */
const updateProfilePhoto = async (userId, photoPath) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: photoPath
      }
    });

    return {
      success: true,
      message: 'Profile photo updated successfully',
      imageUrl: photoPath
    };
  } catch (error) {
    throw new Error(`Failed to update profile photo: ${error.message}`);
  }
};

// ==================== SETTINGS SERVICES ====================

const getDoctorProfileOrThrow = async (userId) => {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId }
  });

  if (!doctorProfile) {
    throw new Error('Doctor profile not found');
  }

  return doctorProfile;
};

const getOrCreateDoctorSettings = async (doctorId) => {
  const existingSettings = await prisma.doctorSettings.findUnique({
    where: { doctorId }
  });

  if (existingSettings) {
    return existingSettings;
  }

  return prisma.doctorSettings.create({
    data: {
      doctorId,
      twoFactorEnabled: false,
      emailNotifications: true,
      verificationAlerts: true,
      dataVisibility: 'restricted_clinical_team_only',
      language: 'English (US)'
    }
  });
};

/**
 * Get doctor settings
 */
const getDoctorSettings = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'doctor') {
      throw new Error('User is not a doctor');
    }

    const doctorProfile = await getDoctorProfileOrThrow(userId);
    const settings = await getOrCreateDoctorSettings(doctorProfile.id);

    return {
      account: {
        email: user.email
      },
      notifications: {
        emailNotifications: settings.emailNotifications,
        verificationAlerts: settings.verificationAlerts
      },
      preferences: {
        language: settings.language
      }
    };
  } catch (error) {
    throw new Error(`Failed to get settings: ${error.message}`);
  }
};

/**
 * Update account settings (email/password)
 */
const updateAccountSettings = async (userId, updates) => {
  try {
    const { email, currentPassword, newPassword } = updates;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (newPassword) {
      const isPasswordValid = await verifyPassword(currentPassword, user.password);

      if (!isPasswordValid) {
        const error = new Error('Current password is incorrect');
        error.status = 400;
        throw error;
      }

      const isSamePassword = await verifyPassword(newPassword, user.password);
      if (isSamePassword) {
        const error = new Error('Password baru harus berbeda dari password sebelumnya');
        error.status = 400;
        throw error;
      }

      assertStrongPassword(newPassword, {
        email: user.email,
        name: user.name,
      });
      const hashedPassword = await hashPassword(newPassword, { validate: false });

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });
    }

    if (email !== undefined) {
      const normalizedEmail = validateAndNormalizeEmail(email);
      await ensureEmailAvailable(prisma, normalizedEmail, userId);

      await prisma.user.update({
        where: { id: userId },
        data: { email: normalizedEmail }
      });
    }

    return {
      success: true,
      message: 'Account settings updated successfully'
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }
    throw new Error(`Failed to update account settings: ${error.message}`);
  }
};

/**
 * Update 2FA settings
 */
const update2FASettings = async (userId, enabled) => {
  try {
    const doctorProfile = await getDoctorProfileOrThrow(userId);
    await getOrCreateDoctorSettings(doctorProfile.id);

    await prisma.doctorSettings.update({
      where: { doctorId: doctorProfile.id },
      data: { twoFactorEnabled: enabled }
    });

    return {
      success: true,
      message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`
    };
  } catch (error) {
    throw new Error(`Failed to update 2FA settings: ${error.message}`);
  }
};

/**
 * Update notification settings
 */
const updateNotificationSettings = async (userId, settings) => {
  try {
    const { emailNotifications, verificationAlerts } = settings;

    const doctorProfile = await getDoctorProfileOrThrow(userId);
    await getOrCreateDoctorSettings(doctorProfile.id);

    await prisma.doctorSettings.update({
      where: { doctorId: doctorProfile.id },
      data: {
        emailNotifications,
        verificationAlerts
      }
    });

    return {
      success: true,
      message: 'Notification settings updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update notification settings: ${error.message}`);
  }
};

/**
 * Update privacy settings
 */
const updatePrivacySettings = async (userId, settings) => {
  try {
    const { dataVisibility } = settings;

    const doctorProfile = await getDoctorProfileOrThrow(userId);
    await getOrCreateDoctorSettings(doctorProfile.id);

    await prisma.doctorSettings.update({
      where: { doctorId: doctorProfile.id },
      data: { dataVisibility }
    });

    return {
      success: true,
      message: 'Privacy settings updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update privacy settings: ${error.message}`);
  }
};

/**
 * Update preferences
 */
const updatePreferences = async (userId, settings) => {
  try {
    const { language } = settings;

    const doctorProfile = await getDoctorProfileOrThrow(userId);
    await getOrCreateDoctorSettings(doctorProfile.id);

    await prisma.doctorSettings.update({
      where: { doctorId: doctorProfile.id },
      data: { language }
    });

    return {
      success: true,
      message: 'Preferences updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update preferences: ${error.message}`);
  }
};

// ==================== NOTIFICATION SERVICES ====================

/**
 * Get doctor notifications
 */
const getDoctorNotifications = async (userId) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const notifications = await prisma.notification.findMany({
      where: { doctorId: doctorProfile.id },
      orderBy: { createdAt: 'desc' }
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return {
      unreadCount,
      data: notifications.map(n => ({
        notificationId: n.notificationId,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString()
      }))
    };
  } catch (error) {
    throw new Error(`Failed to get notifications: ${error.message}`);
  }
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (notificationId) => {
  try {
    await prisma.notification.update({
      where: { notificationId },
      data: { isRead: true }
    });

    return {
      success: true,
      message: 'Notification marked as read'
    };
  } catch (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = async (userId) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    await prisma.notification.updateMany({
      where: { doctorId: doctorProfile.id },
      data: { isRead: true }
    });

    return {
      success: true,
      message: 'All notifications marked as read'
    };
  } catch (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
};

module.exports = {
  // Dashboard
  getDashboardSummary,
  getAssignedCases,
  getCaseDetail,
  saveObservation,
  approveCase,
  rejectCase,

  // Case History
  getCaseHistory,
  generateDoctorCaseHistoryPdf,
  generateDoctorCaseReportPdf,
  getPatientEvolution,

  // Profile
  getDoctorProfile,
  updateDoctorProfile,
  updateProfilePhoto,

  // Settings
  getDoctorSettings,
  updateAccountSettings,
  update2FASettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updatePreferences,

  // Notifications
  getDoctorNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  saveCaseAnnotation,

  
};
