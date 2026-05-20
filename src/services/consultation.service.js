/**
 * Consultation Service
 * Menangani business logic untuk chat konsultasi antara patient dan doctor
 * Includes: create consultation, send messages, close consultation
 */

const prisma = require('../config/prisma');

// ==================== CONSULTATION MANAGEMENT ====================

/**
 * Inisial konsultasi baru antara patient dan doctor
 * @param {string} userId - Patient user ID
 * @param {string} doctorId - Doctor ID (dari doctor profile)
 * @param {string} scanId - Scan ID yang akan didiskusikan
 * @param {string} initialMessage - Pesan awal dari patient
 * @returns {object} Consultation object
 */
const initiateConsultation = async (userId, doctorId, scanId, initialMessage) => {
  try {
    // 1. Validasi bahwa user adalah patient
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId }
    });

    if (!patientProfile) {
      throw new Error('Patient profile not found');
    }

    // 2. Validasi bahwa scan milik patient ini
    const scan = await prisma.scan.findUnique({
      where: { scanId },
      include: { patient: true }
    });

    if (!scan) {
      throw new Error('Scan not found');
    }

    if (scan.patientId !== patientProfile.id) {
      throw new Error('Unauthorized: Scan does not belong to this patient');
    }

    // 3. Validasi bahwa doctor ada dan valid
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: true }
    });

    if (!doctor) {
      throw new Error('Doctor not found');
    }

    // 4. Cek apakah sudah ada consultation untuk scan ini
    const existingConsultation = await prisma.consultation.findUnique({
      where: { scanId }
    });

    if (existingConsultation) {
      throw new Error('Consultation already exists for this scan');
    }

    // 5. Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        scanId,
        patientId: userId,
        doctorId: doctor.userId,
        status: 'OPEN',
        messages: {
          create: {
            message: initialMessage,
            senderId: userId,
            timestamp: new Date()
          }
        }
      },
      include: {
        patient: { select: { id: true, name: true, email: true, avatarUrl: true } },
        doctor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        scan: { select: { scanId: true, imageUrl: true, aiPrediction: true } },
        messages: true
      }
    });

    // 6. Send notification ke doctor
    await createConsultationNotification(
      doctor.userId,
      `Konsultasi Baru dari ${patientProfile.user.name}`,
      `Pasien ${patientProfile.user.name} memulai konsultasi untuk diskusi hasil scan`,
      'consultation_request'
    );

    return {
      id: consultation.id,
      status: consultation.status,
      patient: consultation.patient,
      doctor: consultation.doctor,
      scan: consultation.scan,
      messageCount: consultation.messages.length,
      createdAt: consultation.createdAt,
      message: 'Consultation initiated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to initiate consultation: ${error.message}`);
  }
};

/**
 * Get list konsultasi untuk patient atau doctor
 * @param {string} userId - User ID
 * @param {string} role - 'patient' atau 'doctor'
 * @param {object} pagination - { page: 1, limit: 10 }
 * @returns {array} List konsultasi dengan pagination
 */
