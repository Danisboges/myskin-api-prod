const express = require("express");
const router = express.Router();
const clinicRequestController = require("../controllers/clinic-request.controller");
const { verifyToken, isAdmin } = require("../middlewares/auth.middleware");

// POST /api/v1/clinic-requests
router.post("/", clinicRequestController.createClinicRequest);

// GET /api/v1/clinic-requests
router.get("/", verifyToken, isAdmin, clinicRequestController.getClinicRequests);

// PATCH /api/v1/clinic-requests/:id
router.patch("/:id", verifyToken, isAdmin, clinicRequestController.reviewClinicRequest);

module.exports = router;
