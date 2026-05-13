const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const { verifyToken, isDoctor } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// ==================== DASHBOARD ROUTES ====================

/**
 * GET /api/v1/doctor/dashboard/summary
 * Get doctor dashboard summary
 */
router.get('/dashboard/summary', verifyToken, isDoctor, doctorController.getDashboardSummary);

/**
 * GET /api/v1/doctor/cases/assigned
 * Get assigned cases for doctor
 */
router.get('/cases/assigned', verifyToken, isDoctor, doctorController.getAssignedCases);

/**
 * GET /api/v1/doctor/cases/:caseId
 * Get case details
 */
router.get('/cases/:caseId', verifyToken, isDoctor, doctorController.getCaseDetail);

/**
 * POST /api/v1/doctor/cases/:caseId/observation
 * Save physician observation
 */
router.post('/cases/:caseId/observation', verifyToken, isDoctor, doctorController.saveObservation);

/**
 * PATCH /api/v1/doctor/cases/:caseId/approve
 * Approve AI diagnosis
 */
router.patch('/cases/:caseId/approve', verifyToken, isDoctor, doctorController.approveCase);

/**
 * PATCH /api/v1/doctor/cases/:caseId/reject
 * Reject AI diagnosis
 */
router.patch('/cases/:caseId/reject', verifyToken, isDoctor, doctorController.rejectCase);

// ==================== CASE HISTORY ROUTES ====================

/**
 * GET /api/v1/doctor/cases/history
 * Get case history with filters
 */
router.get('/cases/history', verifyToken, isDoctor, doctorController.getCaseHistory);

/**
 * GET /api/v1/doctor/patients/:patientId/evolution
 * Get patient lesion evolution
 */
router.get('/patients/:patientId/evolution', verifyToken, isDoctor, doctorController.getPatientEvolution);

// ==================== PROFILE ROUTES ====================

/**
 * GET /api/v1/doctor/profile
 * Get doctor profile
 */
router.get('/profile', verifyToken, isDoctor, doctorController.getDoctorProfile);

/**
 * PATCH /api/v1/doctor/profile
 * Update doctor profile
 */
router.patch('/profile', verifyToken, isDoctor, doctorController.updateDoctorProfile);

/**
 * PATCH /api/v1/doctor/profile/photo
 * Update doctor profile photo
 */
router.patch('/profile/photo', verifyToken, isDoctor, upload.single('photo'), doctorController.updateProfilePhoto);

// ==================== SETTINGS ROUTES ====================

/**
 * GET /api/v1/doctor/settings
 * Get all doctor settings
 */
router.get('/settings', verifyToken, isDoctor, doctorController.getDoctorSettings);

/**
 * PATCH /api/v1/doctor/settings/account
 * Update account settings (email/password)
 */
router.patch('/settings/account', verifyToken, isDoctor, doctorController.updateAccountSettings);

/**
 * PATCH /api/v1/doctor/settings/2fa
 * Update 2FA settings
 */
router.patch('/settings/2fa', verifyToken, isDoctor, doctorController.update2FASettings);

/**
 * PATCH /api/v1/doctor/settings/notifications
 * Update notification settings
 */
router.patch('/settings/notifications', verifyToken, isDoctor, doctorController.updateNotificationSettings);

/**
 * PATCH /api/v1/doctor/settings/privacy
 * Update privacy settings
 */
router.patch('/settings/privacy', verifyToken, isDoctor, doctorController.updatePrivacySettings);

/**
 * PATCH /api/v1/doctor/settings/preferences
 * Update preferences
 */
router.patch('/settings/preferences', verifyToken, isDoctor, doctorController.updatePreferences);

// ==================== NOTIFICATION ROUTES ====================

/**
 * GET /api/v1/doctor/notifications
 * Get doctor notifications
 */
router.get('/notifications', verifyToken, isDoctor, doctorController.getDoctorNotifications);

/**
 * PATCH /api/v1/doctor/notifications/:notificationId/read
 * Mark notification as read
 */
router.patch('/notifications/:notificationId/read', verifyToken, isDoctor, doctorController.markNotificationAsRead);

/**
 * PATCH /api/v1/doctor/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/notifications/read-all', verifyToken, isDoctor, doctorController.markAllNotificationsAsRead);

module.exports = router;
