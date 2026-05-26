/**
 * Guest Controller
 * Menangani request untuk guest user yang tidak perlu login
 * Guest dapat melakukan scan tanpa menyimpan data ke database
 */

const guestService = require('../services/guest.service');

// ==================== GUEST SCAN ====================

/**
 * POST /api/guest/scan
 * Guest user scan - analyze image without login
 * Data tidak disimpan ke database
 */
const scanImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        status: "error", 
        message: "No file uploaded" 
      });
    }

    const { complaint, bodySite } = req.body;

    // Guest detection without database save
    // Pass file buffer directly to service
    const result = await guestService.analyzeGuestImage(req.file, complaint, bodySite);

    res.status(200).json({
      status: "success",
      message: "Guest scan completed successfully. Data is not saved to database.",
      data: result
    });
  } catch (err) {
    console.error("Error in guest scan:", err.message);
    res.status(500).json({ 
      status: "error", 
      message: err.message 
    });
  }
};

/**
 * GET /api/guest/scan/:sessionId
 * Retrieve hasil scan guest dari cache
 * Data bersifat temporary dan akan di-cleanup setelah 24 jam
 */
const getGuestScanResult = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        status: "error",
        message: "Session ID is required"
      });
    }

    const result = guestService.getGuestScanResult(sessionId);

    if (!result) {
      return res.status(404).json({
        status: "error",
        message: "Scan result not found or has expired. The session data is only kept for 24 hours."
      });
    }

    res.status(200).json({
      status: "success",
      message: "Guest scan result retrieved successfully",
      data: result
    });
  } catch (err) {
    console.error("Error retrieving guest scan result:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

/**
 * GET /api/guest/info
 * Informasi tentang guest scan feature
 */
const getGuestInfo = async (req, res) => {
  try {
    const info = guestService.getGuestScanInfo();
    res.status(200).json({
      status: "success",
      data: info
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

module.exports = {
  scanImage,
  getGuestScanResult,
  getGuestInfo
};
