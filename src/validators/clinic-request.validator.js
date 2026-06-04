const VALID_REVIEW_STATUSES = ["approved", "rejected"];
const VALID_LIST_STATUSES = ["all", "pending", "approved", "rejected"];

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^\+?[0-9\s\-\(\)]{7,}$/.test(phone);

const validateCreateClinicRequest = (data) => {
  const errors = {};

  if (!data.clinicName || typeof data.clinicName !== "string" || data.clinicName.trim().length === 0) {
    errors.clinicName = "clinicName wajib diisi";
  }

  if (!data.requesterName || typeof data.requesterName !== "string" || data.requesterName.trim().length === 0) {
    errors.requesterName = "requesterName wajib diisi";
  }

  if (!data.requesterEmail || typeof data.requesterEmail !== "string" || !isValidEmail(data.requesterEmail)) {
    errors.requesterEmail = "requesterEmail harus berupa email yang valid";
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.email = "email harus berupa email yang valid";
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = "phone tidak valid";
  }

  if (data.requesterPhone && !isValidPhone(data.requesterPhone)) {
    errors.requesterPhone = "requesterPhone tidak valid";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateClinicRequestListQuery = ({ page, limit, status, sortOrder } = {}) => {
  const errors = {};

  if (page !== undefined && (isNaN(page) || Number(page) < 1)) {
    errors.page = "Page must be a positive number";
  }

  if (limit !== undefined && (isNaN(limit) || Number(limit) < 1 || Number(limit) > 100)) {
    errors.limit = "Limit must be between 1 and 100";
  }

  if (status !== undefined && !VALID_LIST_STATUSES.includes(status)) {
    errors.status = "status harus bernilai all, pending, approved, atau rejected";
  }

  if (sortOrder !== undefined && !["asc", "desc"].includes(sortOrder)) {
    errors.sortOrder = "sortOrder must be asc or desc";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const normalizeReviewStatus = (data) => {
  if (data.status) return data.status;
  if (data.action === "approve") return "approved";
  if (data.action === "reject") return "rejected";
  return null;
};

const validateReviewClinicRequest = (data) => {
  const errors = {};
  const status = normalizeReviewStatus(data);

  if (!status) {
    errors.status = "status atau action harus disediakan";
  } else if (!VALID_REVIEW_STATUSES.includes(status)) {
    errors.status = "status harus bernilai approved atau rejected";
  }

  if (status === "rejected" && (!data.reviewNote || data.reviewNote.trim().length === 0)) {
    errors.reviewNote = "reviewNote wajib diisi saat menolak clinic request";
  }

  return {
    errors: Object.keys(errors).length > 0 ? errors : null,
    status,
  };
};

module.exports = {
  validateCreateClinicRequest,
  validateClinicRequestListQuery,
  validateReviewClinicRequest,
};
