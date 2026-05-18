/**
 * Guest Routes
 * /api/guest/*
 * 
 * No authentication required
 * Guest user dapat menggunakan fitur scan tanpa login
 */

const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');
const upload = require('../middlewares/upload.middleware');

// ==================== GUEST SCAN ====================

/**
 * POST /api/guest/scan
 * Upload dan analisis image untuk guest user
 * Tidak memerlukan authentication
 * Data tidak disimpan ke database
 */
router.post(
  '/scan',
  upload.single('image'),
  guestController.scanImage
);

/**
 * GET /api/guest/info
 * Get informasi tentang guest scan feature
 */
router.get(
  '/info',
  guestController.getGuestInfo
);

module.exports = router;
