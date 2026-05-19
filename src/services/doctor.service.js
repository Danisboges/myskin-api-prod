const prisma = require('../config/prisma');

// ==================== DASHBOARD SERVICES ====================

/**
 * Get doctor dashboard summary
 */
const getDashboardSummary = async (userId) => {
  try {
    // 1. Dapatkan doctor profile dari userId
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const doctorId = doctorProfile.id;

    // 2. Hitung totalRequests dari tabel CaseAssignment
    const totalRequests = await prisma.caseAssignment.count({
      where: { doctorId }
    });

    // 3. Ambil data CaseReview untuk menghitung status dan akurasi AI
    const caseReviews = await prisma.caseReview.findMany({
      where: { doctorId },
      include: {
        scan: {
          select: { aiConfidence: true }
        }
      }
    });

    // 4. Hitung pending dan completed dari CaseReview
    const pendingReview = caseReviews.filter(c => c.reviewStatus === 'pending_review').length;
    // Status selain 'pending_review' (seperti 'approved', 'rejected') dianggap selesai
    const completedScans = caseReviews.filter(c => c.reviewStatus !== 'pending_review').length;

    console.log("DEBUG getDashboardSummary - caseReviews:", caseReviews);
    console.log("DEBUG getDashboardSummary - pendingReview:", pendingReview);
    console.log("DEBUG getDashboardSummary - completedScans:", completedScans);

    // 5. Hitung rata-rata akurasi AI
    // Menggunakan opsional chaining (?.) untuk menghindari error jika scan tidak ada
    const totalConfidence = caseReviews.reduce((sum, c) => sum + (c.scan?.aiConfidence || 0), 0);
    const accuracy = caseReviews.length > 0 ? Math.round((totalConfidence / caseReviews.length) * 100) : 0;
    
    // 6. Hitung growth percentage berdasarkan CaseAssignment (Permintaan baru masuk)
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0); // Set ke awal hari di tanggal 1 bulan ini
    
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1); // Set ke tanggal 1 bulan lalu
    
    // Optimasi Query: Menghitung langsung dari database, bukan di memori JS
    const thisMonthCases = await prisma.caseAssignment.count({
      where: {
        doctorId,
        createdAt: { gte: thisMonth }
      }
    });
    
    const lastMonthCases = await prisma.caseAssignment.count({
      where: {
        doctorId,
        createdAt: {
          gte: lastMonth,
          lt: thisMonth
        }
      }
    });
    
    const growthPercentage = lastMonthCases > 0 
      ? Math.round(((thisMonthCases - lastMonthCases) / lastMonthCases) * 100) 
      : (thisMonthCases > 0 ? 100 : 0); // Jika bulan lalu 0 tapi bulan ini ada, anggap 100% growth

    return {
      totalRequests,
      pendingReview,
      completedScans,
      accuracy,
      growthPercentage
    };
  } catch (error) {
    throw new Error(`Failed to get dashboard summary: ${error.message}`);
  }
};
/**
 * Get assigned cases for a doctor
 */
const getAssignedCases = async (userId, filters = {}) => {
  try {
    // Get doctor profile from userId
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const assignments = await prisma.caseAssignment.findMany({
      where: { doctorId: doctorProfile.id },
      include: {
        doctor: true
      }
    });

    const caseIds = assignments.map(a => a.caseId);

    const cases = await prisma.caseReview.findMany({
      where: {
        caseId: { in: caseIds },
        reviewStatus: 'pending_review'
      },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: {
                  select: { name: true, gender: true, birthDate: true }
                }
              }
            }
          }
        }
      },
      orderBy: { receivedAt: 'desc' }
    });

    // Map to expected format
    return cases.map(c => ({
      caseId: c.caseId,
      patientName: c.scan.patient.user.name,
      patientAge: c.scan.patient.user.birthDate 
        ? new Date().getFullYear() - new Date(c.scan.patient.user.birthDate).getFullYear()
        : null,
      patientGender: c.scan.patient.user.gender,
      receivedAt: c.receivedAt.toISOString(),
      status: c.reviewStatus,
      scanImageUrl: c.scan.imageUrl,
      avatarUrl: `/uploads/patients/${c.scan.patient.user.name.toLowerCase().replace(/\s+/g, '-')}.png`
    }));
  } catch (error) {
    throw new Error(`Failed to get assigned cases: ${error.message}`);
  }
};

