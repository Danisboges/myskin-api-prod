const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");

const createdUserIds = [];
const createdAuditLogIds = [];

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createAdmin = async () => {
  const token = stamp();
  const admin = await prisma.user.create({
    data: {
      name: `Audit Admin ${token}`,
      email: `audit.admin.${token}@example.com`,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role: "admin",
      gender: "male",
      status: "active",
      adminSettings: { create: {} },
    },
    select: { id: true, name: true },
  });

  createdUserIds.push(admin.id);
  return admin;
};

test.after(async () => {
  if (createdAuditLogIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { id: { in: createdAuditLogIds } },
    });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }

  await prisma.$disconnect();
});

test("createAuditLog creates unique auditIds under concurrency", async () => {
  const admin = await createAdmin();
  const token = stamp();

  const logs = await Promise.all(
    Array.from({ length: 20 }, (_, index) => (
      adminService.createAuditLog(
        admin.id,
        admin.name,
        "UPDATE_SYSTEM_SETTINGS",
        `Concurrent audit log ${token} #${index}`,
        {
          ipAddress: "127.0.0.1",
          userAgent: "node-test",
        }
      )
    ))
  );

  createdAuditLogIds.push(...logs.map((log) => log.id));

  const auditIds = logs.map((log) => log.auditId);
  assert.equal(new Set(auditIds).size, logs.length);
  assert.equal(auditIds.every((auditId) => auditId.startsWith("AUD-")), true);
  assert.equal(logs.every((log) => log.action === "UPDATE_SYSTEM_SETTINGS"), true);
  assert.equal(logs.every((log) => log.description.includes(token)), true);
});
