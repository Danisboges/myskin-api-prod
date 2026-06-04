const { validateEmailForForm } = require("../utils/email.util");
const { getPasswordStrengthErrors } = require("../utils/password.util");

const VALID_LOG_CATEGORIES = ["infrastructure", "ai_engine", "user_management", "security", "system"];
const VALID_LOG_SEVERITIES = ["critical", "warning", "info"];
const VALID_RETENTION_DAYS = [30, 90, 180, 365];

// Validator untuk Admin User Management

const validateCreateUser = (data) => {
  const errors = {};

  if (!data.fullName || data.fullName.trim().length === 0) {
    errors.fullName = "Full name is required";
  }

  const emailError = validateEmailForForm(data.email);
  if (emailError) {
    errors.email = emailError;
  }

  if (!data.role || !["admin", "doctor", "patient"].includes(data.role)) {
    errors.role = "Role must be admin, doctor, or patient";
  }

  if (!data.gender || !["male", "female"].includes(data.gender)) {
    errors.gender = "Gender must be male or female";
  }

  const passwordErrors = getPasswordStrengthErrors(data.password, {
    email: data.email,
    name: data.fullName,
  });
  if (passwordErrors.length > 0) {
    errors.password = passwordErrors;
  }

  if (data.phoneNumber && !/^\+?[0-9\s\-\(\)]{7,}$/.test(data.phoneNumber)) {
    errors.phoneNumber = "Invalid phone number format";
  }

  if (data.birthDate && isNaN(Date.parse(data.birthDate))) {
    errors.birthDate = "Invalid birth date";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateUpdateUser = (data) => {
  const errors = {};

  if (data.fullName !== undefined && data.fullName.trim().length === 0) {
    errors.fullName = "Full name cannot be empty";
  }

  const emailError = validateEmailForForm(data.email, { required: false });
  if (emailError) {
    errors.email = emailError;
  }

  if (data.role && !["admin", "doctor", "patient"].includes(data.role)) {
    errors.role = "Role must be admin, doctor, or patient";
  }

  if (data.gender && !["male", "female"].includes(data.gender)) {
    errors.gender = "Gender must be male or female";
  }

  if (data.phoneNumber && !/^\+?[0-9\s\-\(\)]{7,}$/.test(data.phoneNumber)) {
    errors.phoneNumber = "Invalid phone number format";
  }

  if (data.birthDate && isNaN(Date.parse(data.birthDate))) {
    errors.birthDate = "Invalid birth date";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateUserStatus = (status) => {
  const validStatuses = ["active", "pending", "suspended", "inactive"];
  return validStatuses.includes(status) ? null : { status: "Invalid status" };
};

const validateUserRole = (role) => {
  const validRoles = ["admin", "doctor", "patient"];
  return validRoles.includes(role) ? null : { role: "Invalid role" };
};

const validateResetPassword = (data) => {
  const errors = {};

  const passwordErrors = getPasswordStrengthErrors(data.newPassword);
  if (passwordErrors.length > 0) {
    errors.newPassword = passwordErrors;
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateDoctorApproval = (data) => {
  const errors = {};

  if (!data.note || data.note.trim().length === 0) {
    errors.note = "Approval note is required";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateDoctorRejection = (data) => {
  const errors = {};

  if (!data.reason || data.reason.trim().length === 0) {
    errors.reason = "Rejection reason is required";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateAdminNotificationsSettings = (data) => {
  const errors = {};
  const booleanFields = [
    "emailNotifications",
    "doctorApprovalAlerts",
    "clinicRequestAlerts",
    "systemAlerts",
    "weeklyDigest",
  ];

  booleanFields.forEach((field) => {
    if (data[field] !== undefined && typeof data[field] !== "boolean") {
      errors[field] = "Must be boolean";
    }
  });

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateAdminOperationsSettings = (data) => {
  const errors = {};
  const allowedPageSizes = [8, 16, 24, 32];

  if (data.defaultPageSize !== undefined && !allowedPageSizes.includes(Number(data.defaultPageSize))) {
    errors.defaultPageSize = "defaultPageSize must be one of 8, 16, 24, or 32";
  }

  if (
    data.auditLogRetentionDays !== undefined &&
    !VALID_RETENTION_DAYS.includes(Number(data.auditLogRetentionDays))
  ) {
    errors.auditLogRetentionDays = "auditLogRetentionDays must be one of 30, 90, 180, or 365";
  }

  if (data.maintenanceMode !== undefined && typeof data.maintenanceMode !== "boolean") {
    errors.maintenanceMode = "Must be boolean";
  }

  if (
    data.deleteConfirmationRequired !== undefined &&
    typeof data.deleteConfirmationRequired !== "boolean"
  ) {
    errors.deleteConfirmationRequired = "Must be boolean";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateAdminPreferencesSettings = (data) => {
  const errors = {};
  const allowedLanguages = ["English (US)", "Bahasa Indonesia"];
  const allowedTimezones = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "UTC"];

  if (data.language !== undefined && !allowedLanguages.includes(data.language)) {
    errors.language = "language must be English (US) or Bahasa Indonesia";
  }

  if (data.timezone !== undefined && !allowedTimezones.includes(data.timezone)) {
    errors.timezone = "timezone must be Asia/Jakarta, Asia/Makassar, Asia/Jayapura, or UTC";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateAdminSettings = validateAdminNotificationsSettings;

const validateReportGeneration = (data) => {
  const errors = {};

  if (!data.startDate || isNaN(Date.parse(data.startDate))) {
    errors.startDate = "Valid start date is required";
  }

  if (!data.endDate || isNaN(Date.parse(data.endDate))) {
    errors.endDate = "Valid end date is required";
  }

  if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
    errors.endDate = "End date must be after start date";
  }

  if (!data.reportType || !["system_overview", "user_stats", "doctor_stats"].includes(data.reportType)) {
    errors.reportType = "Invalid report type";
  }

  if (data.format && !["pdf", "csv", "xlsx"].includes(data.format)) {
    errors.format = "Format must be pdf, csv, or xlsx";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validatePaginationParams = (page, limit) => {
  const errors = {};

  if (page !== undefined && page !== null && (isNaN(page) || page < 1)) {
    errors.page = "Page must be a positive number";
  }

  if (limit !== undefined && limit !== null && (isNaN(limit) || limit < 1 || limit > 100)) {
    errors.limit = "Limit must be between 1 and 100";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateSystemLogFilters = ({ type, severity } = {}) => {
  const errors = {};

  if (type !== undefined && type !== null && type !== "" && !VALID_LOG_CATEGORIES.includes(type)) {
    errors.type = "type must be one of infrastructure, ai_engine, user_management, security, or system";
  }

  if (
    severity !== undefined &&
    severity !== null &&
    severity !== "" &&
    !VALID_LOG_SEVERITIES.includes(severity)
  ) {
    errors.severity = "severity must be one of critical, warning, or info";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateLogRetentionDays = (retentionDays) => (
  VALID_RETENTION_DAYS.includes(Number(retentionDays))
    ? null
    : { retentionDays: "retentionDays harus bernilai 30, 90, 180, atau 365" }
);

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateUserStatus,
  validateUserRole,
  validateResetPassword,
  validateDoctorApproval,
  validateDoctorRejection,
  validateAdminSettings,
  validateAdminNotificationsSettings,
  validateAdminOperationsSettings,
  validateAdminPreferencesSettings,
  validateReportGeneration,
  validatePaginationParams,
  validateSystemLogFilters,
  validateLogRetentionDays,
};