/**
 * Get case details
 */
const getCaseDetail = async (caseId) => {
  try {
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true, gender: true, birthDate: true } }
              }
            }
          }
        }
      }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    // Get patient age from birthDate
    const patientBirthDate = caseReview.scan.patient.user.birthDate;
    const patientAge = patientBirthDate 
      ? new Date().getFullYear() - new Date(patientBirthDate).getFullYear()
      : null;

    return {
      caseId: caseReview.caseId,
      patient: {
        id: caseReview.scan.patientId,
        name: caseReview.scan.patient.user.name,
        age: patientAge,
        gender: caseReview.scan.patient.user.gender
      },
      clinicalImage: {
        imageUrl: caseReview.scan.imageUrl,
        zoom: caseReview.zoom || '4.0x',
        light: caseReview.light || 'Polarized',
        bodySite: caseReview.scan.bodySite || 'unspecified',
        complaint: caseReview.scan.complaint
      },
      aiPrediction: {
        confidence: caseReview.scan.aiConfidence || 0,
        prediction: caseReview.scan.aiPrediction,
        details: caseReview.scan.aiDetails
      },
      patientNotes: caseReview.scan.notes || 'No notes provided',
      physicianObservation: caseReview.physicianObservation,
      status: caseReview.reviewStatus,
      receivedAt: caseReview.receivedAt.toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to get case detail: ${error.message}`);
  }
};

/**
 * Save doctor observation
 */
const saveObservation = async (caseId, doctorId, observation) => {
  try {
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    // Create observation record
    const obs = await prisma.doctorObservation.create({
      data: {
        caseReviewId: caseReview.id,
        doctorId: doctorProfile.id,
        observation
      }
    });

    return {
      success: true,
      message: 'Observation saved successfully'
    };
  } catch (error) {
    throw new Error(`Failed to save observation: ${error.message}`);
  }
};

/**
 * Approve a case review
 */
const approveCase = async (caseId, doctorId, physicianObservation, finalDiagnosis) => {
  try {
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        },
        doctor: {
          include: {
            user: { select: { name: true } }
          }
        }
      }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const updated = await prisma.caseReview.update({
      where: { caseId },
      data: {
        doctorId: doctorProfile.id,
        physicianObservation,
        finalDiagnosis,
        reviewStatus: 'approved',
        reviewedAt: new Date()
      }
    });

    // ===== NOTIFIKASI KE PATIENT =====
    // Import createPatientNotification dari patient service
    const patientService = require('./patient.service');
    const patientId = caseReview.scan.patient.id;
    const patientName = caseReview.scan.patient.user.name;
    const doctorName = doctorProfile.user?.name || 'A doctor';

    await patientService.createPatientNotification(
      patientId,
      'Case Review Completed',
      `Dr. ${doctorName} has approved and completed the review of your scan (Case ID: ${caseId}). Check your dashboard for the diagnosis.`,
      'scan_complete'
    );

    return {
      success: true,
      message: 'Case approved successfully',
      caseId: updated.caseId
    };
  } catch (error) {
    throw new Error(`Failed to approve case: ${error.message}`);
  }
};

/**
 * Reject a case review
 */
const rejectCase = async (caseId, doctorId, reason, physicianObservation, finalDiagnosis) => {
  try {
    const caseReview = await prisma.caseReview.findUnique({
      where: { caseId },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        },
        doctor: {
          include: {
            user: { select: { name: true } }
          }
        }
      }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const updated = await prisma.caseReview.update({
      where: { caseId },
      data: {
        doctorId: doctorProfile.id,
        rejectionReason: reason,
        physicianObservation,
        finalDiagnosis,
        reviewStatus: 'rejected',
        reviewedAt: new Date()
      }
    });

    // ===== NOTIFIKASI KE PATIENT =====
    const patientService = require('./patient.service');
    const patientId = caseReview.scan.patient.id;
    const patientName = caseReview.scan.patient.user.name;
    const doctorName = doctorProfile.user?.name || 'A doctor';

    await patientService.createPatientNotification(
      patientId,
      'Case Review Rejected',
      `Dr. ${doctorName} has rejected the review of your scan (Case ID: ${caseId}). Reason: ${reason}. You may resubmit if needed.`,
      'verification_alert'
    );

    return {
      success: true,
      message: 'Case rejected successfully',
      caseId: updated.caseId
    };
  } catch (error) {
    throw new Error(`Failed to reject case: ${error.message}`);
  }
};

// ==================== CASE HISTORY SERVICES ====================

const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseOptionalDate = (value, fieldName) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(`${fieldName} must be a valid date`, 400);
  }

  return date;
};

const normalizeReviewStatus = (status) => {
  if (!status) {
    return undefined;
  }

  const statusAliases = {
    verified: 'approved',
    completed: 'approved'
  };
  const normalized = statusAliases[status] || status;
  const validStatuses = ['pending_review', 'approved', 'rejected', 'under_review'];

  if (!validStatuses.includes(normalized)) {
    throw createHttpError(
      `status must be one of: ${validStatuses.join(', ')}`,
      400
    );
  }

  return normalized;
};

/**
 * Get case history with filters and pagination
 */
const getCaseHistory = async (userId, filters = {}) => {
  try {
    const { search, diagnosis, status, startDate, endDate, page = 1, limit = 10 } = filters;
    const pageNumber = parsePositiveInteger(page, 1);
    const limitNumber = Math.min(parsePositiveInteger(limit, 10), 100);
    const skip = (pageNumber - 1) * limitNumber;
    const reviewStatus = normalizeReviewStatus(status);
    const parsedStartDate = parseOptionalDate(startDate, 'startDate');
    const parsedEndDate = parseOptionalDate(endDate, 'endDate');

    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      throw createHttpError('endDate must be after startDate', 400);
    }

    // Get doctor profile from userId
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw createHttpError('Doctor profile not found', 404);
    }

    const whereClause = {
      doctorId: doctorProfile.id,
      reviewStatus: { not: 'pending_review' }
    };

    if (reviewStatus) {
      whereClause.reviewStatus = reviewStatus;
    }

    if (diagnosis) {
      whereClause.finalDiagnosis = { contains: diagnosis, mode: 'insensitive' };
    }

    if (parsedStartDate || parsedEndDate) {
      whereClause.reviewedAt = {};
      if (parsedStartDate) {
        whereClause.reviewedAt.gte = parsedStartDate;
      }
      if (parsedEndDate) {
        whereClause.reviewedAt.lte = parsedEndDate;
      }
    }

    if (search) {
      whereClause.OR = [
        {
          scan: {
            is: {
              patient: {
                is: {
                  user: {
                    is: {
                      name: { contains: search, mode: 'insensitive' }
                    }
                  }
                }
              }
            }
          }
        },
        { caseId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const total = await prisma.caseReview.count({ where: whereClause });

    const cases = await prisma.caseReview.findMany({
      where: whereClause,
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        }
      },
      skip,
      take: limitNumber,
      orderBy: { reviewedAt: 'desc' }
    });

    return {
      data: cases.map(c => ({
        caseId: c.caseId,
        date: c.reviewedAt ? c.reviewedAt.toISOString().split('T')[0] : null,
        patient: {
          id: c.scan?.patientId || null,
          name: c.scan?.patient?.user?.name || null
        },
        clinicalImageUrl: c.scan?.imageUrl || null,
        aiPrediction: c.scan?.aiPrediction || null,
        finalDiagnosis: c.finalDiagnosis,
        verificationStatus: c.reviewStatus
      })),
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total
      }
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    console.error('[doctor.service.getCaseHistory] Prisma/query failure', {
      userId,
      filters,
      message: error.message,
      stack: error.stack
    });

    throw createHttpError(`Failed to get case history: ${error.message}`, 500);
  }
};

/**
 * Get patient evolution scans
 */
const getPatientEvolution = async (patientId) => {
  try {
    const cases = await prisma.caseReview.findMany({
      where: { scan: { patientId } },
      include: {
        scan: {
          include: {
            patient: {
              include: {
                user: { select: { name: true, gender: true, birthDate: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (cases.length === 0) {
      throw new Error('Patient not found');
    }

    const firstCase = cases[cases.length - 1]; // Oldest case
    const patient = cases[0].scan.patient;
    const patientBirthDate = patient.user.birthDate;
    const patientAge = patientBirthDate 
      ? new Date().getFullYear() - new Date(patientBirthDate).getFullYear()
      : null;

    // Calculate growth percentage (simplified)
    let growthPercentage = 0;
    if (cases.length > 1) {
      const firstConfidence = cases[cases.length - 1].scan.aiConfidence || 0;
      const lastConfidence = cases[0].scan.aiConfidence || 0;
      if (firstConfidence > 0) {
        growthPercentage = Math.round(((lastConfidence - firstConfidence) / firstConfidence) * 100);
      }
    }

    return {
      patient: {
        id: patientId,
        name: patient.user.name,
        age: patientAge,
        gender: patient.user.gender
      },
      evolution: cases.map((c, index) => ({
        caseId: c.caseId,
        date: c.createdAt.toISOString().split('T')[0],
        imageUrl: c.scan.imageUrl,
        prediction: c.scan.aiPrediction,
        confidence: c.scan.aiConfidence,
        diagnosis: c.finalDiagnosis,
        note: c.scan.complaint || 'Patient scan',
        growthPercentage: index === 0 ? growthPercentage : undefined
      }))
    };
  } catch (error) {
    throw new Error(`Failed to get patient evolution: ${error.message}`);
  }
};

// ==================== PROFILE SERVICES ====================

/**
 * Get doctor profile
 */
const getDoctorProfile = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'doctor') {
      throw new Error('User is not a doctor');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    return {
      doctorId: doctorProfile.id,
      fullName: user.name,
      email: user.email,
      gender: user.gender,
      role: user.role,
      phoneNumber: user.phone,
      birthDate: user.birthDate ? user.birthDate.toISOString().split('T')[0] : null,
      joinedAt: doctorProfile.joinedAt.toISOString().split('T')[0],
      profileImageUrl: user.avatarUrl || '',
      specialization: doctorProfile.specialization || 'Dermatology',
      practitionerStatus: {
        status: doctorProfile.verificationStatus,
        label: doctorProfile.verificationStatus === 'verified' ? 'Verified Doctor' : 'Pending Verification',
        description: `Your medical license and clinical specialization have been ${doctorProfile.verificationStatus} for Melanoma AI analysis.`
      }
    };
  } catch (error) {
    throw new Error(`Failed to get doctor profile: ${error.message}`);
  }
};

/**
 * Update doctor profile
 */
const updateDoctorProfile = async (userId, updates) => {
  try {
    const { fullName, phoneNumber, gender, birthDate } = updates;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: fullName,
        phone: phoneNumber,
        gender,
        birthDate: birthDate ? new Date(birthDate) : undefined
      }
    });

    return {
      success: true,
      message: 'Profile updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

/**
 * Update doctor profile photo
 */
const updateProfilePhoto = async (userId, photoPath) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: photoPath
      }
    });

    return {
      success: true,
      message: 'Profile photo updated successfully',
      imageUrl: photoPath
    };
  } catch (error) {
    throw new Error(`Failed to update profile photo: ${error.message}`);
  }
};

// ==================== SETTINGS SERVICES ====================

/**
 * Get doctor settings
 */
const getDoctorSettings = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.role !== 'doctor') {
      throw new Error('User is not a doctor');
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    const settings = await prisma.doctorSettings.findUnique({
      where: { doctorId: doctorProfile.id }
    });

    if (!settings) {
      throw new Error('Settings not found');
    }

    return {
      account: {
        email: user.email,
        twoFactorEnabled: settings.twoFactorEnabled
      },
      notifications: {
        emailNotifications: settings.emailNotifications,
        verificationAlerts: settings.verificationAlerts
      },
      privacy: {
        dataVisibility: settings.dataVisibility
      },
      preferences: {
        language: settings.language
      }
    };
  } catch (error) {
    throw new Error(`Failed to get settings: ${error.message}`);
  }
};

/**
 * Update account settings (email/password)
 */
const updateAccountSettings = async (userId, updates) => {
  try {
    const { email, currentPassword, newPassword } = updates;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (newPassword) {
      const bcrypt = require('bcryptjs');
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });
    }

    if (email) {
      await prisma.user.update({
        where: { id: userId },
        data: { email }
      });
    }

    return {
      success: true,
      message: 'Account settings updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update account settings: ${error.message}`);
  }
};

