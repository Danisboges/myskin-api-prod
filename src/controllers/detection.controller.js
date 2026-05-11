const detectionService = require('../services/detection.service');

const predict = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ status: "error", message: "User ID is required" });
    }
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "No file uploaded" });
    }
    const { complaint } = req.body;
    const filePath = req.file.path.replace(/\\/g, "/");
    const userId = req.user.id; 

    const detection = await detectionService.createDetection(userId, filePath, complaint);

    res.status(201).json({ status: "success", data: detection });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ==================== CASE SUBMISSION ENDPOINTS ====================

const submitCaseToDoctor = async (req, res) => {
  try {
    const { detectionId, doctorId } = req.params;
    const { notes } = req.body;
    const patientId = req.user.id;

    if (!detectionId || !doctorId) {
      return res.status(400).json({ 
        status: "error", 
        message: "detectionId and doctorId are required" 
      });
    }

    const result = await detectionService.submitCaseToDoctor(
      detectionId, 
      patientId, 
      doctorId, 
      notes
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ status: "error", message: err.message });
    }
    console.error("Error submitting case:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getPatientCases = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const cases = await detectionService.getPatientCases(patientId, page, limit);

    res.status(200).json({ status: "success", data: cases });
  } catch (err) {
    console.error("Error getting patient cases:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ==================== DOCTOR CASE MANAGEMENT ENDPOINTS ====================

const getDoctorAssignedCases = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const cases = await detectionService.getDoctorAssignedCases(doctorId, page, limit);

    res.status(200).json({ status: "success", data: cases });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error getting doctor cases:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getCaseDetail = async (req, res) => {
  try {
    const { caseId } = req.params;

    const caseDetail = await detectionService.getCaseDetail(caseId);

    res.status(200).json({ status: "success", data: caseDetail });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error getting case detail:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const submitCaseReview = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { doctorId, observation, finalDiagnosis, status } = req.body;

    if (!doctorId || !status) {
      return res.status(400).json({
        status: "error",
        message: "doctorId and status are required"
      });
    }

    const result = await detectionService.submitCaseReview(
      caseId,
      doctorId,
      observation,
      finalDiagnosis,
      status
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ status: "error", message: err.message });
    }
    console.error("Error submitting case review:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// Ekspor sebagai objek
module.exports = { 
  predict,
  submitCaseToDoctor,
  getPatientCases,
  getDoctorAssignedCases,
  getCaseDetail,
  submitCaseReview
};