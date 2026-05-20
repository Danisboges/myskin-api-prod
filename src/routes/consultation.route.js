/**
 * Consultation Routes
 * API endpoints untuk consultation feature
 */

const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultation.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

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

module.exports = router;
