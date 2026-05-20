/**
 * Patient Routes
 * /api/v1/patient/*
 * 
 * All endpoints require JWT authentication and patient role
 */

const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const { verifyToken, isPatient } = require('../middlewares/auth.middleware');
const { upload, uploadSingleFile, handleUploadError } = require('../middlewares/upload.middleware');
const {
  validateScanUpload,
  validateScanAnalyze,
  validateScanShare,
  validateProfileUpdate,
  validateProfilePhotoUpdate,
  validateSettingsUpdate,
  validateVerificationRequest,
  validateNotificationRead,
  validatePaginationParams
} = require('../validators/patient.validator');

// ==================== MIDDLEWARE ====================
// Apply JWT verification dan role checking ke semua routes
router.use(verifyToken, isPatient);

// ==================== DASHBOARD ROUTES ====================

/**
 * GET /api/v1/patient/dashboard
 * Get patient dashboard/overview
 */
router.get('/dashboard', patientController.getDashboard);

// ==================== SCAN ROUTES ====================

/**
 * POST /api/v1/patient/scans/upload
 * Upload lesion image for analysis
 */
router.post(
  '/scans/upload',
  uploadSingleFile('image'),
  validateScanUpload,
  patientController.uploadScan
);

/**
 * POST /api/v1/patient/scans/:scanId/analyze
 * Trigger AI analysis on uploaded scan
 */
router.post(
  '/scans/:scanId/analyze',
  validateScanAnalyze,
  patientController.analyzeScan
);

/**
 * GET /api/v1/patient/scans/:scanId/analysis
 * Get scan analysis results
 */
router.get(
  '/scans/:scanId/analysis',
  patientController.getScanAnalysis
);

/**
 * GET /api/v1/patient/scans/recent
 * Get recent scans (5 most recent)
 */
router.get(
  '/scans/recent',
  validatePaginationParams,
  patientController.getRecentScans
);

/**
 * GET /api/v1/patient/scans/history
 * Get scan history with filters and pagination
 * Query params: page, limit, bodySite, isAnalyzed, sortBy, order
 */
router.get(
  '/scans/history',
  validatePaginationParams,
  patientController.getScanHistory
);

/**
 * GET /api/v1/patient/scans/:scanId
 * Get scan details
 */
router.get(
  '/scans/:scanId',
  patientController.getScanDetail
);

/**
 * GET /api/v1/patient/scans/:scanId/export-pdf
 * Export scan analysis as PDF
 */
router.get(
  '/scans/:scanId/export-pdf',
  patientController.exportScanPDF
);

/**
 * POST /api/v1/patient/scans/:scanId/share
 * Share scan with specific doctor
 */
router.post(
  '/scans/:scanId/share',
  validateScanShare,
  patientController.shareScan
);

// ==================== REPORT ROUTES ====================

/**
 * GET /api/v1/patient/reports
 * Get patient reports with pagination
 * Query params: page, limit, status, sortBy, order
 */
router.get(
  '/reports',
  validatePaginationParams,
  patientController.getPatientReports
);

/**
 * GET /api/v1/patient/reports/:reportId
 * Get report details
 */
router.get(
  '/reports/:reportId',
  patientController.getReportDetail
);

/**
 * GET /api/v1/patient/reports/:reportId/download
 * Download report as PDF
 */
router.get(
  '/reports/:reportId/download',
  patientController.downloadReport
);

/**
 * GET /api/v1/patient/reports/:reportId/preview
 * Preview report content
 */
router.get(
  '/reports/:reportId/preview',
  patientController.previewReport
);

// ==================== PROFILE ROUTES ====================

/**
 * GET /api/v1/patient/profile
 * Get patient profile
 */
router.get(
  '/profile',
  patientController.getProfile
);

/**
 * PATCH /api/v1/patient/profile
 * Update patient profile
 */
router.patch(
  '/profile',
  validateProfileUpdate,
  patientController.updateProfile
);

/**
 * PATCH /api/v1/patient/profile/photo
 * Update profile photo
 */
router.patch(
  '/profile/photo',
  uploadSingleFile('photo'),
  validateProfilePhotoUpdate,
  patientController.updateProfilePhoto
);

// ==================== SETTINGS ROUTES ====================

/**
 * GET /api/v1/patient/settings
 * Get all patient settings
 */
router.get(
  '/settings',
  patientController.getSettings
);

/**
 * PATCH /api/v1/patient/settings/account
 * Update account settings (2FA, etc)
 */
router.patch(
  '/settings/account',
  validateSettingsUpdate,
  patientController.updateAccountSettings
);

/**
 * PATCH /api/v1/patient/settings/2fa
 * Update two-factor authentication settings
 */
router.patch(
  '/settings/2fa',
  validateSettingsUpdate,
  patientController.updateTwoFactor
);

/**
 * PATCH /api/v1/patient/settings/notifications
 * Update notification preferences
 */
router.patch(
  '/settings/notifications',
  validateSettingsUpdate,
  patientController.updateNotificationSettings
);

/**
 * PATCH /api/v1/patient/settings/privacy
 * Update privacy settings
 */
router.patch(
  '/settings/privacy',
  validateSettingsUpdate,
  patientController.updatePrivacySettings
);

/**
 * PATCH /api/v1/patient/settings/preferences
 * Update general preferences (language, theme, etc)
 */
router.patch(
  '/settings/preferences',
  validateSettingsUpdate,
  patientController.updatePreferences
);

// ==================== NOTIFICATION ROUTES ====================

/**
 * GET /api/v1/patient/notifications
 * Get patient notifications with pagination
 * Query params: page, limit, sortBy, order
 */
router.get(
  '/notifications',
  validatePaginationParams,
  patientController.getNotifications
);

/**
 * PATCH /api/v1/patient/notifications/:notificationId/read
 * Mark notification as read
 */
router.patch(
  '/notifications/:notificationId/read',
  validateNotificationRead,
  patientController.markNotificationAsRead
);

/**
 * PATCH /api/v1/patient/notifications/read-all
 * Mark all notifications as read
 */
router.patch(
  '/notifications/read-all',
  patientController.markAllNotificationsAsRead
);

// ==================== DOCTOR & VERIFICATION ROUTES ====================

/**
 * GET /api/v1/patient/doctors/available
 * Get list of available doctors
 */
router.get(
  '/doctors/available',
  patientController.getAvailableDoctors
);

/**
 * POST /api/v1/patient/verification-requests
 * Submit request for doctor verification
 */
router.post(
  '/verification-requests',
  validateVerificationRequest,
  patientController.submitVerificationRequest
);

module.exports = router;
