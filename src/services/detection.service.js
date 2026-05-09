const prisma = require('../config/prisma');

const createDetection = async (userId, filePath, complaint) => {
  return await prisma.detection.create({
    data: {
      userId: userId,
      imageUrl: filePath,
      result: "Malignant (Simulation)", // Contoh hasil dummy
      confidence: 0.85, // Contoh skor dummy
      complaint: complaint                
    }
  });
};

module.exports = { createDetection };
const getHistoryByUserId = async (userId) => {
  return await prisma.detection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
};

module.exports = { createDetection, getHistoryByUserId };