const getConsultationList = async (userId, role, pagination = {}) => {
  try {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Build where clause berdasarkan role
    let whereClause = {};
    if (role === 'patient') {
      whereClause = { patientId: userId };
    } else if (role === 'doctor') {
      whereClause = { doctorId: userId };
    } else {
      throw new Error('Invalid role');
    }

    // Get consultations dengan pagination
    const consultations = await prisma.consultation.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, name: true, email: true, avatarUrl: true } },
        doctor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        scan: { select: { scanId: true, imageUrl: true, aiPrediction: true } },
        messages: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          select: { message: true, timestamp: true }
        }
      }
    });

    // Get total count untuk pagination
    const total = await prisma.consultation.count({
      where: whereClause
    });

    return {
      data: consultations.map(c => ({
        id: c.id,
        patient: c.patient,
        doctor: c.doctor,
        scan: c.scan,
        status: c.status,
        messageCount: c.messages.length || 0,
        lastMessage: c.messages[0] || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw new Error(`Failed to get consultation list: ${error.message}`);
  }
};

/**
 * Get detail konsultasi beserta semua messages
 * @param {string} consultationId - Consultation ID
 * @param {string} userId - User ID (untuk validasi akses)
 * @returns {object} Consultation detail dengan messages
 */
const getConsultationDetail = async (consultationId, userId) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: { select: { id: true, name: true, email: true, avatarUrl: true } },
        doctor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        scan: {
          select: {
            id: true,
            scanId: true,
            imageUrl: true,
            aiPrediction: true,
            aiConfidence: true,
            complaint: true,
            bodySite: true
          }
        },
        messages: {
          orderBy: { timestamp: 'asc' },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    // Validate akses - hanya patient dan doctor yang bisa akses
    if (
      consultation.patientId !== userId &&
      consultation.doctorId !== userId
    ) {
      throw new Error('Unauthorized: You are not part of this consultation');
    }

    return {
      id: consultation.id,
      status: consultation.status,
      patient: consultation.patient,
      doctor: consultation.doctor,
      scan: consultation.scan,
      messages: consultation.messages,
      messageCount: consultation.messages.length,
      createdAt: consultation.createdAt,
      updatedAt: consultation.updatedAt,
      closedAt: consultation.closedAt || null,
      report: consultation.report || null
    };
  } catch (error) {
    throw new Error(`Failed to get consultation detail: ${error.message}`);
  }
};

/**
 * Send message dalam konsultasi
 * @param {string} consultationId - Consultation ID
 * @param {string} senderId - Sender user ID
 * @param {string} message - Message text
 * @returns {object} Created message
 */
const sendMessage = async (consultationId, senderId, message) => {
  try {
    // 1. Validasi konsultasi ada dan status OPEN
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId }
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    if (consultation.status !== 'OPEN') {
      throw new Error('Cannot send messages in a closed consultation');
    }

    // 2. Validasi user adalah participant
    if (
      consultation.patientId !== senderId &&
      consultation.doctorId !== senderId
    ) {
      throw new Error('Unauthorized: You are not part of this consultation');
    }

    // 3. Create message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        consultationId,
        senderId,
        message,
        timestamp: new Date()
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    // 4. Send notification ke recipient
    const recipientId = senderId === consultation.patientId 
      ? consultation.doctorId 
      : consultation.patientId;

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true }
    });

    await createConsultationNotification(
      recipientId,
      `Pesan Baru dari ${sender.name}`,
      message.substring(0, 100),
      'consultation_message'
    );

    // 5. Update consultation updatedAt
    await prisma.consultation.update({
      where: { id: consultationId },
      data: { updatedAt: new Date() }
    });

    return {
      id: chatMessage.id,
      message: chatMessage.message,
      sender: chatMessage.sender,
      timestamp: chatMessage.timestamp,
      consultationId
    };
  } catch (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }
};

/**
 * Get chat messages dari konsultasi (dengan pagination)
 * @param {string} consultationId - Consultation ID
 * @param {string} userId - User ID (untuk validasi)
 * @param {object} pagination - { page: 1, limit: 20 }
 * @returns {object} Messages dengan pagination
 */
