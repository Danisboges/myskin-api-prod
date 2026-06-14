/**
 * Patient Validator
 * Validasi request body untuk semua endpoint patient
 */

// ==================== SCAN VALIDATORS ====================

const MIN_COMPLAINT_NON_SPACE_LENGTH = 10;
const countNonWhitespaceCharacters = (value = '') => String(value).replace(/\s/g, '').length;

const validateScanUpload = (req, res, next) => {
  const { complaint, bodySite } = req.body;

  // Validasi file
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "Image file is required"
    });
  }

  // Validasi tipe file
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(req.file.mimetype)) {
    return res.status(400).json({
      status: "error",
      message: "Only JPEG, PNG, and WebP images are allowed"
    });
  }

  // Validasi ukuran file (max 10MB)
  if (req.file.size > 10 * 1024 * 1024) {
    return res.status(400).json({
      status: "error",
      message: "File size must not exceed 10MB"
    });
  }

  // Validasi complaint
  if (
    !complaint ||
    typeof complaint !== 'string' ||
    countNonWhitespaceCharacters(complaint) < MIN_COMPLAINT_NON_SPACE_LENGTH
  ) {
    return res.status(400).json({
      status: "error",
      message: "Complaint must be at least 10 characters"
    });
  }

  next();
};

const validateScanAnalyze = (req, res, next) => {
  const { scanId } = req.params;

  if (!scanId || typeof scanId !== 'string' || scanId.trim().length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Valid scanId is required"
    });
  }

  next();
};

const validateScanShare = (req, res, next) => {
  const { doctorUserId } = req.body;
  const { scanId } = req.params;

  if (!scanId || typeof scanId !== 'string' || scanId.trim().length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Valid scanId is required"
    });
  }

  if (!doctorUserId || typeof doctorUserId !== 'string' || doctorUserId.trim().length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Valid doctorUserId is required"
    });
  }

  next();
};

// ==================== PROFILE VALIDATORS ====================

const validateProfileUpdate = (req, res, next) => {
  const { name, email, phone, medicalHistory, allergies, medications, familyHistory } = req.body;

  // Validasi nama
  if (name && (typeof name !== 'string' || name.trim().length < 3)) {
    return res.status(400).json({
      status: "error",
      message: "Name must be at least 3 characters"
    });
  }

  // Validasi email
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email format"
      });
    }
  }

  // Validasi phone
  if (phone && (typeof phone !== 'string' || phone.trim().length < 10)) {
    return res.status(400).json({
      status: "error",
      message: "Phone must be at least 10 digits"
    });
  }

  next();
};

const validateProfilePhotoUpdate = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "Photo file is required"
    });
  }

  // Validasi ukuran minimum (minimal 1KB)
  if (req.file.size < 1024) {
    return res.status(400).json({
      status: "error",
      message: "File size is too small (minimum 1KB)"
    });
  }

  // Validasi tipe file
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(req.file.mimetype)) {
    return res.status(400).json({
      status: "error",
      message: "Only JPEG, PNG, and WebP images are allowed"
    });
  }

  // Validasi ukuran maksimal (max 5MB untuk profile photo)
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  if (req.file.size > maxFileSize) {
    return res.status(400).json({
      status: "error",
      message: `File size must not exceed 5MB (current: ${(req.file.size / 1024 / 1024).toFixed(2)}MB)`
    });
  }

  next();
};

// ==================== SETTINGS VALIDATORS ====================

const validateSettingsUpdate = (req, res, next) => {
  const { emailNotifications, scanNotifications, reportNotifications, language } = req.body;

  // Validasi boolean fields
  if (emailNotifications !== undefined && typeof emailNotifications !== 'boolean') {
    return res.status(400).json({
      status: "error",
      message: "emailNotifications must be a boolean"
    });
  }

  if (scanNotifications !== undefined && typeof scanNotifications !== 'boolean') {
    return res.status(400).json({
      status: "error",
      message: "scanNotifications must be a boolean"
    });
  }

  if (reportNotifications !== undefined && typeof reportNotifications !== 'boolean') {
    return res.status(400).json({
      status: "error",
      message: "reportNotifications must be a boolean"
    });
  }

  if (language !== undefined && !["English (US)", "Bahasa Indonesia"].includes(language)) {
    return res.status(400).json({
      status: "error",
      message: "language must be English (US) or Bahasa Indonesia"
    });
  }

  next();
};

// ==================== VERIFICATION REQUEST VALIDATORS ====================

const validateVerificationRequest = (req, res, next) => {
  const message = req.body.message ?? req.body.initialMessage;
  const scanIdentifier = req.body.patientScanId ?? req.body.scanId;

  if (!message && scanIdentifier) {
    return next();
  }

  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({
      status: "error",
      message: "Message must be at least 5 characters"
    });
  }

  req.body.message = message.trim();
  next();
};

// ==================== NOTIFICATION VALIDATORS ====================

const validateNotificationRead = (req, res, next) => {
  const { notificationId } = req.params;

  if (!notificationId || typeof notificationId !== 'string' || notificationId.trim().length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Valid notificationId is required"
    });
  }

  next();
};

// ==================== PAGINATION VALIDATORS ====================

const validatePaginationParams = (req, res, next) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

  // Validasi page
  const pageNum = parseInt(page);
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      status: "error",
      message: "Page must be a positive number"
    });
  }

  // Validasi limit
  const limitNum = parseInt(limit);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      status: "error",
      message: "Limit must be between 1 and 100"
    });
  }

  // Validasi order
  if (!['asc', 'desc'].includes(order.toLowerCase())) {
    return res.status(400).json({
      status: "error",
      message: "Order must be either 'asc' or 'desc'"
    });
  }

  // Simpan ke req untuk digunakan di controller
  req.pagination = {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
    sortBy,
    order: order.toLowerCase()
  };

  next();
};

module.exports = {
  validateScanUpload,
  validateScanAnalyze,
  validateScanShare,
  validateProfileUpdate,
  validateProfilePhotoUpdate,
  validateSettingsUpdate,
  validateVerificationRequest,
  validateNotificationRead,
  validatePaginationParams
};
