/**
 * Consultation Service
 * Menangani business logic untuk chat konsultasi antara patient dan doctor
 * Includes: create consultation, send messages, close consultation
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { publishConsultationEvent } = require('./consultation-events.service');
const systemLogService = require('./system-log.service');
const emailService = require('./email.service');
const doctorNotificationService = require('./doctor-notification.service');

const CHAT_ATTACHMENT_DIR = path.join(__dirname, '../../uploads/chat-attachments');
const CHAT_ATTACHMENT_URL_PREFIX = '/uploads/chat-attachments';

const ensureAttachmentDir = () => {
  if (!fs.existsSync(CHAT_ATTACHMENT_DIR)) {
    fs.mkdirSync(CHAT_ATTACHMENT_DIR, { recursive: true });
  }
};

const safeFileName = (name = 'attachment') => (
  name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'attachment'
);

const saveMessageAttachments = (files = []) => {
  if (!files.length) {
    return [];
  }

  ensureAttachmentDir();

  return files.map((file) => {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFileName(file.originalname)}`;
    const filepath = path.join(CHAT_ATTACHMENT_DIR, filename);
    fs.writeFileSync(filepath, file.buffer);

    return {
      url: `${CHAT_ATTACHMENT_URL_PREFIX}/${filename}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    };
  });
};

const mapAttachment = (attachment) => ({
  id: attachment.id,
  url: attachment.url,
  fileName: attachment.fileName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  createdAt: attachment.createdAt
});

const mapChatMessage = (chatMessage) => ({
  id: chatMessage.id,
  message: chatMessage.message,
  sender: chatMessage.sender,
  senderRole: chatMessage.sender?.role || null,
  timestamp: chatMessage.timestamp,
  createdAt: chatMessage.timestamp,
  consultationId: chatMessage.consultationId,
  attachments: (chatMessage.attachments || []).map(mapAttachment)
});

const buildConsultationSubject = (consultation) => {
  const scan = consultation.scan || {};
  if (scan.complaint) {
    return scan.complaint;
  }
  if (scan.bodySite) {
    return `Consultation for ${scan.bodySite}`;
  }
  if (scan.scanId) {
    return `Consultation for scan ${scan.scanId}`;
  }
  return 'Medical consultation';
};

const isAiTriageRequired = (scan = {}, caseReview = null) => {
  const prediction = String(scan.aiPrediction || '').toLowerCase();
  const concerningPrediction = prediction.includes('melanoma') || prediction.includes('malignant');
  const lowConfidence = typeof scan.aiConfidence === 'number' && scan.aiConfidence < 0.7;
  const pendingReview = ['pending_review', 'under_review'].includes(caseReview?.reviewStatus);

  return !scan.isAnalyzed || concerningPrediction || lowConfidence || pendingReview;
};

const queueClinicalSummaryEmail = (consultation, report, reportData) => {
  if (!reportData.emailClinicalSummary || !consultation.patient?.email) {
    return false;
  }

  setImmediate(async () => {
    try {
      await emailService.sendClinicalSummaryEmail({
        to: consultation.patient.email,
        patientName: consultation.patient.name,
        doctorName: consultation.doctor?.name,
        scanId: consultation.scan?.scanId,
        caseDisposition: report.caseDisposition,
        finalClinicalNotes: report.finalClinicalNotes,
        diagnosis: report.diagnosis,
        recommendation: report.recommendation,
      });
    } catch (error) {
      console.error('Failed to send clinical summary email:', error.message);
    }
  });

  return true;
};

const buildDateRangeFilter = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return undefined;
  }

  const range = {};
  if (startDate) {
    range.gte = startDate;
  }
  if (endDate) {
    const inclusiveEndDate = new Date(endDate);
    inclusiveEndDate.setHours(23, 59, 59, 999);
    range.lte = inclusiveEndDate;
  }

  return range;
};

// ==================== CONSULTATION MANAGEMENT ====================

/**
 * Inisial konsultasi baru antara patient dan doctor
 * @param {string} userId - Patient user ID
 * @param {string} doctorId - Doctor ID dari payload. Bisa DoctorProfile.id atau User.id.
 * @param {string} scanId - Scan ID yang akan didiskusikan
 * @param {string} initialMessage - Pesan awal dari patient
 * @returns {object} Consultation object
 */
