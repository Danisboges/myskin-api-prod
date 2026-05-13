/**
 * Patient Controller
 * Menangani semua request untuk endpoint patient
 */

const patientService = require('../services/patient.service');

// ==================== DASHBOARD ====================

const getDashboard = async (req, res) => {
  try {
    // req.user.id didapat dari middleware otentikasi JWT
    const userId = req.user.id; 

    // Panggil service untuk mengambil data asli dari database
    const dashboardData = await patientService.getDashboard(userId);

    // Kirim response ke Postman/Frontend
    res.status(200).json({
      status: "success",
      data: dashboardData
    });
  } catch (err) {
    console.error("Error getDashboard:", err.message);
    
    // Tangani error jika user tidak ditemukan atau ada masalah database
    if (err.message === "Data pasien tidak ditemukan") {
      return res.status(404).json({
        status: "error",
        message: err.message
      });
    }

    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan pada server"
    });
  }
};

// ==================== SCAN MANAGEMENT ====================

const uploadScan = async (req, res) => {
  try {
    const { complaint, bodySite } = req.body;
    const result = await patientService.uploadScan(req.user.id, req.file, complaint, bodySite);
    
    res.status(201).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error uploadScan:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const analyzeScan = async (req, res) => {
  try {
    const { scanId } = req.params;
    const result = await patientService.analyzeScan(req.user.id, scanId);
    
    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error analyzeScan:", err.message);
    if (err.message.includes('not found')) {
      return res.status(404).json({
        status: "error",
        message: err.message
      });
    }
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const getScanAnalysis = async (req, res) => {
  try {
    const { scanId } = req.params;
    const result = await patientService.getScanAnalysis(req.user.id, scanId);
    
    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error getScanAnalysis:", err.message);
    if (err.message.includes('not found') || err.message.includes('unauthorized')) {
      return res.status(404).json({
        status: "error",
        message: err.message
      });
    }
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const getRecentScans = async (req, res) => {
  try {
    const result = await patientService.getRecentScans(req.user.id, req.pagination);
    
    res.status(200).json({
      status: "success",
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    console.error("Error getRecentScans:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const getScanHistory = async (req, res) => {
  try {
    const filters = {
      bodySite: req.query.bodySite,
      isAnalyzed: req.query.isAnalyzed
    };
    
    const result = await patientService.getScanHistory(req.user.id, req.pagination, filters);
    
    res.status(200).json({
      status: "success",
      data: result.data,
      pagination: result.pagination,
      filters
    });
  } catch (err) {
    console.error("Error getScanHistory:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const getScanDetail = async (req, res) => {
  try {
    const { scanId } = req.params;
    const doctorUserId = req.query.doctorUserId; // Get doctor's userId from query params
    const result = await patientService.getScanDetail(req.user.id, scanId, doctorUserId);
    
    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error getScanDetail:", err.message);
    if (err.message.includes('not found') || err.message.includes('unauthorized')) {
      return res.status(404).json({
        status: "error",
        message: err.message
      });
    }
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const shareScan = async (req, res) => {
  try {
    const { scanId } = req.params;
    const { doctorUserId } = req.body; // Doctor's userId, not doctorId
    const result = await patientService.shareScanWithDoctor(req.user.id, scanId, doctorUserId);
    
    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error shareScan:", err.message);
    if (err.message.includes('not found') || err.message.includes('unauthorized')) {
      return res.status(404).json({
        status: "error",
        message: err.message
      });
    }
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const exportScanPDF = async (req, res) => {
  try {
    const { scanId } = req.params;
    // Implementation untuk export PDF
    // Untuk sekarang return message
    res.status(200).json({
      status: "success",
      message: "PDF export feature coming soon",
      scanId
    });
  } catch (err) {
    console.error("Error exportScanPDF:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ==================== REPORT MANAGEMENT ====================

const getPatientReports = async (req, res) => {
  try {
    const filters = {
      status: req.query.status
    };
    
    const result = await patientService.getPatientReports(req.user.id, req.pagination, filters);
    
    res.status(200).json({
      status: "success",
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    console.error("Error getPatientReports:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const getReportDetail = async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await patientService.getReportDetail(req.user.id, reportId);
    
    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error getReportDetail:", err.message);
    if (err.message.includes('not found') || err.message.includes('unauthorized')) {
      return res.status(404).json({
        status: "error",
        message: err.message
      });
    }
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const downloadReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await patientService.exportReportPDF(req.user.id, reportId);
    
    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error downloadReport:", err.message);
    if (err.message.includes('not found') || err.message.includes('unauthorized')) {
      return res.status(404).json({
        status: "error",
        message: err.message
      });
    }
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const previewReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await patientService.getReportDetail(req.user.id, reportId);
    
    res.status(200).json({
      status: "success",
      data: {
        reportId: result.reportId,
        title: result.title,
        diagnosis: result.diagnosis,
        recommendation: result.recommendation,
        scan: result.scan,
        createdAt: result.createdAt
      }
    });
  } catch (err) {
    console.error("Error previewReport:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ==================== PROFILE MANAGEMENT ====================

const getProfile = async (req, res) => {
  try {
    const profile = await patientService.getPatientProfile(req.user.id);
    
    res.status(200).json({
      status: "success",
      data: profile
    });
  } catch (err) {
    console.error("Error getProfile:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const profile = await patientService.updatePatientProfile(req.user.id, req.body);
    
    res.status(200).json({
      status: "success",
      data: profile
    });
  } catch (err) {
    console.error("Error updateProfile:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const updateProfilePhoto = async (req, res) => {
  try {
    const result = await patientService.updateProfilePhoto(req.user.id, req.file);
    
    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error updateProfilePhoto:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ==================== SETTINGS MANAGEMENT ====================

const getSettings = async (req, res) => {
  try {
    const settings = await patientService.getPatientSettings(req.user.id);
    
    res.status(200).json({
      status: "success",
      data: settings
    });
  } catch (err) {
    console.error("Error getSettings:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const updateAccountSettings = async (req, res) => {
  try {
    const settings = await patientService.updateAccountSettings(req.user.id, req.body);
    
    res.status(200).json({
      status: "success",
      data: settings,
      message: "Account settings updated successfully"
    });
  } catch (err) {
    console.error("Error updateAccountSettings:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const updateNotificationSettings = async (req, res) => {
  try {
    const settings = await patientService.updateNotificationSettings(req.user.id, req.body);
    
    res.status(200).json({
      status: "success",
      data: settings,
      message: "Notification settings updated successfully"
    });
  } catch (err) {
    console.error("Error updateNotificationSettings:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const updateTwoFactor = async (req, res) => {
  try {
    const { twoFactorEnabled } = req.body;
    const settings = await patientService.updateAccountSettings(req.user.id, { twoFactorEnabled });
    
    res.status(200).json({
      status: "success",
      data: settings,
      message: "Two-factor authentication settings updated successfully"
    });
  } catch (err) {
    console.error("Error updateTwoFactor:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const updatePrivacySettings = async (req, res) => {
  try {
    const settings = await patientService.updatePrivacySettings(req.user.id, req.body);
    
    res.status(200).json({
      status: "success",
      data: settings,
      message: "Privacy settings updated successfully"
    });
  } catch (err) {
    console.error("Error updatePrivacySettings:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const updatePreferences = async (req, res) => {
  try {
    const settings = await patientService.updatePreferences(req.user.id, req.body);
    
    res.status(200).json({
      status: "success",
      data: settings,
      message: "Preferences updated successfully"
    });
  } catch (err) {
    console.error("Error updatePreferences:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ==================== NOTIFICATION MANAGEMENT ====================

const getNotifications = async (req, res) => {
  try {
    const result = await patientService.getPatientNotifications(req.user.id, req.pagination);
    
    res.status(200).json({
      status: "success",
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    console.error("Error getNotifications:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const result = await patientService.markNotificationAsRead(req.user.id, notificationId);
    
    res.status(200).json({
      status: "success",
      data: result,
      message: "Notification marked as read"
    });
  } catch (err) {
    console.error("Error markNotificationAsRead:", err.message);
    if (err.message.includes('not found')) {
      return res.status(404).json({
        status: "error",
        message: err.message
      });
    }
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await patientService.markAllNotificationsAsRead(req.user.id);
    
    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error markAllNotificationsAsRead:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ==================== DOCTOR & VERIFICATION ====================

const getAvailableDoctors = async (req, res) => {
  try {
    const doctors = await patientService.getAvailableDoctors();
    
    res.status(200).json({
      status: "success",
      data: doctors
    });
  } catch (err) {
    console.error("Error getAvailableDoctors:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

const submitVerificationRequest = async (req, res) => {
  try {
    const { message } = req.body;
    const result = await patientService.submitVerificationRequest(req.user.id, message);
    
    res.status(201).json({
      status: "success",
      data: result
    });
  } catch (err) {
    console.error("Error submitVerificationRequest:", err.message);
    res.status(400).json({
      status: "error",
      message: err.message
    });
  }
};

module.exports = {
  // Dashboard
  getDashboard,
  // Scans
  uploadScan,
  analyzeScan,
  getScanAnalysis,
  getRecentScans,
  getScanHistory,
  getScanDetail,
  shareScan,
  exportScanPDF,
  // Reports
  getPatientReports,
  getReportDetail,
  downloadReport,
  previewReport,
  // Profile
  getProfile,
  updateProfile,
  updateProfilePhoto,
  // Settings
  getSettings,
  updateAccountSettings,
  updateNotificationSettings,
  updateTwoFactor,
  updatePrivacySettings,
  updatePreferences,
  // Notifications
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  // Doctors & Verification
  getAvailableDoctors,
  submitVerificationRequest
};
