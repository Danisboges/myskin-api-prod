const clinicRequestService = require("../services/clinic-request.service");
const adminService = require("../services/admin.service");
const {
  validateCreateClinicRequest,
  validateClinicRequestListQuery,
  validateReviewClinicRequest,
} = require("../validators/clinic-request.validator");

const createClinicRequest = async (req, res) => {
  try {
    const validationErrors = validateCreateClinicRequest(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const clinicRequest = await clinicRequestService.createClinicRequest(req.body);

    res.status(201).json({
      status: "success",
      message: "Clinic request berhasil dibuat",
      data: clinicRequest,
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ status: "error", message: err.message });
    }

    console.error("Error creating clinic request:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getClinicRequests = async (req, res) => {
  try {
    const validationErrors = validateClinicRequestListQuery(req.query);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const pagination = await adminService.resolveAdminPagination(req.user.id, {
      page: req.query.page,
      limit: req.query.limit,
    });
    const clinicRequests = await clinicRequestService.getClinicRequests({
      ...req.query,
      page: pagination.page,
      limit: pagination.limit,
    });
    res.status(200).json({ status: "success", data: clinicRequests });
  } catch (err) {
    console.error("Error getting clinic requests:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const reviewClinicRequest = async (req, res) => {
  try {
    const { errors, status } = validateReviewClinicRequest(req.body);
    if (errors) {
      return res.status(400).json({ status: "error", errors });
    }

    const clinicRequest = await clinicRequestService.reviewClinicRequest(req.params.id, {
      status,
      reviewNote: req.body.reviewNote,
      adminId: req.user.id,
      adminName: req.user.name || "Admin",
    });

    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      status === "approved" ? "APPROVE_CLINIC_REQUEST" : "REJECT_CLINIC_REQUEST",
      `Admin ${status === "approved" ? "approved" : "rejected"} clinic request ${clinicRequest.requestId}`,
      {
        targetResourceType: "clinicRequest",
        targetResourceId: clinicRequest.requestId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({
      status: "success",
      message: `Clinic request berhasil ${status === "approved" ? "disetujui" : "ditolak"}`,
      data: clinicRequest,
    });
  } catch (err) {
    if ([400, 404, 409].includes(err.status)) {
      return res.status(err.status).json({ status: "error", message: err.message });
    }

    console.error("Error reviewing clinic request:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = {
  createClinicRequest,
  getClinicRequests,
  reviewClinicRequest,
};
