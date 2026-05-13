// Validator untuk Admin User Management

const validateCreateUser = (data) => {
  const errors = {};

  if (!data.fullName || data.fullName.trim().length === 0) {
    errors.fullName = "Full name is required";
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Valid email is required";
  }

  if (!data.role || !["admin", "doctor", "patient"].includes(data.role)) {
    errors.role = "Role must be admin, doctor, or patient";
  }

  if (!data.gender || !["male", "female"].includes(data.gender)) {
    errors.gender = "Gender must be male or female";
  }

  if (!data.password || data.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
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

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Valid email is required";
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

  if (!data.newPassword || data.newPassword.length < 6) {
    errors.newPassword = "New password must be at least 6 characters";
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

const validateAdminSettings = (data) => {
  const errors = {};

  if (data.twoFactorEnabled !== undefined && typeof data.twoFactorEnabled !== "boolean") {
    errors.twoFactorEnabled = "Must be boolean";
  }

  if (data.emailNotifications !== undefined && typeof data.emailNotifications !== "boolean") {
    errors.emailNotifications = "Must be boolean";
  }

  if (data.verificationAlerts !== undefined && typeof data.verificationAlerts !== "boolean") {
    errors.verificationAlerts = "Must be boolean";
  }

  if (data.dataVisibility && !["restricted_clinical_team_only", "restricted_self_only", "shared_with_clinic"].includes(data.dataVisibility)) {
    errors.dataVisibility = "Invalid data visibility";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

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

  if (page && (isNaN(page) || page < 1)) {
    errors.page = "Page must be a positive number";
  }

  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    errors.limit = "Limit must be between 1 and 100";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateUserStatus,
  validateUserRole,
  validateResetPassword,
  validateDoctorApproval,
  validateDoctorRejection,
  validateAdminSettings,
  validateReportGeneration,
  validatePaginationParams,
};
