const clinicService = require("../services/clinic.service");
const adminService = require("../services/admin.service");
const {
  validateClinicPayload,
  validateClinicQuery,
} = require("../validators/clinic.validator");

const getClinics = async (req, res) => {
  try {
    const validationErrors = validateClinicQuery(req.query);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    let query = req.query;
    if (req.user?.role === "admin") {
      const pagination = await adminService.resolveAdminPagination(req.user.id, {
        page: req.query.page,
        limit: req.query.limit,
      });
      query = {
        ...req.query,
        page: pagination.page,
        limit: pagination.limit,
      };
    }

    const clinics = await clinicService.getClinics(query);
    res.status(200).json({ status: "success", data: clinics });
  } catch (err) {
    console.error("Error getting clinics:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getClinicById = async (req, res) => {
  try {
    const clinic = await clinicService.getClinicById(req.params.clinicId);
    res.status(200).json({ status: "success", data: clinic });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }

    console.error("Error getting clinic:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const createClinic = async (req, res) => {
  try {
    const validationErrors = validateClinicPayload(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const clinic = await clinicService.createClinic(req.body);

    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "CREATE_CLINIC",
      `Admin created clinic ${clinic.name}`,
      {
        targetResourceType: "clinic",
        targetResourceId: clinic.clinicId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(201).json({ status: "success", data: clinic });
  } catch (err) {
    console.error("Error creating clinic:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateClinic = async (req, res) => {
  try {
    const validationErrors = validateClinicPayload(req.body, { partial: true });
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const clinic = await clinicService.updateClinic(req.params.clinicId, req.body);

    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "UPDATE_CLINIC",
      `Admin updated clinic ${clinic.name}`,
      {
        targetResourceType: "clinic",
        targetResourceId: clinic.clinicId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({ status: "success", data: clinic });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }

    console.error("Error updating clinic:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const deleteClinic = async (req, res) => {
  try {
    const clinic = await clinicService.deleteClinic(req.params.clinicId);

    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "DELETE_CLINIC",
      `Admin deleted clinic ${clinic.name}`,
      {
        targetResourceType: "clinic",
        targetResourceId: clinic.clinicId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({
      status: "success",
      message: "Clinic deleted successfully",
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    if (err.status === 409) {
      return res.status(409).json({ status: "error", message: err.message });
    }

    console.error("Error deleting clinic:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = {
  getClinics,
  getClinicById,
  createClinic,
  updateClinic,
  deleteClinic,
};