const initiateConsultation = async (userId, doctorId, scanId, initialMessage) => {
  try {
    // 1. Validasi bahwa user adalah patient
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!patientProfile) {
      throw new Error('Patient profile not found');
    }

    // 2. Validasi bahwa scan milik patient ini
    const scan = await prisma.scan.findUnique({
      where: { scanId },
      include: { patient: true, caseReview: true }
    });

    if (!scan) {
      throw new Error('Scan not found');
    }

    if (scan.patientId !== patientProfile.id) {
      throw new Error('Unauthorized: Scan does not belong to this patient');
    }

    // 3. Validasi bahwa doctor ada dan valid.
    // Available doctors endpoint returns User.id, while older clients may send DoctorProfile.id.
    const doctor = await prisma.doctorProfile.findFirst({
      where: {
        OR: [
          { id: doctorId },
          { userId: doctorId }
        ]
      },
      include: { user: true }
    });

    if (!doctor) {
      throw new Error('Doctor not found');
    }

    // 4. Cek apakah sudah ada consultation untuk scan ini
    const existingConsultation = await prisma.consultation.findUnique({
      where: { scanId: scan.id }
    });

    if (existingConsultation) {
      throw new Error('Consultation already exists for this scan');
    }

    // 5. Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        scanId: scan.id,
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

    const reviewThreshold = 0.7;
    if (isAiTriageRequired(scan, scan.caseReview)) {
      await systemLogService.createSystemLog({
        severity: "warning",
        category: "ai_engine",
        title: "AI confidence below review threshold",
        description: "Scan analysis requires doctor review",
        metadata: {
          scanId: scan.scanId,
          confidence: scan.aiConfidence,
          threshold: reviewThreshold,
        },
      });
    }

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
const getConsultationList = async (userId, role, filters = {}) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', startDate = null, endDate = null } = filters;
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

    if (status) {
      whereClause.status = status;
    }

    const dateRange = buildDateRangeFilter(startDate, endDate);
    if (dateRange) {
      whereClause.createdAt = dateRange;
    }

    if (search) {
      whereClause.OR = [
        {
          patient: {
            is: {
              name: { contains: search, mode: 'insensitive' }
            }
          }
        },
        {
          patient: {
            is: {
              email: { contains: search, mode: 'insensitive' }
            }
          }
        },
        {
          scan: {
            is: {
              scanId: { contains: search, mode: 'insensitive' }
            }
          }
        },
        {
          scan: {
            is: {
              complaint: { contains: search, mode: 'insensitive' }
            }
          }
        },
        {
          scan: {
            is: {
              bodySite: { contains: search, mode: 'insensitive' }
            }
          }
        }
      ];
    }

    // Get consultations dengan pagination
    const consultations = await prisma.consultation.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        patient: { select: { id: true, name: true, email: true, avatarUrl: true } },
        doctor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        scan: {
          include: {
            caseReview: true
          }
        },
        messages: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          include: {
            sender: { select: { id: true, name: true, role: true, avatarUrl: true } },
            attachments: true
          }
        },
        _count: {
          select: { messages: true }
        }
      }
    });

    const consultationIds = consultations.map((consultation) => consultation.id);
    const unreadCounts = consultationIds.length
      ? await prisma.chatMessage.groupBy({
        by: ['consultationId'],
        where: {
          consultationId: { in: consultationIds },
          senderId: { not: userId },
          readReceipts: {
            none: { userId }
          }
        },
        _count: { _all: true }
      })
      : [];

    const unreadCountByConsultationId = unreadCounts.reduce((acc, item) => {
      acc[item.consultationId] = item._count._all;
      return acc;
    }, {});

    // Get total count untuk pagination
    const total = await prisma.consultation.count({
      where: whereClause
    });

    return {
      data: consultations.map(c => ({
        id: c.id,
        consultationId: c.id,
        patient: {
          id: c.patient.id,
          name: c.patient.name,
          avatarUrl: c.patient.avatarUrl
        },
        doctor: c.doctor,
        scan: {
          id: c.scan.id,
          scanId: c.scan.scanId,
          imageUrl: c.scan.imageUrl,
          aiPrediction: c.scan.aiPrediction,
          aiConfidence: c.scan.aiConfidence,
          complaint: c.scan.complaint,
          bodySite: c.scan.bodySite
        },
        status: c.status,
        subject: buildConsultationSubject(c),
        messageCount: c._count.messages,
        lastMessage: c.messages[0]
          ? {
            message: c.messages[0].message,
            createdAt: c.messages[0].timestamp,
            senderRole: c.messages[0].sender?.role || null,
            attachments: (c.messages[0].attachments || []).map(mapAttachment)
          }
          : null,
        lastMessageAt: c.messages[0]?.timestamp || c.updatedAt,
        unreadCount: unreadCountByConsultationId[c.id] || 0,
        aiTriageRequired: isAiTriageRequired(c.scan, c.scan?.caseReview),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        lastPage: Math.ceil(total / limit)
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
          include: {
            caseReview: true
          }
        },
        messages: {
          orderBy: { timestamp: 'asc' },
          include: {
            sender: { select: { id: true, name: true, role: true, avatarUrl: true } },
            attachments: true,
            readReceipts: true
          }
        },
        prescriptions: {
          orderBy: { createdAt: 'desc' }
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

    const report = await prisma.report.findFirst({
      where: {
        scanId: consultation.scan.id,
        patientId: consultation.patientId
      },
      orderBy: { createdAt: 'desc' },
      select: {
        reportId: true,
        title: true,
        description: true,
        diagnosis: true,
        recommendation: true,
        caseDisposition: true,
        finalClinicalNotes: true,
        status: true,
        approvedByDoctorId: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      id: consultation.id,
      status: consultation.status,
      patient: consultation.patient,
      doctor: consultation.doctor,
      scan: {
        id: consultation.scan.id,
        scanId: consultation.scan.scanId,
        imageUrl: consultation.scan.imageUrl,
        aiPrediction: consultation.scan.aiPrediction,
        aiConfidence: consultation.scan.aiConfidence,
        aiDetails: consultation.scan.aiDetails,
        isAnalyzed: consultation.scan.isAnalyzed,
        analyzeCompletedAt: consultation.scan.analyzeCompletedAt,
        complaint: consultation.scan.complaint,
        bodySite: consultation.scan.bodySite,
        caseReview: consultation.scan.caseReview
      },
      subject: buildConsultationSubject(consultation),
      aiTriageRequired: isAiTriageRequired(consultation.scan, consultation.scan?.caseReview),
      messages: consultation.messages.map(mapChatMessage),
      messageCount: consultation.messages.length,
      prescriptions: consultation.prescriptions,
      createdAt: consultation.createdAt,
      updatedAt: consultation.updatedAt,
      closedAt: consultation.status === 'CLOSED' ? consultation.updatedAt : null,
      report: report || null
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
const sendMessage = async (consultationId, senderId, message, files = []) => {
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

    const attachments = saveMessageAttachments(files);

    // 3. Create message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        consultationId,
        senderId,
        message,
        timestamp: new Date(),
        attachments: attachments.length
          ? {
            create: attachments
          }
          : undefined,
        readReceipts: {
          create: {
            userId: senderId
          }
        }
      },
      include: {
        sender: { select: { id: true, name: true, role: true, avatarUrl: true } },
        attachments: true
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
      (message || 'Sent an attachment').substring(0, 100),
      'consultation_message'
    );

    // 5. Update consultation updatedAt
    await prisma.consultation.update({
      where: { id: consultationId },
      data: { updatedAt: new Date() }
    });

    publishConsultationEvent(consultationId, 'message:new', mapChatMessage(chatMessage));

    return mapChatMessage(chatMessage);
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
        sender: { select: { id: true, name: true, role: true, avatarUrl: true } },
        attachments: true,
        readReceipts: true
      }
    });

    // Get total count
    const total = await prisma.chatMessage.count({
      where: { consultationId }
    });

    return {
      data: messages.reverse().map(mapChatMessage), // Reverse untuk display ascending
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        lastPage: Math.ceil(total / limit)
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
    const report = await prisma.report.create({
      data: {
        scanId: consultation.scanId,
        patientId: consultation.scan.patientId,
        title: `Consultation Report - ${consultation.scan.scanId}`,
        description: reportData.notes || null,
        diagnosis: reportData.diagnosis || reportData.caseDisposition,
        recommendation: reportData.recommendation || '',
        caseDisposition: reportData.caseDisposition,
        finalClinicalNotes: reportData.finalClinicalNotes,
        status: 'approved',
        approvedByDoctorId: userId,
        approvedAt: new Date()
      }
    });

    // 4. Update consultation status
    const updatedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: 'CLOSED'
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

    const emailClinicalSummaryQueued = queueClinicalSummaryEmail(
      consultation,
      report,
      reportData
    );

    publishConsultationEvent(consultationId, 'consultation:status_updated', {
      status: updatedConsultation.status,
      closedAt: updatedConsultation.updatedAt
    });

    return {
      id: updatedConsultation.id,
      status: updatedConsultation.status,
      patient: updatedConsultation.patient,
      doctor: updatedConsultation.doctor,
      scan: updatedConsultation.scan,
      messageCount: updatedConsultation.messages.length,
      report: {
        id: report.id,
        reportId: report.reportId,
        title: report.title,
        diagnosis: report.diagnosis,
        recommendation: report.recommendation,
        notes: report.description,
        caseDisposition: report.caseDisposition,
        finalClinicalNotes: report.finalClinicalNotes,
        generatedAt: report.createdAt
      },
      emailClinicalSummaryQueued,
      closedAt: updatedConsultation.updatedAt,
      message: 'Consultation closed successfully'
    };
  } catch (error) {
    throw new Error(`Failed to close consultation: ${error.message}`);
  }
};

/**
 * Delete closed consultation and its chat-related data.
 * Reports are intentionally preserved because Report is tied to scanId/patientId,
 * not consultationId, in the current schema.
 */
const deleteClosedConsultation = async (consultationId, doctorUserId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.findUnique({
        where: { id: consultationId },
        select: {
          id: true,
          doctorId: true,
          status: true
        }
      });

      if (!consultation) {
        throw new Error('Consultation not found');
      }

      if (consultation.doctorId !== doctorUserId) {
        throw new Error('Unauthorized: Only assigned doctor can delete consultation');
      }

      if (consultation.status !== 'CLOSED') {
        throw new Error('Only closed consultations can be deleted');
      }

      await tx.chatMessageReadReceipt.deleteMany({
        where: { message: { consultationId } }
      });
      await tx.chatMessageAttachment.deleteMany({
        where: { message: { consultationId } }
      });
      await tx.chatMessage.deleteMany({
        where: { consultationId }
      });
      await tx.prescription.deleteMany({
        where: { consultationId }
      });
      await tx.consultation.delete({
        where: { id: consultationId }
      });

      return {
        message: 'Consultation deleted successfully'
      };
    });
  } catch (error) {
    throw new Error(`Failed to delete consultation: ${error.message}`);
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

    const whereClause = {
      consultationId,
      senderId: { not: userId }
    };

    if (messageIds.length > 0) {
      whereClause.id = { in: messageIds };
    }

    const messagesToMark = await prisma.chatMessage.findMany({
      where: whereClause,
      select: { id: true }
    });

    if (messagesToMark.length > 0) {
      await prisma.chatMessageReadReceipt.createMany({
        data: messagesToMark.map((message) => ({
          messageId: message.id,
          userId,
          readAt: new Date()
        })),
        skipDuplicates: true
      });
    }

    publishConsultationEvent(consultationId, 'message:read_receipt', {
      userId,
      messageIds: messagesToMark.map((message) => message.id),
      readAt: new Date().toISOString()
    });

    return {
      message: `Marked ${messagesToMark.length} messages as read`,
      markedCount: messagesToMark.length
    };
  } catch (error) {
    throw new Error(`Failed to mark messages as read: ${error.message}`);
  }
};

