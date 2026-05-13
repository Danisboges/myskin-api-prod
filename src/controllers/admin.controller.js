const adminService = require("../services/admin.service");
const {
  validateCreateUser,
  validateUpdateUser,
  validateUserStatus,
  validateUserRole,
  validateResetPassword,
  validateDoctorApproval,
  validateDoctorRejection,
  validateAdminSettings,
  validatePaginationParams,
} = require("../validators/admin.validator");

// ==================== DASHBOARD CONTROLLERS ====================

const getDashboardSummary = async (req, res) => {
  try {
    const summary = await adminService.getDashboardSummary();
    res.status(200).json({ status: "success", data: summary });
  } catch (err) {
    console.error("Error getting dashboard summary:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getUserGrowth = async (req, res) => {
  try {
    const { range = "30d" } = req.query;
    const growth = await adminService.getUserGrowthData(range);
    res.status(200).json({ status: "success", data: growth });
  } catch (err) {
    console.error("Error getting user growth:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getRoleDistribution = async (req, res) => {
  try {
    const distribution = await adminService.getRoleDistribution();
    res.status(200).json({ status: "success", data: distribution });
  } catch (err) {
    console.error("Error getting role distribution:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getSystemLogs = async (req, res) => {
  try {
    const { type, severity, page, limit } = req.query;

    const paginationErrors = validatePaginationParams(page, limit);
    if (paginationErrors) {
      return res.status(400).json({ status: "error", errors: paginationErrors });
    }

    const logs = await adminService.getSystemLogs({
      type,
      severity,
      page: page || 1,
      limit: limit || 10,
    });

    res.status(200).json({ status: "success", data: logs });
  } catch (err) {
    console.error("Error getting system logs:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getReportStatistics = async (startDate, endDate) => {
  // Ubah string tanggal menjadi Date object
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set waktu end ke akhir hari (23:59:59) agar data di hari terakhir ikut terhitung
  end.setUTCHours(23, 59, 59, 999);

  // 1. Hitung pasien baru yang terdaftar di rentang waktu tersebut
  // Asumsi role pasien adalah 'PATIENT' sesuai schema kamu
  const totalNewPatients = await prisma.user.count({
    where: {
      role: 'PATIENT',
      createdAt: { gte: start, lte: end }
    }
  });

  // 2. Hitung total gambar yang dideteksi oleh AI
  const totalScans = await prisma.detection.count({
    where: { createdAt: { gte: start, lte: end } }
  });

  // 3. Hitung rata-rata persentase confidence dari AI (seberapa yakin AI-nya)
  const avgConfidenceResult = await prisma.detection.aggregate({
    _avg: { confidence: true },
    where: { createdAt: { gte: start, lte: end } }
  });
  // Jika tidak ada data, jadikan 0. Asumsi confidence disimpan sebagai float (0.0 - 1.0 atau 0 - 100)
  // Misal data kamu float 0.94, kita kalikan 100 jadi 94%. Jika di db sudah 94, hilangkan '* 100'.
  const avgConfidence = avgConfidenceResult._avg.confidence 
    ? (avgConfidenceResult._avg.confidence * 100).toFixed(2) 
    : 0;

  // 4. Hitung hasil yang berbahaya (Melanoma/Malignant)
  // CATATAN: Ubah kata 'Melanoma' sesuai dengan output string dari model AI-mu yang disimpan ke DB
  const highRiskCases = await prisma.detection.count({
    where: {
      result: { contains: 'Melanoma', mode: 'insensitive' }, 
      createdAt: { gte: start, lte: end }
    }
  });

  // 5. Konsultasi yang berhasil diselesaikan
  const completedConsultations = await prisma.consultation.count({
    where: {
      status: 'COMPLETED',
      updatedAt: { gte: start, lte: end }
    }
  });

  return {
    totalNewPatients,
    totalScans,
    highRiskCases,
    lowRiskCases: totalScans - highRiskCases, // Hitung sisa scan sebagai jinak (low risk)
    completedConsultations,
    avgConfidence
  };
};

const generateReport = async (req, res) => {
  try {
    const { startDate, endDate, reportType, format } = req.body;

    if (!startDate || !endDate || !reportType) {
      return res.status(400).json({
        status: "error",
        message: "startDate, endDate, and reportType are required",
      });
    }

    const reportFormat = format || "pdf";
    const report = await adminService.generateReport(startDate, endDate, reportType, reportFormat);

    // PERBAIKAN DI SINI: Menggunakan req.baseUrl agar URL otomatis menyesuaikan 
    // dengan yang kamu tulis di app.use(...) pada file server.js
    const hostUrl = `${req.protocol}://${req.get('host')}`; 
    const exportUrl = `${hostUrl}${req.baseUrl}/dashboard/report/export?startDate=${startDate}&endDate=${endDate}&reportType=${reportType}&format=${reportFormat}`;
    
    report.exportEndpoint = exportUrl;

    if (req.user) {
      await adminService.createAuditLog(
        req.user.id,
        req.user.name || "Unknown Admin",
        "GENERATE_REPORT",
        `Generated report of type ${reportType} from ${startDate} to ${endDate}`,
        { ipAddress: req.ip, userAgent: req.get("User-Agent") }
      );
    }

    res.status(201).json({ status: "success", data: report });
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const exportReport = async (req, res) => {
  try {
    const { startDate, endDate, reportType, format } = req.query;

    // 1. Jalankan service (Service tetap menyimpan file ke folder uploads)
    const reportData = await adminService.exportReport(startDate, endDate, reportType, format);

    // 2. Buat URL dinamis
    // Misal: http://localhost:3000/api/v1/uploads/MySkin_Report_12345.pdf
    const protocol = req.protocol;
    const host = req.get('host');
    const downloadUrl = `${protocol}://${host}/api/v1/uploads/${reportData.fileName}`;

    // 3. Kirimkan JSON, bukan file-nya
    res.status(200).json({
      message: "Report berhasil dibuat dan disimpan di server.",
      data: {
        fileName: reportData.fileName,
        format: format || 'txt',
        downloadUrl: downloadUrl 
      }
    });
    
  } catch (err) {
    console.error("Gagal generate report URL:", err.message);
    res.status(500).json({ error: "Gagal membuat URL download." });
  }
};

// ==================== USER MANAGEMENT CONTROLLERS ====================

const getAllUsers = async (req, res) => {
  try {
    const { search, role, status, page, limit, sortBy, sortOrder } = req.query;

    const paginationErrors = validatePaginationParams(page, limit);
    if (paginationErrors) {
      return res.status(400).json({ status: "error", errors: paginationErrors });
    }

    const users = await adminService.getAllUsers({
      search,
      role,
      status,
      page: page || 1,
      limit: limit || 8,
      sortBy: sortBy || "createdAt",
      sortOrder: sortOrder || "desc",
    });

    res.status(200).json({ status: "success", data: users });
  } catch (err) {
    console.error("Error getting users:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await adminService.getUserById(userId);
    res.status(200).json({ status: "success", data: user });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error getting user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const validationErrors = validateCreateUser(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.createUser(req.body);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "CREATE_USER",
      `Admin created new ${req.body.role} account ${req.body.fullName}`,
      {
        targetResourceType: "user",
        targetResourceId: result.data.userId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(201).json(result);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ status: "error", message: err.message });
    }
    console.error("Error creating user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const validationErrors = validateUpdateUser(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.updateUser(userId, req.body);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "UPDATE_USER",
      `Admin updated user ${userId}`,
      {
        targetResourceType: "user",
        targetResourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    if (err.status === 409) {
      return res.status(409).json({ status: "error", message: err.message });
    }
    console.error("Error updating user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const validationErrors = validateUserStatus(status);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.updateUserStatus(userId, status);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "CHANGE_USER_STATUS",
      `Admin changed user ${userId} status to ${status}`,
      {
        targetResourceType: "user",
        targetResourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error updating user status:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validationErrors = validateUserRole(role);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.changeUserRole(userId, role);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "CHANGE_USER_ROLE",
      `Admin changed user ${userId} role to ${role}`,
      {
        targetResourceType: "user",
        targetResourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error changing user role:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await adminService.deleteUser(userId);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "DELETE_USER",
      `Admin deleted user ${userId}`,
      {
        targetResourceType: "user",
        targetResourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error deleting user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const validationErrors = validateResetPassword(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.resetUserPassword(userId, newPassword);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "RESET_PASSWORD",
      `Admin reset password for user ${userId}`,
      {
        targetResourceType: "user",
        targetResourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error resetting password:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ==================== DOCTOR MANAGEMENT CONTROLLERS ====================

const getDoctorsSummary = async (req, res) => {
  try {
    const summary = await adminService.getDoctorsSummary();
    res.status(200).json({ status: "success", data: summary });
  } catch (err) {
    console.error("Error getting doctors summary:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getAllDoctors = async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;

    const paginationErrors = validatePaginationParams(page, limit);
    if (paginationErrors) {
      return res.status(400).json({ status: "error", errors: paginationErrors });
    }

    const doctors = await adminService.getAllDoctors({
      search,
      status: status || "verified",
      page: page || 1,
      limit: limit || 8,
    });

    res.status(200).json({ status: "success", data: doctors });
  } catch (err) {
    console.error("Error getting doctors:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await adminService.getDoctorById(doctorId);
    res.status(200).json({ status: "success", data: doctor });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error getting doctor:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getDoctorVerificationRequests = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const requests = await adminService.getDoctorVerificationRequests(doctorId);
    res.status(200).json({ status: "success", data: requests });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error getting verification requests:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const approveDoctorRequest = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { note } = req.body;

    const validationErrors = validateDoctorApproval(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.approveDoctorRequest(doctorId, note);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "APPROVE_DOCTOR",
      `Admin approved doctor ${doctorId}. Note: ${note}`,
      {
        targetResourceType: "doctor",
        targetResourceId: doctorId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error approving doctor:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const rejectDoctorRequest = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { reason } = req.body;

    const validationErrors = validateDoctorRejection(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.rejectDoctorRequest(doctorId, reason);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "REJECT_DOCTOR",
      `Admin rejected doctor ${doctorId}. Reason: ${reason}`,
      {
        targetResourceType: "doctor",
        targetResourceId: doctorId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error rejecting doctor:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ==================== PROFILE CONTROLLERS ====================

const getAdminProfile = async (req, res) => {
  try {
    const profile = await adminService.getAdminProfile(req.user.id);
    res.status(200).json({ status: "success", data: profile });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error getting admin profile:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    const result = await adminService.updateAdminProfile(req.user.id, req.body);
    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error updating admin profile:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateAdminPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "No file uploaded" });
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    const result = await adminService.updateAdminPhoto(req.user.id, photoUrl);

    res.status(200).json({ status: "success", data: { photoUrl, ...result } });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error updating admin photo:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const getVerificationStatus = async (req, res) => {
  try {
    const status = await adminService.getVerificationStatus();
    res.status(200).json({ status: "success", data: status });
  } catch (err) {
    console.error("Error getting verification status:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ==================== SETTINGS CONTROLLERS ====================

const getAdminSettings = async (req, res) => {
  try {
    const settings = await adminService.getAdminSettings(req.user.id);
    res.status(200).json({ status: "success", data: settings });
  } catch (err) {
    console.error("Error getting settings:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateAdminSettingsAccount = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email && !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Either email or password must be provided",
      });
    }

    const result = await adminService.updateAdminSettingsAccount(
      req.user.id,
      email,
      currentPassword,
      newPassword
    );

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "UPDATE_SYSTEM_SETTINGS",
      "Admin updated account settings",
      { ipAddress: req.ip, userAgent: req.get("User-Agent") }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404 || err.status === 400 || err.status === 409) {
      return res.status(err.status).json({ status: "error", message: err.message });
    }
    console.error("Error updating account settings:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateAdminSettings2FA = async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        status: "error",
        message: "enabled must be a boolean",
      });
    }

    const result = await adminService.updateAdminSettings2FA(req.user.id, enabled);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "UPDATE_SYSTEM_SETTINGS",
      `Admin ${enabled ? "enabled" : "disabled"} 2FA`,
      { ipAddress: req.ip, userAgent: req.get("User-Agent") }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    console.error("Error updating 2FA settings:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateAdminSettingsNotifications = async (req, res) => {
  try {
    const { emailNotifications, verificationAlerts } = req.body;

    const validationErrors = validateAdminSettings(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.updateAdminSettingsNotifications(
      req.user.id,
      emailNotifications,
      verificationAlerts
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    console.error("Error updating notification settings:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateAdminSettingsPrivacy = async (req, res) => {
  try {
    const { dataVisibility } = req.body;

    const validationErrors = validateAdminSettings(req.body);
    if (validationErrors) {
      return res.status(400).json({ status: "error", errors: validationErrors });
    }

    const result = await adminService.updateAdminSettingsPrivacy(req.user.id, dataVisibility);

    // Log audit
    await adminService.createAuditLog(
      req.user.id,
      req.user.name,
      "UPDATE_SYSTEM_SETTINGS",
      `Admin updated privacy settings to ${dataVisibility}`,
      { ipAddress: req.ip, userAgent: req.get("User-Agent") }
    );

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    console.error("Error updating privacy settings:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const updateAdminSettingsPreferences = async (req, res) => {
  try {
    const { language } = req.body;

    if (!language) {
      return res.status(400).json({
        status: "error",
        message: "language is required",
      });
    }

    const result = await adminService.updateAdminSettingsPreferences(req.user.id, language);

    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    console.error("Error updating preferences:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ==================== NOTIFICATION CONTROLLERS ====================

const getAdminNotifications = async (req, res) => {
  try {
    const notifications = await adminService.getAdminNotifications(req.user.id);
    res.status(200).json({ status: "success", data: notifications });
  } catch (err) {
    console.error("Error getting notifications:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const result = await adminService.markNotificationAsRead(notificationId);
    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ status: "error", message: err.message });
    }
    console.error("Error marking notification as read:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await adminService.markAllNotificationsAsRead(req.user.id);
    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ==================== AUDIT LOG CONTROLLERS ====================

const getAuditLogs = async (req, res) => {
  try {
    const { adminId, action, startDate, endDate, page, limit } = req.query;

    const paginationErrors = validatePaginationParams(page, limit);
    if (paginationErrors) {
      return res.status(400).json({ status: "error", errors: paginationErrors });
    }

    const logs = await adminService.getAuditLogs({
      adminId,
      action,
      startDate,
      endDate,
      page: page || 1,
      limit: limit || 10,
    });

    res.status(200).json({ status: "success", data: logs });
  } catch (err) {
    console.error("Error getting audit logs:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = {
  // Dashboard
  getDashboardSummary,
  getUserGrowth,
  getRoleDistribution,
  getSystemLogs,
  generateReport,
  exportReport,

  // User Management
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  changeUserRole,
  deleteUser,
  resetUserPassword,

  // Doctor Management
  getDoctorsSummary,
  getAllDoctors,
  getDoctorById,
  getDoctorVerificationRequests,
  approveDoctorRequest,
  rejectDoctorRequest,

  // Profile
  getAdminProfile,
  updateAdminProfile,
  updateAdminPhoto,
  getVerificationStatus,

  // Settings
  getAdminSettings,
  updateAdminSettingsAccount,
  updateAdminSettings2FA,
  updateAdminSettingsNotifications,
  updateAdminSettingsPrivacy,
  updateAdminSettingsPreferences,

  // Notifications
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,

  // Audit Logs
  getAuditLogs,
};