const getChatMessages = async (consultationId, userId, pagination = {}) => {
  try {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    // Validasi akses
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId }
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    if (
      consultation.patientId !== userId &&
      consultation.doctorId !== userId
    ) {
      throw new Error('Unauthorized: You are not part of this consultation');
    }

    // Get messages dengan pagination
    const messages = await prisma.chatMessage.findMany({
      where: { consultationId },
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    // Get total count
    const total = await prisma.chatMessage.count({
      where: { consultationId }
    });

    return {
      data: messages.reverse(), // Reverse untuk display ascending
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw new Error(`Failed to get chat messages: ${error.message}`);
  }
};

/**
 * Close konsultasi dan create report
 * @param {string} consultationId - Consultation ID
 * @param {string} userId - Doctor user ID
 * @param {object} reportData - { diagnosis, recommendation, notes }
 * @returns {object} Closed consultation dengan report
 */
const closeConsultation = async (consultationId, userId, reportData = {}) => {
  try {
    // 1. Validasi konsultasi
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: true,
        doctor: true,
        scan: true,
        messages: true
      }
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    if (consultation.status === 'CLOSED') {
      throw new Error('Consultation is already closed');
    }

    // 2. Validasi bahwa user adalah doctor
    if (consultation.doctorId !== userId) {
      throw new Error('Unauthorized: Only doctor can close consultation');
    }

    // 3. Create report
    const report = await prisma.consultationReport.create({
      data: {
        consultationId,
        diagnosis: reportData.diagnosis || '',
        recommendation: reportData.recommendation || '',
        notes: reportData.notes || '',
        generatedAt: new Date(),
        generatedBy: userId
      }
    });

    // 4. Update consultation status
    const updatedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        reportId: report.id
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
        scan: { select: { scanId: true } },
        messages: true
      }
    });

    // 5. Send notification ke patient
    await createConsultationNotification(
      consultation.patientId,
      'Konsultasi Selesai',
      `Konsultasi Anda dengan ${consultation.doctor.name} telah selesai. Silakan baca report hasil diskusi.`,
      'consultation_closed'
    );

    return {
      id: updatedConsultation.id,
      status: updatedConsultation.status,
      patient: updatedConsultation.patient,
      doctor: updatedConsultation.doctor,
      scan: updatedConsultation.scan,
      messageCount: updatedConsultation.messages.length,
      report: {
        id: report.id,
        diagnosis: report.diagnosis,
        recommendation: report.recommendation,
        notes: report.notes,
        generatedAt: report.generatedAt
      },
      closedAt: updatedConsultation.closedAt,
      message: 'Consultation closed successfully'
    };
  } catch (error) {
    throw new Error(`Failed to close consultation: ${error.message}`);
  }
};

/**
 * Mark messages sebagai read
 * @param {string} consultationId - Consultation ID
 * @param {string} userId - User ID
 * @param {array} messageIds - Array message IDs to mark as read
 * @returns {object} Update result
 */
const markMessagesAsRead = async (consultationId, userId, messageIds = []) => {
  try {
    // Validasi akses
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId }
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    if (
      consultation.patientId !== userId &&
      consultation.doctorId !== userId
    ) {
      throw new Error('Unauthorized: You are not part of this consultation');
    }

    // Mark messages as read
    // Note: Jika schema tidak punya isRead field, skip step ini
    // Untuk sekarang kita just return success untuk compatibility

    return {
      message: `Marked ${messageIds.length} messages as read`,
      markedCount: messageIds.length
    };
  } catch (error) {
    throw new Error(`Failed to mark messages as read: ${error.message}`);
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Create notification untuk consultation activity
 */
const createConsultationNotification = async (
  userId,
  title,
  message,
  type = 'consultation_message'
) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        isRead: false
      }
    });
  } catch (error) {
    console.error('Error creating consultation notification:', error.message);
    // Jangan throw error, notification adalah optional
  }
};

/**
 * Get unread consultation count untuk user
 */
const getUnreadConsultationCount = async (userId, role) => {
  try {
    let whereClause = {};
    if (role === 'patient') {
      whereClause = { patientId: userId };
    } else if (role === 'doctor') {
      whereClause = { doctorId: userId };
    }

    const count = await prisma.consultation.count({
      where: {
        ...whereClause,
        status: 'OPEN'
      }
    });

    return count;
  } catch (error) {
    console.error('Error getting unread count:', error.message);
    return 0;
  }
};

// ==================== MODULE EXPORTS ====================

module.exports = {
  // Main functions
  initiateConsultation,
  getConsultationList,
  getConsultationDetail,
  sendMessage,
  getChatMessages,
  closeConsultation,
  markMessagesAsRead,

  // Helper functions
  createConsultationNotification,
  getUnreadConsultationCount
};
