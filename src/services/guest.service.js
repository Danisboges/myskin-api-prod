/**
 * Guest Service
 * Business logic untuk guest user scanning
 * Tidak menyimpan data ke database
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { buildAiRequestHeaders, getAiModelConfig } = require('../utils/ai-model.util');

// ==================== IN-MEMORY CACHE FOR GUEST SCAN RESULTS ====================
/**
 * In-memory cache untuk menyimpan hasil scan guest secara temporary
 * Format: { sessionId: { data, timestamp, expiresAt } }
 * Cache akan auto-cleanup setelah 24 jam
 */
const guestScanCache = {};
const CACHE_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 jam dalam milliseconds

/**
 * Cleanup expired cache entries
 */
const cleanupExpiredCache = () => {
  const now = Date.now();
  for (const sessionId in guestScanCache) {
    if (guestScanCache[sessionId].expiresAt < now) {
      delete guestScanCache[sessionId];
      console.log(`Cache expired for sessionId: ${sessionId}`);
    }
  }
};

/**
 * Setup periodic cleanup setiap 1 jam
 */
const cleanupInterval = setInterval(cleanupExpiredCache, 60 * 60 * 1000);
cleanupInterval.unref?.();

// ==================== GUEST IMAGE ANALYSIS ====================

/**
 * Analyze guest image untuk melanoma detection menggunakan AI Model
 * Tidak menyimpan data ke database
 * @param {object} fileData - Multer file object dengan buffer
 * @param {string} complaint - Keluhan pasien (optional)
 * @param {string} bodySite - Lokasi di tubuh (optional)
 * @returns {object} Result deteksi dari AI model
 */
const analyzeGuestImage = async (fileData, complaint, bodySite) => {
  let tempFilePath = null;
  
  try {
    const { predictUrl } = getAiModelConfig();

    // 2. Validasi file
    if (!fileData || !fileData.buffer) {
      throw new Error('Invalid file data');
    }

    // 3. Save buffer to temporary file
    const tempFilename = `guest_scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileData.originalname.split('.').pop()}`;
    const uploadDir = path.join(__dirname, '../../uploads');
    tempFilePath = path.join(uploadDir, tempFilename);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(tempFilePath, fileData.buffer);

    // 4. Validasi file exists
    if (!fs.existsSync(tempFilePath)) {
      throw new Error(`Failed to save temporary file: ${tempFilePath}`);
    }

    // 5. Siapkan file untuk dikirim ke AI
    const form = new FormData();
    form.append('file', fs.createReadStream(tempFilePath));

    // 6. Request ke Model AI
    const aiResponse = await axios.post(predictUrl, form, {
      headers: buildAiRequestHeaders(form.getHeaders()),
      timeout: 30000 // 30 detik timeout
    });

    const aiResult = aiResponse.data;

    // 7. Generate sessionId yang unik
    const sessionId = `GUEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 7.1. Format response untuk guest
    const scanResult = {
      // Session-based ID untuk tracking dalam sesi guest saja
      sessionId: sessionId,
      
      // Image information
      imageUrl: `/uploads/${tempFilename}`,
      bodySite: bodySite || null,
      complaint: complaint || null,
      
      // AI Prediction Results dari model
      prediction: {
        label: aiResult.prediction || aiResult.class || 'Unknown',
        confidence: parseFloat(aiResult.confidence || aiResult.score || 0),
        confidencePercentage: Math.round((parseFloat(aiResult.confidence || aiResult.score || 0)) * 100),
        riskLevel: determineRiskLevel(parseFloat(aiResult.confidence || aiResult.score || 0), aiResult.prediction || aiResult.class)
      },
      
      // Analysis details
      analysisType: "guest_scan",
      timestamp: new Date().toISOString(),
      aiDetails: aiResult, // Store full AI response
      
      // Important disclaimer
      disclaimer: {
        title: "Medical Disclaimer",
        message: "This AI prediction is for informational purposes only and should NOT be used as a substitute for professional medical diagnosis. Please consult with a qualified dermatologist for accurate diagnosis and treatment recommendations.",
        severity: "critical"
      },
      
      // Next steps recommendation
      recommendation: {
        title: "Next Steps",
        steps: [
          "If you're concerned about the result, please see a dermatologist",
          "Create an account to save your scans and share with doctors",
          "Maintain a record of skin changes over time"
        ]
      },
      
      // Data retention info
      dataRetention: {
        isSaved: false,
        message: "This scan result is temporary and will not be saved. Create an account to save your results."
      }
    };

    // 8. Simpan hasil scan ke cache dengan expiration
    guestScanCache[sessionId] = {
      data: scanResult,
      timestamp: new Date(),
      expiresAt: Date.now() + CACHE_EXPIRATION_TIME
    };
    console.log(`Guest scan cached with sessionId: ${sessionId}`);

    return scanResult;
  } catch (err) {
    console.error("Guest analysis error:", err.message);
    
    // Berikan pesan error yang lebih spesifik
    const errorMessage = err.response 
      ? `AI Service Error: ${JSON.stringify(err.response.data)}` 
      : err.message;
      
    throw new Error(`Guest scan analysis failed: ${errorMessage}`);
  } finally {
    // 9. Delete temporary file after processing
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Temporary file deleted: ${tempFilePath}`);
      } catch (deleteErr) {
        console.error(`Failed to delete temporary file: ${deleteErr.message}`);
      }
    }
  }
};