/**
 * Update 2FA settings
 */
const update2FASettings = async (userId, enabled) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    await prisma.doctorSettings.update({
      where: { doctorId: doctorProfile.id },
      data: { twoFactorEnabled: enabled }
    });

    return {
      success: true,
      message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`
    };
  } catch (error) {
    throw new Error(`Failed to update 2FA settings: ${error.message}`);
  }
};

/**
 * Update notification settings
 */
const updateNotificationSettings = async (userId, settings) => {
  try {
    const { emailNotifications, verificationAlerts } = settings;

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    await prisma.doctorSettings.update({
      where: { doctorId: doctorProfile.id },
      data: {
        emailNotifications,
        verificationAlerts
      }
    });

    return {
      success: true,
      message: 'Notification settings updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update notification settings: ${error.message}`);
  }
};

/**
 * Update privacy settings
 */
const updatePrivacySettings = async (userId, settings) => {
  try {
    const { dataVisibility } = settings;

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    await prisma.doctorSettings.update({
      where: { doctorId: doctorProfile.id },
      data: { dataVisibility }
    });

    return {
      success: true,
      message: 'Privacy settings updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update privacy settings: ${error.message}`);
  }
};

/**
 * Update preferences
 */
const updatePreferences = async (userId, settings) => {
  try {
    const { language } = settings;

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    await prisma.doctorSettings.update({
      where: { doctorId: doctorProfile.id },
      data: { language }
    });

    return {
      success: true,
      message: 'Preferences updated successfully'
    };
  } catch (error) {
    throw new Error(`Failed to update preferences: ${error.message}`);
  }
};

// ==================== NOTIFICATION SERVICES ====================

/**
 * Get doctor notifications
 */
const getDoctorNotifications = async (userId) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const notifications = await prisma.notification.findMany({
      where: { doctorId: doctorProfile.id },
      orderBy: { createdAt: 'desc' }
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return {
      unreadCount,
      data: notifications.map(n => ({
        notificationId: n.notificationId,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString()
      }))
    };
  } catch (error) {
    throw new Error(`Failed to get notifications: ${error.message}`);
  }
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (notificationId) => {
  try {
    await prisma.notification.update({
      where: { notificationId },
      data: { isRead: true }
    });

    return {
      success: true,
      message: 'Notification marked as read'
    };
  } catch (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = async (userId) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    await prisma.notification.updateMany({
      where: { doctorId: doctorProfile.id },
      data: { isRead: true }
    });

    return {
      success: true,
      message: 'All notifications marked as read'
    };
  } catch (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
};

module.exports = {
  // Dashboard
  getDashboardSummary,
  getAssignedCases,
  getCaseDetail,
  saveObservation,
  approveCase,
  rejectCase,

  // Case History
  getCaseHistory,
  getPatientEvolution,

  // Profile
  getDoctorProfile,
  updateDoctorProfile,
  updateProfilePhoto,

  // Settings
  getDoctorSettings,
  updateAccountSettings,
  update2FASettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updatePreferences,

  // Notifications
  getDoctorNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
