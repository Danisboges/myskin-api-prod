const validateClinicPayload = (data, { partial = false } = {}) => {
  const errors = {};

  if (!partial || data.name !== undefined) {
    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      errors.name = "Clinic name is required";
    }
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Valid email is required";
  }

  if (data.phone && !/^\+?[0-9\s\-\(\)]{7,}$/.test(data.phone)) {
    errors.phone = "Invalid phone number format";
  }

  if (data.isActive !== undefined && typeof data.isActive !== "boolean") {
    errors.isActive = "isActive must be a boolean";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateClinicQuery = ({ page, limit, isActive, sortOrder } = {}) => {
  const errors = {};

  if (page !== undefined && (isNaN(page) || Number(page) < 1)) {
    errors.page = "Page must be a positive number";
  }

  if (limit !== undefined && (isNaN(limit) || Number(limit) < 1 || Number(limit) > 100)) {
    errors.limit = "Limit must be between 1 and 100";
  }

  if (
    isActive !== undefined
    && isActive !== "all"
    && !["true", "false"].includes(String(isActive).toLowerCase())
  ) {
    errors.isActive = "isActive must be true, false, or all";
  }

  if (sortOrder !== undefined && !["asc", "desc"].includes(sortOrder)) {
    errors.sortOrder = "sortOrder must be asc or desc";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

module.exports = {
  validateClinicPayload,
  validateClinicQuery,
};
