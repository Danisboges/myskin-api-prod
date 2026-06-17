/**
 * Consultation Controller
 * HTTP request handlers untuk consultation endpoints
 */

const consultationService = require('../services/consultation.service');
const {
  publishConsultationEvent,
  subscribeToConsultationEvents
} = require('../services/consultation-events.service');
const {
  validateInitiateConsultation,
  validateSendMessage,
  validateCloseConsultation,
  validatePaginationParams,
  validateConsultationListFilters,
  validatePrescription,
  validateMarkAsRead
} = require('../validators/consultation.validator');

const isValidationError = (error) => (
  error.message.includes('required') ||
  error.message.includes('must be') ||
  error.message.includes('cannot be') ||
  error.message.includes('exceed') ||
  error.message.includes('empty') ||
  error.message.includes('valid date')
);

// ==================== CONSULTATION ENDPOINTS ====================

/**
 * POST /api/v1/patient/consultations/initiate
 * Initiate new consultation
 */
const initiateConsultation = async (req, res) => {
  try {
    const userId = req.user.id;

    // Validate input
    const { doctorId, scanId, initialMessage } = validateInitiateConsultation(req.body);

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

    if (error.code === 'ACTIVE_CONSULTATION_EXISTS') {
      return res.status(error.status || 409).json({
        status: 'error',
        code: error.code,
        message: error.message,
        data: error.data
      });
    }

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

    if (isValidationError(error)) {
      return res.status(400).json({
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
    const filters = validateConsultationListFilters(req.query);

    const result = await consultationService.getConsultationList(
      userId,
      role,
      filters
    );

    return res.status(200).json({
      status: 'success',
      data: result.data,
      meta: result.pagination,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error getting consultation list:', error.message);

    if (isValidationError(error)) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }

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
    const userId = req.user.id;

    // Validate input
    const attachments = req.files || [];
    const { message } = validateSendMessage(req.body, {
      hasAttachments: attachments.length > 0
    });

    const result = await consultationService.sendMessage(
      consultationId,
      userId,
      message,
      attachments
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

    if (isValidationError(error)) {
      return res.status(400).json({
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
 * POST /api/v1/doctor/consultations/:consultationId/prescriptions
 * Create prescription in consultation
 */
const createPrescription = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;
    const prescriptionData = validatePrescription(req.body);

    const result = await consultationService.createPrescription(
      consultationId,
      userId,
      prescriptionData
    );

    return res.status(201).json({
      status: 'success',
      message: 'Prescription created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating prescription:', error.message);

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

    if (isValidationError(error)) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to create prescription'
    });
  }
};

/**
 * GET /api/v1/doctor/consultations/:consultationId/ai-analysis
 * Get AI analysis details for consultation
 */
const getAiAnalysis = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;

    const result = await consultationService.getAiAnalysis(consultationId, userId);

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Error getting AI analysis:', error.message);

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
      message: 'Failed to get AI analysis'
    });
  }
};

/**
 * GET /api/v1/doctor/consultations/:consultationId/events
 * Server-sent events stream for consultation updates
 */
const streamConsultationEvents = async (req, res) => {
  const { consultationId } = req.params;
  const userId = req.user.id;

  try {
    await consultationService.getAiAnalysis(consultationId, userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    writeEvent({
      type: 'connection:ready',
      consultationId,
      payload: { userId },
      emittedAt: new Date().toISOString()
    });

    const unsubscribe = subscribeToConsultationEvents(consultationId, writeEvent);
    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
      res.end();
    });
  } catch (error) {
    console.error('Error streaming consultation events:', error.message);

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
      message: 'Failed to stream consultation events'
    });
  }
};

/**
 * POST /api/v1/doctor/consultations/:consultationId/typing
 * Publish typing status for consultation participants
 */
const sendTypingStatus = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;
    const isTyping = Boolean(req.body?.isTyping);

    await consultationService.getAiAnalysis(consultationId, userId);

    publishConsultationEvent(consultationId, 'typing:status', {
      userId,
      isTyping
    });

    return res.status(200).json({
      status: 'success',
      data: {
        consultationId,
        userId,
        isTyping
      }
    });
  } catch (error) {
    console.error('Error sending typing status:', error.message);

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
      message: 'Failed to send typing status'
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
      meta: result.pagination,
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

    if (isValidationError(error)) {
      return res.status(400).json({
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
    const userId = req.user.id;

    // Validate input
    const {
      diagnosis,
      recommendation,
      notes,
      caseDisposition,
      finalClinicalNotes,
      emailClinicalSummary
    } = validateCloseConsultation(req.body);

    const result = await consultationService.closeConsultation(
      consultationId,
      userId,
      {
        diagnosis,
        recommendation,
        notes,
        caseDisposition,
        finalClinicalNotes,
        emailClinicalSummary
      }
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

    if (isValidationError(error)) {
      return res.status(400).json({
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
 * DELETE /api/v1/doctor/consultations/:consultationId
 * Delete closed consultation (doctor only)
 */
const deleteClosedConsultation = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user.id;

    const result = await consultationService.deleteClosedConsultation(
      consultationId,
      userId
    );

    return res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    console.error('Error deleting consultation:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: 'Consultation not found'
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Only closed consultations can be deleted')) {
      return res.status(409).json({
        status: 'error',
        message: 'Only closed consultations can be deleted'
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete consultation'
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
    const userId = req.user.id;
    const { messageIds } = validateMarkAsRead(req.body);

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

    if (isValidationError(error)) {
      return res.status(400).json({
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
  deleteClosedConsultation,
  createPrescription,
  getAiAnalysis,
  streamConsultationEvents,
  sendTypingStatus,
  markMessagesAsRead,
  markAllAsRead
};
