const test = require("node:test");
const assert = require("node:assert/strict");

const adminController = require("../src/controllers/admin.controller");
const adminService = require("../src/services/admin.service");
const systemLogService = require("../src/services/system-log.service");

const originalService = {
  getAdminSettings: adminService.getAdminSettings,
  getAdminOperationsSettings: adminService.getAdminOperationsSettings,
  updateAdminSettingsAccount: adminService.updateAdminSettingsAccount,
  updateAdminSettingsNotifications: adminService.updateAdminSettingsNotifications,
  updateAdminSettingsOperations: adminService.updateAdminSettingsOperations,
  updateAdminSettingsPreferences: adminService.updateAdminSettingsPreferences,
  resolveAdminPagination: adminService.resolveAdminPagination,
  getAllUsers: adminService.getAllUsers,
  cleanupExpiredAuditLogs: adminService.cleanupExpiredAuditLogs,
  createAuditLog: adminService.createAuditLog,
};
const originalSystemLogService = {
  createSystemLog: systemLogService.createSystemLog,
  cleanupExpiredSystemLogs: systemLogService.cleanupExpiredSystemLogs,
};

const createRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const createReq = (body = {}) => ({
  body,
  query: {},
  user: {
    id: "admin-1",
    name: "Admin Tester",
  },
  ip: "127.0.0.1",
  get() {
    return "node-test";
  },
});

test.afterEach(() => {
  Object.assign(adminService, originalService);
  Object.assign(systemLogService, originalSystemLogService);
});

test("getAdminSettings controller returns settings data", async () => {
  const settings = {
    account: { email: "admin@example.com" },
    notifications: {
      emailNotifications: true,
      doctorApprovalAlerts: true,
      clinicRequestAlerts: true,
      systemAlerts: true,
      weeklyDigest: false,
    },
    operations: {
      defaultPageSize: 8,
      auditLogRetentionDays: 180,
      maintenanceMode: false,
      deleteConfirmationRequired: true,
    },
    preferences: {
      language: "English (US)",
      timezone: "Asia/Jakarta",
    },
  };
  adminService.getAdminSettings = async () => settings;

  const res = createRes();
  await adminController.getAdminSettings(createReq(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: "success", data: settings });
});

test("updateAdminSettingsAccount controller supports account patch", async () => {
  adminService.updateAdminSettingsAccount = async (adminId, email, currentPassword, newPassword) => {
    assert.equal(adminId, "admin-1");
    assert.equal(email, "admin@example.com");
    assert.equal(currentPassword, "old-password");
    assert.equal(newPassword, "new-password");
    return { message: "Account settings updated successfully" };
  };
  adminService.createAuditLog = async () => ({});
  systemLogService.createSystemLog = async () => ({});

  const res = createRes();
  await adminController.updateAdminSettingsAccount(
    createReq({
      email: "admin@example.com",
      currentPassword: "old-password",
      newPassword: "new-password",
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "success",
    message: "Account settings updated successfully",
  });
});

test("updateAdminSettingsNotifications controller validates and patches notifications", async () => {
  const payload = {
    emailNotifications: false,
    doctorApprovalAlerts: true,
    clinicRequestAlerts: false,
    systemAlerts: true,
    weeklyDigest: true,
  };
  adminService.updateAdminSettingsNotifications = async (adminId, data) => {
    assert.equal(adminId, "admin-1");
    assert.deepEqual(data, payload);
    return { message: "Notification settings updated successfully", data: payload };
  };
  adminService.createAuditLog = async () => ({});
  systemLogService.createSystemLog = async () => ({});

  const res = createRes();
  await adminController.updateAdminSettingsNotifications(createReq(payload), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "success",
    message: "Notification settings updated successfully",
    data: payload,
  });
});

test("updateAdminSettingsOperations controller validates and patches operations", async () => {
  const systemLogs = [];
  const payload = {
    defaultPageSize: 16,
    auditLogRetentionDays: 90,
    maintenanceMode: true,
    deleteConfirmationRequired: false,
  };
  adminService.updateAdminSettingsOperations = async (adminId, data) => {
    assert.equal(adminId, "admin-1");
    assert.deepEqual(data, payload);
    return { message: "Operation settings updated successfully", data: payload };
  };
  adminService.getAdminOperationsSettings = async () => ({
    defaultPageSize: 16,
    auditLogRetentionDays: 90,
    maintenanceMode: false,
    deleteConfirmationRequired: false,
  });
  adminService.createAuditLog = async () => ({});
  systemLogService.createSystemLog = async (data) => {
    systemLogs.push(data);
    return {};
  };

  const res = createRes();
  await adminController.updateAdminSettingsOperations(createReq(payload), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "success",
    message: "Operation settings updated successfully",
    data: payload,
  });
  assert.deepEqual(systemLogs, [{
    severity: "warning",
    category: "infrastructure",
    title: "Maintenance mode enabled",
    description: "Admin changed platform maintenance mode",
    metadata: {
      adminId: "admin-1",
      maintenanceMode: true,
    },
  }]);
});

test("getAdminSettingsOperations controller returns lightweight operation settings", async () => {
  const operations = {
    defaultPageSize: 8,
    auditLogRetentionDays: 180,
    maintenanceMode: false,
    deleteConfirmationRequired: true,
  };
  adminService.getAdminOperationsSettings = async (adminId) => {
    assert.equal(adminId, "admin-1");
    return operations;
  };

  const res = createRes();
  await adminController.getAdminSettingsOperations(createReq(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "success",
    data: operations,
  });
});