/**
 * Create prescription for a consultation.
 */
const createPrescription = async (consultationId, doctorUserId, prescriptionData) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId }
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    if (consultation.doctorId !== doctorUserId) {
      throw new Error('Unauthorized: Only assigned doctor can create prescriptions');
    }

    const prescription = await prisma.prescription.create({
      data: {
        consultationId,
        doctorId: doctorUserId,
        patientId: consultation.patientId,
        medicationName: prescriptionData.medicationName,
        dosage: prescriptionData.dosage || null,
        frequency: prescriptionData.frequency || null,
        duration: prescriptionData.duration || null,
        notes: prescriptionData.notes || null
      }
    });

    await createConsultationNotification(
      consultation.patientId,
      'Resep Baru',
      `Dokter menambahkan resep: ${prescription.medicationName}`,
      'consultation_prescription'
    );

    publishConsultationEvent(consultationId, 'prescription:created', prescription);

    return prescription;
  } catch (error) {
    throw new Error(`Failed to create prescription: ${error.message}`);
  }
};

/**
 * Get AI analysis details for a consultation.
 */
const getAiAnalysis = async (consultationId, userId) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        scan: {
          include: {
            caseReview: true
          }
        }
      }
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

    const scan = consultation.scan;

    return {
      consultationId: consultation.id,
      scan: {
        id: scan.id,
        scanId: scan.scanId,
        imageUrl: scan.imageUrl,
        bodySite: scan.bodySite,
        complaint: scan.complaint,
        isAnalyzed: scan.isAnalyzed,
        aiPrediction: scan.aiPrediction,
        aiConfidence: scan.aiConfidence,
        aiDetails: scan.aiDetails,
        analyzeCompletedAt: scan.analyzeCompletedAt
      },
      caseReview: scan.caseReview,
      aiTriageRequired: isAiTriageRequired(scan, scan.caseReview)
    };
  } catch (error) {
    throw new Error(`Failed to get AI analysis: ${error.message}`);
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        doctorProfile: { select: { id: true } },
        patientProfile: { select: { id: true } }
      }
    });

    if (!user) {
      return;
    }

    if (user.role === 'doctor' && user.doctorProfile) {
      const doctorNotificationType = type === 'consultation_request'
        ? 'case_request'
        : 'system_message';

      await doctorNotificationService.createDoctorNotification({
        doctorId: user.doctorProfile.id,
        title,
        message,
        type: doctorNotificationType
      });
      return;
    }

    if (user.role === 'patient' && user.patientProfile) {
      await prisma.patientNotification.create({
        data: {
          patientId: user.patientProfile.id,
          title,
          message,
          type,
          isRead: false
        }
      });
    }
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
  deleteClosedConsultation,
  markMessagesAsRead,
  createPrescription,
  getAiAnalysis,

  // Helper functions
  createConsultationNotification,
  getUnreadConsultationCount
};
