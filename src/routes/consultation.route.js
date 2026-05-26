/**
 * Consultation Routes
 * API endpoints untuk consultation feature
 */

const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultation.controller');
const { verifyToken, isDoctor, isPatient } = require('../middlewares/auth.middleware');
const { uploadMultipleFiles } = require('../middlewares/upload.middleware');

const enforceMountedRole = (req, res, next) => {
  if (req.baseUrl.includes('/doctor/consultations')) {
    return isDoctor(req, res, next);
  }

  if (req.baseUrl.includes('/patient/consultations')) {
    return isPatient(req, res, next);
  }

  return next();
};

router.use(verifyToken, enforceMountedRole);

// ==================== PATIENT ROUTES ====================

/**
 * POST /api/v1/patient/consultations/initiate
 * Initiate new consultation
 */
router.post(
  '/initiate',
  verifyToken,
  consultationController.initiateConsultation
);

/**
 * GET /api/v1/patient/consultations
 * Get consultation list for patient
 */
router.get(
  '/',
  verifyToken,
  consultationController.getConsultationList
);

/**
 * GET /api/v1/patient/consultations/:consultationId
 * Get consultation detail
 */
router.get(
  '/:consultationId',
  verifyToken,
  consultationController.getConsultationDetail
);

/**
 * POST /api/v1/patient/consultations/:consultationId/messages
 * Send message in consultation
 */
router.post(
  '/:consultationId/messages',
  verifyToken,
  uploadMultipleFiles('attachments', 5),
  consultationController.sendMessage
);

/**
 * GET /api/v1/patient/consultations/:consultationId/messages
 * Get chat messages from consultation
 */
router.get(
  '/:consultationId/messages',
  verifyToken,
  consultationController.getChatMessages
);

/**
 * GET /api/v1/doctor/consultations/:consultationId/ai-analysis
 * Get AI analysis detail for consultation
 */
router.get(
  '/:consultationId/ai-analysis',
  verifyToken,
  consultationController.getAiAnalysis
);

/**
 * GET /api/v1/doctor/consultations/:consultationId/events
 * SSE stream for new messages, typing, read receipts, and status updates
 */
router.get(
  '/:consultationId/events',
  verifyToken,
  consultationController.streamConsultationEvents
);

/**
 * POST /api/v1/doctor/consultations/:consultationId/typing
 * Publish typing status
 */
router.post(
  '/:consultationId/typing',
  verifyToken,
  consultationController.sendTypingStatus
);

/**
 * PATCH /api/v1/patient/consultations/:consultationId/read
 * Mark messages as read
 */
router.patch(
  '/:consultationId/read',
  verifyToken,
  consultationController.markMessagesAsRead
);

/**
 * PATCH /api/v1/patient/consultations/:consultationId/read-all
 * Mark all messages as read
 */
router.patch(
  '/:consultationId/read-all',
  verifyToken,
  consultationController.markAllAsRead
);

// ==================== DOCTOR ROUTES ====================
// Doctors dapat akses semua patient routes di atas, plus:

/**
 * PATCH /api/v1/doctor/consultations/:consultationId/close
 * Close consultation (doctor only)
 * Note: Route ini dimount dengan prefix /api/v1/doctor/consultations
 */
router.patch(
  '/:consultationId/close',
  verifyToken,
  consultationController.closeConsultation
);

/**
 * POST /api/v1/doctor/consultations/:consultationId/prescriptions
 * Create prescription (doctor only via service authorization)
 */
router.post(
  '/:consultationId/prescriptions',
  verifyToken,
  consultationController.createPrescription
);

module.exports = router;