test("getAllUsers controller uses defaultPageSize when limit is not provided", async () => {
  adminService.resolveAdminPagination = async (adminId, pagination) => {
    assert.equal(adminId, "admin-1");
    assert.deepEqual(pagination, { page: undefined, limit: undefined });
    return { page: 1, limit: 16 };
  };
  adminService.getAllUsers = async (filters) => {
    assert.equal(filters.limit, 16);
    return { data: [], meta: { page: 1, limit: 16, total: 0, totalPages: 0 } };
  };

  const res = createRes();
  await adminController.getAllUsers(createReq(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.meta.limit, 16);
});

test("getAllUsers controller lets query limit override defaultPageSize", async () => {
  const req = createReq();
  req.query = { limit: "24" };
  adminService.resolveAdminPagination = async (adminId, pagination) => {
    assert.equal(adminId, "admin-1");
    assert.deepEqual(pagination, { page: undefined, limit: "24" });
    return { page: 1, limit: 24 };
  };
  adminService.getAllUsers = async (filters) => {
    assert.equal(filters.limit, 24);
    return { data: [], meta: { page: 1, limit: 24, total: 0, totalPages: 0 } };
  };

  const res = createRes();
  await adminController.getAllUsers(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.meta.limit, 24);
});

test("cleanupExpiredAuditLogs controller returns deleted count", async () => {
  const systemLogs = [];
  adminService.cleanupExpiredAuditLogs = async () => ({
    message: "Expired audit logs cleaned up successfully",
    deletedCount: 2,
  });
  adminService.createAuditLog = async () => ({});
  systemLogService.createSystemLog = async (data) => {
    systemLogs.push(data);
    return {};
  };

  const res = createRes();
  await adminController.cleanupExpiredAuditLogs(createReq(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "success",
    message: "Expired audit logs cleaned up successfully",
    deletedCount: 2,
  });
  assert.deepEqual(systemLogs, [{
    severity: "info",
    category: "system",
    title: "Audit logs cleanup completed",
    description: "Expired audit logs were cleaned up",
    metadata: {
      adminId: "admin-1",
      deletedCount: 2,
    },
  }]);
});

test("settings PATCH controllers can create audit logs in parallel", async () => {
  const auditDescriptions = [];
  adminService.updateAdminSettingsAccount = async () => ({
    message: "Account settings updated successfully",
  });
  adminService.updateAdminSettingsNotifications = async () => ({
    message: "Notification settings updated successfully",
    data: {
      emailNotifications: true,
      doctorApprovalAlerts: true,
      clinicRequestAlerts: true,
      systemAlerts: true,
      weeklyDigest: false,
    },
  });
  adminService.updateAdminSettingsOperations = async () => ({
    message: "Operation settings updated successfully",
    data: {
      defaultPageSize: 8,
      auditLogRetentionDays: 180,
      maintenanceMode: false,
      deleteConfirmationRequired: true,
    },
  });
  adminService.getAdminOperationsSettings = async () => ({
    defaultPageSize: 8,
    auditLogRetentionDays: 180,
    maintenanceMode: false,
    deleteConfirmationRequired: true,
  });
  adminService.updateAdminSettingsPreferences = async () => ({
    message: "Preferences updated successfully",
    data: {
      language: "English (US)",
      timezone: "Asia/Jakarta",
    },
  });
  adminService.createAuditLog = async (adminId, adminName, action, description) => {
    assert.equal(adminId, "admin-1");
    assert.equal(adminName, "Admin Tester");
    assert.equal(action, "UPDATE_SYSTEM_SETTINGS");
    auditDescriptions.push(description);
    return {};
  };

  const requests = [
    [adminController.updateAdminSettingsAccount, createReq({ email: "admin@example.com" })],
    [adminController.updateAdminSettingsNotifications, createReq({
      emailNotifications: true,
      doctorApprovalAlerts: true,
      clinicRequestAlerts: true,
      systemAlerts: true,
      weeklyDigest: false,
    })],
    [adminController.updateAdminSettingsOperations, createReq({
      defaultPageSize: 8,
      auditLogRetentionDays: 180,
      maintenanceMode: false,
      deleteConfirmationRequired: true,
    })],
    [adminController.updateAdminSettingsPreferences, createReq({
      language: "English (US)",
      timezone: "Asia/Jakarta",
    })],
  ];

  const responses = await Promise.all(
    requests.map(async ([handler, req]) => {
      const res = createRes();
      await handler(req, res);
      return res;
    })
  );

  assert.deepEqual(responses.map((res) => res.statusCode), [200, 200, 200, 200]);
  assert.equal(auditDescriptions.length, 4);
  assert.deepEqual(auditDescriptions.sort(), [
    "Admin updated account settings",
    "Admin updated notification settings",
    "Admin updated operation settings",
    "Admin updated preference settings",
  ].sort());
});

test("updateAdminSettingsPreferences controller validates and patches preferences", async () => {
  const payload = {
    language: "Bahasa Indonesia",
    timezone: "UTC",
  };
  adminService.updateAdminSettingsPreferences = async (adminId, data) => {
    assert.equal(adminId, "admin-1");
    assert.deepEqual(data, payload);
    return { message: "Preferences updated successfully", data: payload };
  };
  adminService.createAuditLog = async () => ({});

  const res = createRes();
  await adminController.updateAdminSettingsPreferences(createReq(payload), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "success",
    message: "Preferences updated successfully",
    data: payload,
  });
});
