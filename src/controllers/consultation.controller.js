/**
 * Consultation Controller
 * HTTP request handlers untuk consultation endpoints
 */

const consultationService = require('../services/consultation.service');
const {
  validateInitiateConsultation,
  validateSendMessage,
  validateCloseConsultation,
  validatePaginationParams
} = require('../validators/consultation.validator');

// ==================== CONSULTATION ENDPOINTS ====================

/**
 * POST /api/v1/patient/consultations/initiate
 * Initiate new consultation
 */
const initiateConsultation = async (req, res) => {
  try {
    const { doctorId, scanId, initialMessage } = req.body;
    const userId = req.user.id;

    // Validate input
    validateInitiateConsultation(req.body);

    // Call service
    const result = await consultationService.initiateConsultation(
      userId,
      doctorId,
      scanId,
      initialMessage
    );

    return res.status(201).json({
      status: 'success',
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error initiating consultation:', error.message);

    // Handle specific errors
    if (
      error.message.includes('Patient profile not found') ||
      error.message.includes('Scan not found') ||
      error.message.includes('Doctor not found')
    ) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to initiate consultation'
    });
  }
};

/**
 * GET /api/v1/patient/consultations
 * Get consultation list for patient
 */
const getConsultationList = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role || 'patient';
    const { page = 1, limit = 10 } = req.query;

    // Validate pagination
    validatePaginationParams({ page: parseInt(page), limit: parseInt(limit) });

    const result = await consultationService.getConsultationList(
      userId,
      role,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    return res.status(200).json({
      status: 'success',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error getting consultation list:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Failed to get consultation list'
    });
  }
};

/**
 * GET /api/v1/patient/consultations/:consultationId
 * Get consultation detail
 */
const getConsultationDetail = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;

    const result = await consultationService.getConsultationDetail(
      consultationId,
      userId
    );

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Error getting consultation detail:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to get consultation detail'
    });
  }
};

/**
 * POST /api/v1/patient/consultations/:consultationId/messages
 * Send message in consultation
 */
const sendMessage = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    // Validate input
    validateSendMessage(req.body);

    const result = await consultationService.sendMessage(
      consultationId,
      userId,
      message
    );

    return res.status(201).json({
      status: 'success',
      message: 'Message sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending message:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('closed')) {
      return res.status(409).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to send message'
    });
  }
};

/**
 * GET /api/v1/patient/consultations/:consultationId/messages
 * Get chat messages
 */
const getChatMessages = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Validate pagination
    validatePaginationParams({ page: parseInt(page), limit: parseInt(limit) });

    const result = await consultationService.getChatMessages(
      consultationId,
      userId,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    return res.status(200).json({
      status: 'success',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error getting chat messages:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to get chat messages'
    });
  }
};

/**
 * PATCH /api/v1/doctor/consultations/:consultationId/close
 * Close consultation (doctor only)
 */
const closeConsultation = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const { diagnosis, recommendation, notes } = req.body;
    const userId = req.user.id;

    // Validate input
    validateCloseConsultation(req.body);

    const result = await consultationService.closeConsultation(
      consultationId,
      userId,
      { diagnosis, recommendation, notes }
    );

    return res.status(200).json({
      status: 'success',
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error closing consultation:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('already closed')) {
      return res.status(409).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to close consultation'
    });
  }
};

/**
 * PATCH /api/v1/patient/consultations/:consultationId/read
 * Mark messages as read
 */
const markMessagesAsRead = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const { messageIds = [] } = req.body;
    const userId = req.user.id;

    const result = await consultationService.markMessagesAsRead(
      consultationId,
      userId,
      messageIds
    );

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Error marking messages as read:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to mark messages as read'
    });
  }
};

/**
 * PATCH /api/v1/patient/consultations/:consultationId/read-all
 * Mark all messages as read
 */
const markAllAsRead = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;

    // Get all messages then mark as read
    const result = await consultationService.markMessagesAsRead(
      consultationId,
      userId
    );

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Error marking all as read:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Failed to mark all messages as read'
    });
  }
};

// ==================== MODULE EXPORTS ====================

module.exports = {
  initiateConsultation,
  getConsultationList,
  getConsultationDetail,
  sendMessage,
  getChatMessages,
  closeConsultation,
  markMessagesAsRead,
  markAllAsRead
};
