const doctorService = require('../services/doctor.service');
const fs = require('fs');
const path = require('path');


const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeOptionalString = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

// ==================== DASHBOARD CONTROLLERS ====================

/**
 * GET /api/v1/doctor/dashboard/summary
 */
const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const summary = await doctorService.getDashboardSummary(userId);

    res.status(200).json({
      status: 'success',
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

const saveAnnotation = async (req, res) => {
  try {
    // Ambil caseId dari URL parameter (contoh: /api/doctor/cases/CASE-123/annotation)
    const { caseId } = req.params; 
    
    // req.file didapat dari middleware Multer
    const fileData = req.file;

    if (!fileData) {
      return res.status(400).json({
        status: "error",
        message: "File gambar anotasi (coretan) wajib disertakan"
      });
    }

    // Panggil fungsi service
    const result = await doctorService.saveCaseAnnotation(caseId, fileData);

    res.status(200).json({
      status: "success",
      message: result.message,
      data: {
        annotatedImageUrl: result.annotatedImageUrl
      }
    });
  } catch (err) {
    console.error("Error saveAnnotation:", err.message);
    if (err.message.includes('not found') || err.message.includes('tidak ditemukan')) {
      return res.status(404).json({
        status: "error",
        message: "Case not found"
      });
    }

    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

/**
 * GET /api/v1/doctor/cases/assigned
 */
const getAssignedCases = async (req, res) => {
  try {
    const userId = req.user.id;
    const cases = await doctorService.getAssignedCases(userId);

    res.status(200).json({
      status: 'success',
      data: cases
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * GET /api/v1/doctor/cases/:caseId
 */
const getCaseDetail = async (req, res) => {
  try {
    const { caseId } = req.params;

    if (!caseId) {
      return res.status(400).json({
        status: 'error',
        message: 'caseId is required'
      });
    }

    const caseDetail = await doctorService.getCaseDetail(caseId);

    res.status(200).json({
      status: 'success',
      data: caseDetail
    });
  } catch (error) {
    if (error.message.includes('Case not found')) {
      return res.status(404).json({
        status: 'error',
        message: 'Case not found'
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * POST /api/v1/doctor/cases/:caseId/observation
 */
const saveObservation = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { physicianObservation } = req.body;
    const userId = req.user.id;

    // Validation
    if (!caseId) {
      return res.status(400).json({
        status: 'error',
        message: 'caseId is required'
      });
    }

    if (!physicianObservation || physicianObservation.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'physicianObservation is required'
      });
    }

    const result = await doctorService.saveObservation(caseId, userId, physicianObservation);

    res.status(201).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: 'Case not found'
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/cases/:caseId/approve
 */
const approveCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    console.log("Approve/Reject body:", req.body);
    const physicianObservation = req.body.physicianObservation?.trim();
    const finalDiagnosis = req.body.finalDiagnosis?.trim();
    const userId = req.user.id;

    // Validation
    if (!caseId) {
      return res.status(400).json({
        status: 'error',
        message: 'caseId is required'
      });
    }

    if (!physicianObservation || physicianObservation.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Physician observation is required before approving this case.'
      });
    }

    if (!finalDiagnosis || finalDiagnosis === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Final diagnosis is required before approving this case.'
      });
    }

    const result = await doctorService.approveCase(caseId, userId, physicianObservation, finalDiagnosis);

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        caseId: result.caseId,
        scanId: result.scanId,
        requestId: result.requestId
      }
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: 'Case not found'
      });
    }

    if (error.message.includes('sudah')) {
      return res.status(400).json({
        status: 'error',
        message: error.message.replace(/^Failed to approve case: /, '')
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/cases/:caseId/reject
 */
const rejectCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    console.log("Approve/Reject body:", req.body);
    const reason = req.body.reason?.trim();
    const physicianObservation = req.body.physicianObservation?.trim();
    const finalDiagnosis = req.body.finalDiagnosis?.trim();
    const userId = req.user.id;

    // Validation
    if (!caseId) {
      return res.status(400).json({
        status: 'error',
        message: 'caseId is required'
      });
    }

    if (!reason || reason === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Rejection reason is required before rejecting this case.'
      });
    }

    if (!physicianObservation || physicianObservation === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Physician observation is required before rejecting this case.'
      });
    }

    if (!finalDiagnosis || finalDiagnosis === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Final diagnosis is required before rejecting this case.'
      });
    }

    const result = await doctorService.rejectCase(caseId, userId, reason, physicianObservation, finalDiagnosis);

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        caseId: result.caseId,
        scanId: result.scanId,
        requestId: result.requestId
      }
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: 'Case not found'
      });
    }

    if (error.message.includes('sudah')) {
      return res.status(400).json({
        status: 'error',
        message: error.message.replace(/^Failed to reject case: /, '')
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// ==================== CASE HISTORY CONTROLLERS ====================

/**
 * GET /api/v1/doctor/cases/history
 */
const getCaseHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      console.warn('[doctor.caseHistory] Missing user id from token payload', {
        user: req.user
      });

      return res.status(401).json({
        status: 'error',
        message: 'User ID tidak ditemukan pada token'
      });
    }

    const { search, diagnosis, status, startDate, endDate, page = 1, limit = 10 } = req.query;

    const filters = {
      search: normalizeOptionalString(search),
      diagnosis: normalizeOptionalString(diagnosis),
      status: normalizeOptionalString(status),
      startDate: normalizeOptionalString(startDate),
      endDate: normalizeOptionalString(endDate),
      page: parsePositiveInteger(page, 1),
      limit: Math.min(parsePositiveInteger(limit, 10), 100)
    };

    console.info('[doctor.caseHistory] Request', {
      userId,
      role: req.user?.role,
      filters
    });

    const result = await doctorService.getCaseHistory(userId, filters);

    res.status(200).json({
      status: 'success',
      ...result
    });
  } catch (error) {
    console.error('[doctor.caseHistory] Failed', {
      message: error.message,
      stack: error.stack
    });

    const statusCode = Number.isInteger(error.status) ? error.status : 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * GET /api/v1/doctor/cases/history/download
 */
const downloadCaseHistoryPdf = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'User ID tidak ditemukan pada token'
      });
    }

    const { search, diagnosis, status, startDate, endDate } = req.query;
    const filters = {
      search: normalizeOptionalString(search),
      diagnosis: normalizeOptionalString(diagnosis),
      status: normalizeOptionalString(status),
      startDate: normalizeOptionalString(startDate),
      endDate: normalizeOptionalString(endDate)
    };

    const result = await doctorService.generateDoctorCaseHistoryPdf(userId, filters);

    // Return JSON response with PDF URL and metadata
    return res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        reportId: result.reportId,
        pdfUrl: result.pdfUrl,
        fileName: result.fileName,
        casesIncluded: result.casesIncluded,
        approvedCases: result.approvedCases,
        rejectedCases: result.rejectedCases,
        fileSize: result.fileSize,
        generatedAt: new Date().toISOString()
      },
      ...(result.dbError && { dbError: result.dbError })
    });
  } catch (error) {
    const statusCode = Number.isInteger(error.status) ? error.status : 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * GET/POST /api/v1/doctor/cases/:caseId/report
 */
const generateCaseReportPdf = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { caseId } = req.params;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'User ID tidak ditemukan pada token'
      });
    }

    if (!caseId) {
      return res.status(400).json({
        status: 'error',
        message: 'caseId is required'
      });
    }

    const result = await doctorService.generateDoctorCaseReportPdf(userId, caseId);

    // Return JSON response with PDF URL and metadata
    return res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        reportId: result.reportId,
        pdfUrl: result.pdfUrl,
        fileName: result.fileName,
        caseId: result.caseId,
        patientName: result.patientName,
        fileSize: result.fileSize,
        generatedAt: result.generatedAt
      },
      ...(result.dbError && { dbError: result.dbError })
    });
  } catch (error) {
    const statusCode = Number.isInteger(error.status) ? error.status : 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * GET /api/v1/doctor/patients/:patientId/evolution
 */
const getPatientEvolution = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        status: 'error',
        message: 'patientId is required'
      });
    }

    const result = await doctorService.getPatientEvolution(patientId);

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    if (error.message === 'Patient not found') {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// ==================== PROFILE CONTROLLERS ====================

/**
 * GET /api/v1/doctor/profile
 */
const getDoctorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await doctorService.getDoctorProfile(userId);

    res.status(200).json({
      status: 'success',
      data: profile
    });
  } catch (error) {
    if (error.message === 'User is not a doctor' || error.message === 'Doctor profile not found') {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/profile
 */
const updateDoctorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, phoneNumber, gender, birthDate } = req.body;

    // Validation
    if (!fullName && !phoneNumber && !gender && !birthDate) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one field must be provided for update'
      });
    }

    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (gender) updates.gender = gender;
    if (birthDate) updates.birthDate = birthDate;

    const result = await doctorService.updateDoctorProfile(userId, updates);

    res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/profile/photo
 */
const updateProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Photo file is required'
      });
    }

    // 1. Buat nama file unik secara manual (karena memoryStorage tidak membuatkan nama file)
    const ekstensi = req.file.originalname.split('.').pop();
    const filename = `doctor_${userId}_${Date.now()}.${ekstensi}`;

    // 2. Tentukan lokasi folder penyimpanan (pastikan path ini sesuai dengan struktur foldermu)
    // Asumsi controller ada di src/controllers/, maka kita naik 2 tingkat (../../) ke root
    const uploadDir = path.join(__dirname, '../../uploads/doctors'); 
    const filepath = path.join(uploadDir, filename);

    // 3. Cek apakah folder uploads/doctors sudah ada, jika belum buat otomatis
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 4. SIMPAN FILE KE HARDISK (Tulis data buffer dari RAM ke folder fisik)
    fs.writeFileSync(filepath, req.file.buffer);

    // 5. Build path foto untuk disimpan ke database
    const photoPath = `/uploads/doctors/${filename}`;

    // 6. Panggil service untuk update database
    const result = await doctorService.updateProfilePhoto(userId, photoPath);

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: { imageUrl: result.imageUrl }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// ==================== SETTINGS CONTROLLERS ====================

/**
 * GET /api/v1/doctor/settings
 */
const getDoctorSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await doctorService.getDoctorSettings(userId);

    res.status(200).json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/settings/account
 */
const updateAccountSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, currentPassword, newPassword } = req.body;

    if (!email && !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Either email or newPassword must be provided'
      });
    }

    const updates = {};
    if (email) updates.email = email;
    if (newPassword) {
      updates.currentPassword = currentPassword;
      updates.newPassword = newPassword;
    }

    const result = await doctorService.updateAccountSettings(userId, updates);

    res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    if (error.status === 400 || error.status === 409) {
      return res.status(error.status).json({
        status: 'error',
        message: error.message
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/settings/2fa
 */
const update2FASettings = async (req, res) => {
  return res.status(410).json({
    status: 'error',
    message: 'Two-factor settings are no longer supported'
  });
};

/**
 * PATCH /api/v1/doctor/settings/notifications
 */
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { emailNotifications, verificationAlerts } = req.body;

    if (emailNotifications === undefined && verificationAlerts === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one notification setting must be provided'
      });
    }

    const settings = {};
    if (emailNotifications !== undefined) settings.emailNotifications = emailNotifications;
    if (verificationAlerts !== undefined) settings.verificationAlerts = verificationAlerts;

    const result = await doctorService.updateNotificationSettings(userId, settings);

    res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/settings/privacy
 */
const updatePrivacySettings = async (req, res) => {
  return res.status(410).json({
    status: 'error',
    message: 'Privacy settings are no longer supported'
  });
};

/**
 * PATCH /api/v1/doctor/settings/preferences
 */
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { language } = req.body;

    if (!language) {
      return res.status(400).json({
        status: 'error',
        message: 'language is required'
      });
    }

    const allowedLanguages = ['English (US)', 'Bahasa Indonesia'];
    if (!allowedLanguages.includes(language)) {
      return res.status(400).json({
        status: 'error',
        message: 'language must be English (US) or Bahasa Indonesia'
      });
    }

    const result = await doctorService.updatePreferences(userId, { language });

    res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// ==================== NOTIFICATION CONTROLLERS ====================

/**
 * GET /api/v1/doctor/notifications
 */
const getDoctorNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await doctorService.getDoctorNotifications(userId);

    res.status(200).json({
      status: 'success',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/notifications/:notificationId/read
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        status: 'error',
        message: 'notificationId is required'
      });
    }

    const result = await doctorService.markNotificationAsRead(notificationId);

    res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * PATCH /api/v1/doctor/notifications/read-all
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await doctorService.markAllNotificationsAsRead(userId);

    res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
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
  downloadCaseHistoryPdf,
  generateCaseReportPdf,
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
  saveAnnotation
};
