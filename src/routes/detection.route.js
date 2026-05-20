// const express = require('express');
// const router = express.Router();

// // Gunakan kurung kurawal { } untuk mengambil fungsi spesifik
// const { verifyToken, isDoctor } = require('../middlewares/auth.middleware'); 
// const detectionController = require('../controllers/detection.controller');

// // ==================== DOCTOR CASE MANAGEMENT ====================
// // GET /api/detection/doctor/:doctorId/cases - Get cases assigned to doctor
// router.get("/doctor/:doctorId/cases", verifyToken, isDoctor, detectionController.getDoctorAssignedCases);

// // GET /api/detection/cases/:caseId - Get case detail
// router.get("/cases/:caseId", verifyToken, detectionController.getCaseDetail);

// // POST /api/detection/cases/:caseId/review - Submit case review
// router.post("/cases/:caseId/review", verifyToken, isDoctor, detectionController.submitCaseReview);

// module.exports = router;