// ==================== RETRIEVE GUEST SCAN RESULT ====================

/**
 * Get hasil scan guest berdasarkan sessionId
 * @param {string} sessionId - Session ID dari guest scan
 * @returns {object} Scan result atau null jika tidak ditemukan/expired
 */
const getGuestScanResult = (sessionId) => {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  // Cleanup expired cache terlebih dahulu
  cleanupExpiredCache();

  // Cek apakah sessionId ada di cache
  if (!guestScanCache[sessionId]) {
    return null;
  }

  const cachedData = guestScanCache[sessionId];
  
  // Validasi apakah cache masih valid
  if (cachedData.expiresAt < Date.now()) {
    delete guestScanCache[sessionId];
    return null;
  }

  return {
    ...cachedData.data,
    cacheInfo: {
      cachedAt: cachedData.timestamp,
      expiresAt: new Date(cachedData.expiresAt),
      timeRemaining: Math.round((cachedData.expiresAt - Date.now()) / 1000) + ' seconds'
    }
  };
};

/**
 * Get semua available guest scan sessions
 * Untuk debugging/monitoring purposes
 */
const getAllGuestScanSessions = () => {
  cleanupExpiredCache();
  
  const sessions = [];
  for (const sessionId in guestScanCache) {
    const cached = guestScanCache[sessionId];
    sessions.push({
      sessionId: sessionId,
      cachedAt: cached.timestamp,
      expiresAt: new Date(cached.expiresAt),
      riskLevel: cached.data.prediction.riskLevel,
      label: cached.data.prediction.label
    });
  }
  return sessions;
};

/**
 * Determine risk level based on prediction and confidence
 */
const determineRiskLevel = (confidence, label) => {
  if (label && label.toLowerCase().includes('melanoma')) {
    return confidence > 0.7 ? 'high' : 'medium';
  }
  return confidence > 0.7 ? 'low' : 'medium';
};

/**
 * Get informasi tentang guest scan feature
 */
const getGuestScanInfo = () => {
  return {
    feature: "Guest Melanoma Scan",
    description: "Free melanoma detection scan for guests without requiring login or registration",
    aiModel: {
      enabled: !!(process.env.AI_PREDICT_URL || process.env.AI_BASE_URL),
      baseUrl: process.env.AI_BASE_URL || 'Not configured',
      predictUrl: process.env.AI_PREDICT_URL || (process.env.AI_BASE_URL ? `${process.env.AI_BASE_URL.replace(/\/+$/, '')}/predict` : 'Not configured'),
      gradcamUrl: process.env.AI_GRADCAM_URL || (process.env.AI_BASE_URL ? `${process.env.AI_BASE_URL.replace(/\/+$/, '')}/viz` : 'Not configured'),
      status: (process.env.AI_PREDICT_URL || process.env.AI_BASE_URL) ? 'Active' : 'Not configured'
    },
    features: [
      "Quick AI analysis of skin lesion images using real ML model",
      "Instant results without database storage",
      "No personal information required",
      "Educational and diagnostic support purpose"
    ],
    limitations: [
      "Results are not saved",
      "Cannot track scans over time",
      "Cannot share results with doctors",
      "For informational purposes only - not a substitute for professional diagnosis"
    ],
    nextSteps: {
      toSaveResults: "Create a patient account",
      toShareWithDoctor: "Register and upload scans through patient dashboard",
      toGetProfessionalAdvice: "Consult with a qualified dermatologist"
    },
    disclaimer: "This tool is for educational and informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare professional for accurate diagnosis."
  };
};

module.exports = {
  analyzeGuestImage,
  getGuestScanResult,
  getAllGuestScanSessions,
  getGuestScanInfo
};
