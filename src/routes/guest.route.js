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
const { uploadSingleFile } = require('../middlewares/upload.middleware');

// ==================== GUEST SCAN ====================

/**
 * POST /api/guest/scan
 * Upload dan analisis image untuk guest user
 * Tidak memerlukan authentication
 * Data tidak disimpan ke database
 */
router.post(
  '/scan',
  uploadSingleFile('image'),
  guestController.scanImage
);

/**
 * GET /api/guest/scan/:sessionId
 * Retrieve hasil scan guest berdasarkan sessionId
 * Data bersifat temporary dan akan di-cleanup setelah 24 jam
 */
router.get(
  '/scan/:sessionId',
  guestController.getGuestScanResult
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
