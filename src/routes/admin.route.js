const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { verifyToken, isAdmin } = require("../middlewares/auth.middleware");
const { uploadSingleFile } = require("../middlewares/upload.middleware");
const uploadMedicalLicense = require("../middlewares/medical-license.middleware");

// ==================== DASHBOARD ROUTES ====================

// GET /api/v1/admin/dashboard/report/export
router.get("/dashboard/report/export", verifyToken, isAdmin, adminController.exportReport);
// POST /api/v1/admin/dashboard/report/generate
router.post("/dashboard/report/generate", verifyToken, isAdmin, adminController.generateReport);

// GET /api/v1/admin/dashboard/summary
router.get("/dashboard/summary", verifyToken, isAdmin, adminController.getDashboardSummary);

// GET /api/v1/admin/dashboard/user-growth
router.get("/dashboard/user-growth", verifyToken, isAdmin, adminController.getUserGrowth);

// GET /api/v1/admin/dashboard/role-distribution
router.get("/dashboard/role-distribution", verifyToken, isAdmin, adminController.getRoleDistribution);

// GET /api/v1/admin/system/logs
router.get("/system/logs", verifyToken, isAdmin, adminController.getSystemLogs);

// POST /api/v1/admin/system/logs/cleanup
router.post("/system/logs/cleanup", verifyToken, isAdmin, adminController.cleanupSystemLogs);



// ==================== USER MANAGEMENT ROUTES ====================

// GET /api/v1/admin/users
router.get("/users", verifyToken, isAdmin, adminController.getAllUsers);

// GET /api/v1/admin/users/:userId
router.get("/users/:userId", verifyToken, isAdmin, adminController.getUserById);

// POST /api/v1/admin/users
router.post("/users", verifyToken, isAdmin, uploadMedicalLicense, adminController.createUser);

// PATCH /api/v1/admin/users/:userId
router.patch("/users/:userId", verifyToken, isAdmin, adminController.updateUser);

// PATCH /api/v1/admin/users/:userId/status
router.patch("/users/:userId/status", verifyToken, isAdmin, adminController.updateUserStatus);

// PATCH /api/v1/admin/users/:userId/role
router.patch("/users/:userId/role", verifyToken, isAdmin, adminController.changeUserRole);

// DELETE /api/v1/admin/users/:userId
router.delete("/users/:userId", verifyToken, isAdmin, adminController.deleteUser);

// PATCH /api/v1/admin/users/:userId/reset-password
router.patch("/users/:userId/reset-password", verifyToken, isAdmin, adminController.resetUserPassword);

// ==================== DOCTOR MANAGEMENT ROUTES ====================

// GET /api/v1/admin/doctors/summary
router.get("/doctors/summary", verifyToken, isAdmin, adminController.getDoctorsSummary);

// GET /api/v1/admin/doctors
router.get("/doctors", verifyToken, isAdmin, adminController.getAllDoctors);

// GET /api/v1/admin/doctors/:doctorId
router.get("/doctors/:doctorId", verifyToken, isAdmin, adminController.getDoctorById);

// GET /api/v1/admin/doctors/:doctorId/verification-requests
router.get("/doctors/:doctorId/verification-requests", verifyToken, isAdmin, adminController.getDoctorVerificationRequests);

// PATCH /api/v1/admin/doctors/:doctorId/approve
router.patch("/doctors/:doctorId/approve", verifyToken, isAdmin, adminController.approveDoctorRequest);

// PATCH /api/v1/admin/doctors/:doctorId/reject
router.patch("/doctors/:doctorId/reject", verifyToken, isAdmin, adminController.rejectDoctorRequest);

// PATCH /api/v1/admin/doctors/:doctorId/license
router.patch("/doctors/:doctorId/license", verifyToken, isAdmin, uploadMedicalLicense, adminController.updateDoctorLicense);

// ==================== PROFILE ROUTES ====================

// GET /api/v1/admin/profile
router.get("/profile", verifyToken, isAdmin, adminController.getAdminProfile);

// PATCH /api/v1/admin/profile
router.patch("/profile", verifyToken, isAdmin, adminController.updateAdminProfile);

// PATCH /api/v1/admin/profile/photo
router.patch("/profile/photo", verifyToken, isAdmin, uploadSingleFile("photo"), adminController.updateAdminPhoto);

// GET /api/v1/admin/verification-status
router.get("/verification-status", verifyToken, isAdmin, adminController.getVerificationStatus);

// ==================== SETTINGS ROUTES ====================

// GET /api/v1/admin/settings
router.get("/settings", verifyToken, isAdmin, adminController.getAdminSettings);

// PATCH /api/v1/admin/settings/account
router.patch("/settings/account", verifyToken, isAdmin, adminController.updateAdminSettingsAccount);

// PATCH /api/v1/admin/settings/notifications
router.patch("/settings/notifications", verifyToken, isAdmin, adminController.updateAdminSettingsNotifications);

// GET /api/v1/admin/settings/operations
router.get("/settings/operations", verifyToken, isAdmin, adminController.getAdminSettingsOperations);

// PATCH /api/v1/admin/settings/operations
router.patch("/settings/operations", verifyToken, isAdmin, adminController.updateAdminSettingsOperations);

// POST /api/v1/admin/settings/operations/audit-log-cleanup
router.post("/settings/operations/audit-log-cleanup", verifyToken, isAdmin, adminController.cleanupExpiredAuditLogs);

// PATCH /api/v1/admin/settings/preferences
router.patch("/settings/preferences", verifyToken, isAdmin, adminController.updateAdminSettingsPreferences);

// ==================== NOTIFICATION ROUTES ====================

// GET /api/v1/admin/notifications
router.get("/notifications", verifyToken, isAdmin, adminController.getAdminNotifications);

// PATCH /api/v1/admin/notifications/:notificationId/read
router.patch("/notifications/:notificationId/read", verifyToken, isAdmin, adminController.markNotificationAsRead);

// PATCH /api/v1/admin/notifications/read-all
router.patch("/notifications/read-all", verifyToken, isAdmin, adminController.markAllNotificationsAsRead);

// ==================== AUDIT LOG ROUTES ====================

// GET /api/v1/admin/audit-logs
router.get("/audit-logs", verifyToken, isAdmin, adminController.getAuditLogs);

module.exports = router;
