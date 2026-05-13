const prisma = require('../config/prisma');

// ==================== DASHBOARD SERVICES ====================

/**
 * Get doctor dashboard summary
 */
const getDashboardSummary = async (doctorId) => {
  try {
    const caseReviews = await prisma.caseReview.findMany({
      where: { doctorId }
    });

    const totalRequests = caseReviews.length;
    const pendingReview = caseReviews.filter(c => c.reviewStatus === 'pending_review').length;
    const completedScans = caseReviews.filter(c => c.reviewStatus !== 'pending_review').length;
    
    // Calculate average accuracy from AI predictions
    const totalConfidence = caseReviews.reduce((sum, c) => sum + (c.aiConfidencePercentage || 0), 0);
    const accuracy = caseReviews.length > 0 ? Math.round(totalConfidence / caseReviews.length) : 0;
    
    // Calculate growth percentage (simplified: last month vs this month)
    const thisMonth = new Date();
    thisMonth.setDate(1);
    
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const thisMonthCases = caseReviews.filter(c => new Date(c.createdAt) >= thisMonth).length;
    const lastMonthCases = caseReviews.filter(c => {
      const d = new Date(c.createdAt);
      return d >= lastMonth && d < thisMonth;
    }).length;
    
    const growthPercentage = lastMonthCases > 0 ? Math.round(((thisMonthCases - lastMonthCases) / lastMonthCases) * 100) : 0;

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
const getAssignedCases = async (doctorId, filters = {}) => {
  try {
    const assignments = await prisma.caseAssignment.findMany({
      where: { doctorId },
      include: {
        doctor: true
      }
    });

    const caseIds = assignments.map(a => a.caseId);

    const cases = await prisma.caseReview.findMany({
      where: {
        id: { in: caseIds },
        reviewStatus: 'pending_review'
      },
      select: {
        id: true,
        caseId: true,
        patientName: true,
        patientAge: true,
        patientGender: true,
        receivedAt: true,
        reviewStatus: true
      },
      orderBy: { receivedAt: 'desc' }
    });

    // Map to expected format
    return cases.map(c => ({
      caseId: c.caseId,
      patientName: c.patientName,
      patientAge: c.patientAge,
      patientGender: c.patientGender,
      receivedAt: c.receivedAt.toISOString(),
      status: c.reviewStatus,
      avatarUrl: `/uploads/patients/${c.patientName.toLowerCase().replace(/\s+/g, '-')}.png`
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
      where: { caseId }
    });

    if (!caseReview) {
      throw new Error('Case not found');
    }

    // Parse alternative predictions
    let predictions = [];
    if (caseReview.alternativePredictions) {
      try {
        predictions = JSON.parse(caseReview.alternativePredictions);
      } catch (e) {
        predictions = [];
      }
    }

    // Add main prediction
    predictions.unshift({
      label: caseReview.aiPredictionLabel,
      percentage: caseReview.aiConfidencePercentage
    });

    return {
      caseId: caseReview.caseId,
      patient: {
        id: caseReview.patientId,
        name: caseReview.patientName,
        age: caseReview.patientAge,
        gender: caseReview.patientGender
      },
      clinicalImage: {
        imageUrl: caseReview.clinicalImageUrl,
        zoom: caseReview.zoom,
        light: caseReview.light,
        bodySite: caseReview.bodySite
      },
      aiPrediction: {
        confidence: caseReview.aiConfidence,
        predictions: predictions
      },
      patientNotes: caseReview.patientNotes,
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

/**
 * Get case history with filters and pagination
 */
const getCaseHistory = async (doctorId, filters = {}) => {
  try {
    const { search, diagnosis, status, startDate, endDate, page = 1, limit = 10 } = filters;

    const whereClause = {
      doctorId: (await prisma.doctorProfile.findUnique({
        where: { userId: doctorId }
      }))?.id,
      reviewStatus: { not: 'pending_review' }
    };

    if (status) {
      whereClause.reviewStatus = status;
    }

    if (diagnosis) {
      whereClause.finalDiagnosis = { contains: diagnosis, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      whereClause.reviewedAt = {};
      if (startDate) {
        whereClause.reviewedAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.reviewedAt.lte = new Date(endDate);
      }
    }

    if (search) {
      whereClause.OR = [
        { patientName: { contains: search, mode: 'insensitive' } },
        { caseId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const total = await prisma.caseReview.count({ where: whereClause });

    const cases = await prisma.caseReview.findMany({
      where: whereClause,
      select: {
        caseId: true,
        reviewedAt: true,
        patientId: true,
        patientName: true,
        clinicalImageUrl: true,
        finalDiagnosis: true,
        reviewStatus: true
      },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { reviewedAt: 'desc' }
    });

    return {
      data: cases.map(c => ({
        caseId: c.caseId,
        date: c.reviewedAt ? c.reviewedAt.toISOString().split('T')[0] : null,
        patient: {
          id: c.patientId,
          name: c.patientName
        },
        clinicalImageUrl: c.clinicalImageUrl,
        aiDiagnosis: c.finalDiagnosis,
        verificationStatus: c.reviewStatus
      })),
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    };
  } catch (error) {
    throw new Error(`Failed to get case history: ${error.message}`);
  }
};

/**
 * Get patient evolution scans
 */
const getPatientEvolution = async (patientId) => {
  try {
    const cases = await prisma.caseReview.findMany({
      where: { patientId },
      select: {
        id: true,
        caseId: true,
        clinicalImageUrl: true,
        patientNotes: true,
        physicalObservation: true,
        createdAt: true,
        aiConfidencePercentage: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (cases.length === 0) {
      throw new Error('Patient not found');
    }

    const firstCase = await prisma.caseReview.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'asc' }
    });

    const patientInfo = await prisma.caseReview.findFirst({
      where: { patientId },
      select: {
        patientId: true,
        patientName: true,
        patientAge: true,
        patientGender: true
      }
    });

    // Calculate growth percentage (simplified)
    let growthPercentage = 0;
    if (cases.length > 1) {
      const firstConfidence = cases[cases.length - 1].aiConfidencePercentage;
      const lastConfidence = cases[0].aiConfidencePercentage;
      growthPercentage = Math.round(((lastConfidence - firstConfidence) / firstConfidence) * 100);
    }

    return {
      patient: {
        id: patientInfo?.patientId,
        name: patientInfo?.patientName,
        age: patientInfo?.patientAge,
        gender: patientInfo?.patientGender
      },
      evolution: cases.map((c, index) => ({
        scanId: `SCAN-${String(cases.length - index).padStart(3, '0')}`,
        date: c.createdAt.toISOString().split('T')[0],
        imageUrl: c.clinicalImageUrl,
        note: c.patientNotes || 'Patient scan',
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
      doctorId: doctorProfile.doctorId,
      fullName: user.name,
      email: user.email,
      gender: user.gender,
      role: user.role,
      phoneNumber: user.phone,
      birthDate: user.birthDate ? user.birthDate.toISOString().split('T')[0] : null,
      joinedAt: doctorProfile.joinedAt.toISOString().split('T')[0],
      profileImageUrl: doctorProfile.profileImageUrl,
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
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId }
    });

    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    await prisma.doctorProfile.update({
      where: { userId },
      data: {
        profileImageUrl: photoPath
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
