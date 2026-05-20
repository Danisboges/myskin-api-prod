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
    if (error.message === 'Case not found') {
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
 * PATCH /api/v1/doctor/cases/:caseId/approve
 */
const approveCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { physicianObservation, finalDiagnosis } = req.body;
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

    if (!finalDiagnosis || finalDiagnosis.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'finalDiagnosis is required'
      });
    }

    const result = await doctorService.approveCase(caseId, userId, physicianObservation, finalDiagnosis);

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: { caseId: result.caseId }
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
 * PATCH /api/v1/doctor/cases/:caseId/reject
 */
const rejectCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { reason, physicianObservation, finalDiagnosis } = req.body;
    const userId = req.user.id;

    // Validation
    if (!caseId) {
      return res.status(400).json({
        status: 'error',
        message: 'caseId is required'
      });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'reason is required'
      });
    }

    if (!physicianObservation || physicianObservation.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'physicianObservation is required'
      });
    }

    if (!finalDiagnosis || finalDiagnosis.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'finalDiagnosis is required'
      });
    }

    const result = await doctorService.rejectCase(caseId, userId, reason, physicianObservation, finalDiagnosis);

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: { caseId: result.caseId }
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
    if (error.message === 'Current password is incorrect') {
      return res.status(400).json({
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
  try {
    const userId = req.user.id;
    const { enabled } = req.body;

    if (enabled === undefined || enabled === null) {
      return res.status(400).json({
        status: 'error',
        message: 'enabled field is required'
      });
    }

    const result = await doctorService.update2FASettings(userId, enabled);

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
  try {
    const userId = req.user.id;
    const { dataVisibility } = req.body;

    if (!dataVisibility) {
      return res.status(400).json({
        status: 'error',
        message: 'dataVisibility is required'
      });
    }

    const validVisibilities = ['restricted_clinical_team_only', 'restricted_self_only', 'shared_with_clinic'];
    if (!validVisibilities.includes(dataVisibility)) {
      return res.status(400).json({
        status: 'error',
        message: `dataVisibility must be one of: ${validVisibilities.join(', ')}`
      });
    }

    const result = await doctorService.updatePrivacySettings(userId, { dataVisibility });

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
  markAllNotificationsAsRead
};
