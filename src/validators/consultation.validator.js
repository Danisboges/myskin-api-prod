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
const validateSendMessage = (data, options = {}) => {
  const { message } = data;
  const { hasAttachments = false } = options;

  if ((!message || typeof message !== 'string') && !hasAttachments) {
    throw new Error('message is required and must be a string');
  }

  if (message && typeof message !== 'string') {
    throw new Error('message must be a string');
  }

  if ((!message || message.trim().length === 0) && !hasAttachments) {
    throw new Error('message cannot be empty');
  }

  if (message && message.length > 2000) {
    throw new Error('message cannot exceed 2000 characters');
  }

  if (message && message.length < 1 && !hasAttachments) {
    throw new Error('message must be at least 1 character');
  }

  return {
    message: message ? message.trim() : ''
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
  if (typeof page !== 'number' || !Number.isFinite(page) || page < 1) {
    throw new Error('page must be a positive number');
  }

  // Validate limit
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be between 1 and 100');
  }

  return {
    page: Math.floor(page),
    limit: Math.min(Math.floor(limit), 100)
  };
};

/**
 * Validate consultation list filters
 */
const validateConsultationListFilters = (data) => {
  const { page = 1, limit = 10, search = '', status = '', startDate = '', endDate = '' } = data;
  const pagination = validatePaginationParams({
    page: parseInt(page),
    limit: parseInt(limit)
  });

  if (status && !['OPEN', 'CLOSED'].includes(String(status).toUpperCase())) {
    throw new Error('status must be OPEN or CLOSED');
  }

  const parsedStartDate = startDate ? new Date(startDate) : null;
  const parsedEndDate = endDate ? new Date(endDate) : null;

  if (startDate && Number.isNaN(parsedStartDate.getTime())) {
    throw new Error('startDate must be a valid date');
  }

  if (endDate && Number.isNaN(parsedEndDate.getTime())) {
    throw new Error('endDate must be a valid date');
  }

  if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
    throw new Error('startDate cannot be after endDate');
  }

  return {
    ...pagination,
    search: String(search || '').trim(),
    status: status ? String(status).toUpperCase() : '',
    startDate: parsedStartDate,
    endDate: parsedEndDate
  };
};

/**
 * Validate prescription request
 */
const validatePrescription = (data) => {
  const { medicationName, dosage = '', frequency = '', duration = '', notes = '' } = data;

  if (!medicationName || typeof medicationName !== 'string') {
    throw new Error('medicationName is required and must be a string');
  }

  if (medicationName.trim().length === 0) {
    throw new Error('medicationName cannot be empty');
  }

  if (medicationName.length > 255) {
    throw new Error('medicationName cannot exceed 255 characters');
  }

  const optionalFields = { dosage, frequency, duration, notes };
  Object.entries(optionalFields).forEach(([field, value]) => {
    if (value && typeof value !== 'string') {
      throw new Error(`${field} must be a string`);
    }
    if (value && value.length > 1000) {
      throw new Error(`${field} cannot exceed 1000 characters`);
    }
  });

  return {
    medicationName: medicationName.trim(),
    dosage: dosage.trim(),
    frequency: frequency.trim(),
    duration: duration.trim(),
    notes: notes.trim()
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
  validateConsultationListFilters,
  validatePrescription,
  validateMarkAsRead
};
