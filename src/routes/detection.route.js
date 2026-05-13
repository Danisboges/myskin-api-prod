const express = require('express');
const router = express.Router();

// Gunakan kurung kurawal { } untuk mengambil fungsi spesifik
const { verifyToken, isDoctor } = require('../middlewares/auth.middleware'); 
const upload = require('../middlewares/upload.middleware');
const detectionController = require('../controllers/detection.controller');

// ==================== DETECTION PREDICTION ====================
// POST /api/detection - Create detection from image
router.post("/", verifyToken, upload.single("image"), detectionController.predict);

// ==================== PATIENT CASE SUBMISSION ====================
// POST /api/detection/cases/:detectionId/submit/:doctorId - Submit case to doctor
router.post("/cases/:detectionId/submit/:doctorId", verifyToken, detectionController.submitCaseToDoctor);

// GET /api/detection/my-cases - Get patient's submitted cases
router.get("/my-cases", verifyToken, detectionController.getPatientCases);

// ==================== DOCTOR CASE MANAGEMENT ====================
// GET /api/detection/doctor/:doctorId/cases - Get cases assigned to doctor
router.get("/doctor/:doctorId/cases", verifyToken, isDoctor, detectionController.getDoctorAssignedCases);

// GET /api/detection/cases/:caseId - Get case detail
router.get("/cases/:caseId", verifyToken, detectionController.getCaseDetail);

// POST /api/detection/cases/:caseId/review - Submit case review
router.post("/cases/:caseId/review", verifyToken, isDoctor, detectionController.submitCaseReview);

module.exports = router;