/**
 * Consultation Validator
 * Input validation untuk consultation endpoints
 */

/**
 * Validate initiate consultation request
 */
const validateInitiateConsultation = (data) => {
  const { doctorId, scanId, initialMessage } = data;

  if (!doctorId || typeof doctorId !== 'string') {
    throw new Error('doctorId is required and must be a string');
  }

  if (doctorId.trim().length === 0) {
    throw new Error('doctorId cannot be empty');
  }

  if (!scanId || typeof scanId !== 'string') {
    throw new Error('scanId is required and must be a string');
  }

  if (scanId.trim().length === 0) {
    throw new Error('scanId cannot be empty');
  }

  if (!initialMessage || typeof initialMessage !== 'string') {
    throw new Error('initialMessage is required and must be a string');
  }

  if (initialMessage.trim().length === 0) {
    throw new Error('initialMessage cannot be empty');
  }

  if (initialMessage.length > 2000) {
    throw new Error('initialMessage cannot exceed 2000 characters');
  }

  return {
    doctorId: doctorId.trim(),
    scanId: scanId.trim(),
    initialMessage: initialMessage.trim()
  };
};

/**
 * Validate send message request
 */
const validateSendMessage = (data) => {
  const { message } = data;

  if (!message || typeof message !== 'string') {
    throw new Error('message is required and must be a string');
  }

  if (message.trim().length === 0) {
    throw new Error('message cannot be empty');
  }

  if (message.length > 2000) {
    throw new Error('message cannot exceed 2000 characters');
  }

  if (message.length < 1) {
    throw new Error('message must be at least 1 character');
  }

  return {
    message: message.trim()
  };
};

/**
 * Validate close consultation request
 */
const validateCloseConsultation = (data) => {
  const { diagnosis = '', recommendation = '', notes = '' } = data;

  // Diagnosis is optional but if provided, validate it
  if (diagnosis && typeof diagnosis !== 'string') {
    throw new Error('diagnosis must be a string');
  }

  if (diagnosis && diagnosis.length > 1000) {
    throw new Error('diagnosis cannot exceed 1000 characters');
  }

  // Recommendation is optional
  if (recommendation && typeof recommendation !== 'string') {
    throw new Error('recommendation must be a string');
  }

  if (recommendation && recommendation.length > 1000) {
    throw new Error('recommendation cannot exceed 1000 characters');
  }

  // Notes is optional
  if (notes && typeof notes !== 'string') {
    throw new Error('notes must be a string');
  }

  if (notes && notes.length > 1000) {
    throw new Error('notes cannot exceed 1000 characters');
  }

  return {
    diagnosis: diagnosis.trim(),
    recommendation: recommendation.trim(),
    notes: notes.trim()
  };
};

/**
 * Validate pagination parameters
 */
const validatePaginationParams = (data) => {
  const { page = 1, limit = 10 } = data;

  // Validate page
  if (typeof page !== 'number' || page < 1) {
    throw new Error('page must be a positive number');
  }

  // Validate limit
  if (typeof limit !== 'number' || limit < 1 || limit > 100) {
    throw new Error('limit must be between 1 and 100');
  }

  return {
    page: Math.floor(page),
    limit: Math.min(Math.floor(limit), 100)
  };
};

/**
 * Validate mark as read request
 */
const validateMarkAsRead = (data) => {
  const { messageIds = [] } = data;

  if (!Array.isArray(messageIds)) {
    throw new Error('messageIds must be an array');
  }

  if (messageIds.length > 0) {
    messageIds.forEach((id, index) => {
      if (typeof id !== 'string') {
        throw new Error(`messageIds[${index}] must be a string`);
      }
      if (id.trim().length === 0) {
        throw new Error(`messageIds[${index}] cannot be empty`);
      }
    });
  }

  return {
    messageIds: messageIds.map(id => id.trim())
  };
};

// ==================== MODULE EXPORTS ====================

module.exports = {
  validateInitiateConsultation,
  validateSendMessage,
  validateCloseConsultation,
  validatePaginationParams,
  validateMarkAsRead
};
