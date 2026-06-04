const express = require("express");
const router = express.Router();
const clinicController = require("../controllers/clinic.controller");
const { verifyToken, optionalVerifyToken, isAdmin } = require("../middlewares/auth.middleware");

// GET /api/v1/clinics
router.get("/", optionalVerifyToken, clinicController.getClinics);

// GET /api/v1/clinics/:clinicId
router.get("/:clinicId", clinicController.getClinicById);

// POST /api/v1/clinics
router.post("/", verifyToken, isAdmin, clinicController.createClinic);

// PATCH /api/v1/clinics/:clinicId
router.patch("/:clinicId", verifyToken, isAdmin, clinicController.updateClinic);

// DELETE /api/v1/clinics/:clinicId
router.delete("/:clinicId", verifyToken, isAdmin, clinicController.deleteClinic);

module.exports = router;
