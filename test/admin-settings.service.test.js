const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");
const { formatDateForAdmin } = require("../src/utils/admin-date.util");

const createdUserIds = [];

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createAdmin = async () => {
  const token = stamp();
  const admin = await prisma.user.create({
    data: {
      name: `Settings Admin ${token}`,
      email: `settings.admin.${token}@example.com`,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role: "admin",
      gender: "male",
      status: "active",
    },
    select: { id: true, email: true },
  });

  createdUserIds.push(admin.id);
  return admin;
};

test.after(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }

  await prisma.$disconnect();
});

test("getAdminSettings returns the new UI settings shape with defaults", async () => {
  const admin = await createAdmin();

  const settings = await adminService.getAdminSettings(admin.id);

  assert.deepEqual(settings, {
    account: {
      email: admin.email,
    },
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
  });
});

test("updateAdminSettingsAccount supports email and password changes", async () => {
  const admin = await createAdmin();
  const token = stamp();

  const result = await adminService.updateAdminSettingsAccount(
    admin.id,
    `  Settings.Updated.${token}@Example.COM  `,
    "Str0ng!Pass2026",
    "N3w!SecurePass2026"
  );

  assert.equal(result.message, "Account settings updated successfully");

  const updatedAdmin = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { email: true, password: true },
  });
  assert.equal(updatedAdmin.email, `settings.updated.${token}@example.com`);
  assert.equal(await bcrypt.compare("N3w!SecurePass2026", updatedAdmin.password), true);
});

test("updateAdminSettingsNotifications stores all notification fields", async () => {
  const admin = await createAdmin();

  const result = await adminService.updateAdminSettingsNotifications(admin.id, {
    emailNotifications: false,
    doctorApprovalAlerts: false,
    clinicRequestAlerts: true,
    systemAlerts: false,
    weeklyDigest: true,
  });

  assert.deepEqual(result.data, {
    emailNotifications: false,
    doctorApprovalAlerts: false,
    clinicRequestAlerts: true,
    systemAlerts: false,
    weeklyDigest: true,
  });

  const settings = await adminService.getAdminSettings(admin.id);
  assert.deepEqual(settings.notifications, result.data);
});

test("updateAdminSettingsOperations stores operation fields", async () => {
  const admin = await createAdmin();

  const result = await adminService.updateAdminSettingsOperations(admin.id, {
    defaultPageSize: 24,
    auditLogRetentionDays: 365,
    maintenanceMode: true,
    deleteConfirmationRequired: false,
  });

  assert.deepEqual(result.data, {
    defaultPageSize: 24,
    auditLogRetentionDays: 365,
    maintenanceMode: true,
    deleteConfirmationRequired: false,
  });

  const settings = await adminService.getAdminSettings(admin.id);
  assert.deepEqual(settings.operations, result.data);
});

test("getAdminOperationsSettings returns lightweight operation settings", async () => {
  const admin = await createAdmin();

  await adminService.updateAdminSettingsOperations(admin.id, {
    defaultPageSize: 16,
    auditLogRetentionDays: 90,
    maintenanceMode: false,
    deleteConfirmationRequired: true,
  });

  const operations = await adminService.getAdminOperationsSettings(admin.id);
  assert.deepEqual(operations, {
    defaultPageSize: 16,
    auditLogRetentionDays: 90,
    maintenanceMode: false,
    deleteConfirmationRequired: true,
  });
});

test("resolveAdminPagination uses defaultPageSize unless query limit is provided", async () => {
  const admin = await createAdmin();

  await adminService.updateAdminSettingsOperations(admin.id, {
    defaultPageSize: 32,
  });

  assert.deepEqual(await adminService.resolveAdminPagination(admin.id, { page: 2 }), {
    page: 2,
    limit: 32,
  });
  assert.deepEqual(await adminService.resolveAdminPagination(admin.id, { page: 1, limit: 24 }), {
    page: 1,
    limit: 24,
  });
});

test("cleanupExpiredAuditLogs removes old logs and keeps fresh logs by retention", async () => {
  const admin = await createAdmin();
  const token = stamp();
  await adminService.updateAdminSettingsOperations(admin.id, {
    auditLogRetentionDays: 30,
  });

  const oldLog = await prisma.auditLog.create({
    data: {
      auditId: `AUD-OLD-${token}`,
      adminId: admin.id,
      adminName: "Settings Admin",
      action: "UPDATE_SYSTEM_SETTINGS",
      description: `Old audit log ${token}`,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  const freshLog = await prisma.auditLog.create({
    data: {
      auditId: `AUD-NEW-${token}`,
      adminId: admin.id,
      adminName: "Settings Admin",
      action: "UPDATE_SYSTEM_SETTINGS",
      description: `Fresh audit log ${token}`,
      createdAt: new Date(),
    },
    select: { id: true },
  });

  const result = await adminService.cleanupExpiredAuditLogs({ adminIds: [admin.id] });
  assert.equal(result.deletedCount, 1);
  assert.equal(await prisma.auditLog.findUnique({ where: { id: oldLog.id } }), null);
  assert.notEqual(await prisma.auditLog.findUnique({ where: { id: freshLog.id } }), null);
});

test("updateAdminSettingsPreferences stores language and timezone", async () => {
  const admin = await createAdmin();

  const result = await adminService.updateAdminSettingsPreferences(admin.id, {
    language: "Bahasa Indonesia",
    timezone: "Asia/Makassar",
  });

  assert.deepEqual(result.data, {
    language: "Bahasa Indonesia",
    timezone: "Asia/Makassar",
  });

  const settings = await adminService.getAdminSettings(admin.id);
  assert.deepEqual(settings.preferences, result.data);
});

test("formatDateForAdmin formats dates using selected timezone", () => {
  const date = new Date("2026-05-31T00:00:00.000Z");

  assert.equal(formatDateForAdmin(date, "UTC"), "2026-05-31 00:00:00 UTC");
  assert.equal(formatDateForAdmin(date, "Asia/Jakarta"), "2026-05-31 07:00:00 Asia/Jakarta");
});

test("getAuditLogs includes formattedCreatedAt using admin timezone", async () => {
  const admin = await createAdmin();
  const token = stamp();

  await adminService.updateAdminSettingsPreferences(admin.id, {
    timezone: "Asia/Jayapura",
  });

  await prisma.auditLog.create({
    data: {
      auditId: `AUD-TZ-${token}`,
      adminId: admin.id,
      adminName: "Settings Admin",
      action: "UPDATE_SYSTEM_SETTINGS",
      description: `Timezone audit log ${token}`,
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
    },
  });

  const logs = await adminService.getAuditLogs({
    requestingAdminId: admin.id,
    adminId: admin.id,
    page: 1,
    limit: 5,
  });
  const log = logs.data.find((item) => item.description === `Timezone audit log ${token}`);

  assert.ok(log);
  assert.equal(log.formattedCreatedAt, "2026-05-31 09:00:00 Asia/Jayapura");
});
