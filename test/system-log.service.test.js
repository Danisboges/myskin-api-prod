const test = require("node:test");
const assert = require("node:assert/strict");

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");
const systemLogService = require("../src/services/system-log.service");

const createdSystemLogIds = [];

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

test.afterEach(async () => {
  if (createdSystemLogIds.length > 0) {
    await prisma.systemLog.deleteMany({
      where: { id: { in: createdSystemLogIds.splice(0) } },
    });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

test("createSystemLog stores data with metadata JSON string", async () => {
  const token = stamp();

  const log = await systemLogService.createSystemLog({
    title: `System log ${token}`,
    description: "System log service test",
    severity: "info",
    category: "system",
    metadata: {
      token,
      source: "system-log.service.test",
    },
  });

  createdSystemLogIds.push(log.id);

  assert.equal(log.title, `System log ${token}`);
  assert.equal(log.severity, "info");
  assert.equal(log.category, "system");
  assert.deepEqual(JSON.parse(log.metadata), {
    token,
    source: "system-log.service.test",
  });
});

test("createSystemLog returns null instead of throwing when prisma fails", async () => {
  const originalCreate = prisma.systemLog.create;
  prisma.systemLog.create = async () => {
    throw new Error("database unavailable");
  };

  try {
    const result = await systemLogService.createSystemLog({
      title: "Failed log",
      description: "This should not throw",
      severity: "info",
      category: "system",
    });

    assert.equal(result, null);
  } finally {
    prisma.systemLog.create = originalCreate;
  }
});

test("getSystemLogs returns created logs and supports type and severity filters", async () => {
  const token = stamp();
  const securityWarning = await systemLogService.createSystemLog({
    title: `Security warning ${token}`,
    description: "Security warning test",
    severity: "warning",
    category: "security",
    metadata: { token },
  });
  const infrastructureInfo = await systemLogService.createSystemLog({
    title: `Infrastructure info ${token}`,
    description: "Infrastructure info test",
    severity: "info",
    category: "infrastructure",
    metadata: { token },
  });

  createdSystemLogIds.push(securityWarning.id, infrastructureInfo.id);

  const allLogs = await adminService.getSystemLogs({ page: 1, limit: 20 });
  assert.ok(allLogs.data.some((log) => log.id === securityWarning.id));
  assert.ok(allLogs.data.some((log) => log.id === infrastructureInfo.id));

  const securityLogs = await adminService.getSystemLogs({
    type: "security",
    page: 1,
    limit: 20,
  });
  assert.ok(securityLogs.data.some((log) => log.id === securityWarning.id));
  assert.equal(securityLogs.data.some((log) => log.id === infrastructureInfo.id), false);

  const warningLogs = await adminService.getSystemLogs({
    severity: "warning",
    page: 1,
    limit: 20,
  });
  assert.ok(warningLogs.data.some((log) => log.id === securityWarning.id));
  assert.equal(warningLogs.data.some((log) => log.id === infrastructureInfo.id), false);
});

test("cleanupExpiredSystemLogs deletes old logs and keeps fresh logs", async () => {
  const token = stamp();
  const oldLog = await prisma.systemLog.create({
    data: {
      title: `Old system log ${token}`,
      description: "Old system log cleanup test",
      severity: "info",
      category: "system",
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  const freshLog = await prisma.systemLog.create({
    data: {
      title: `Fresh system log ${token}`,
      description: "Fresh system log cleanup test",
      severity: "info",
      category: "system",
      createdAt: new Date(),
    },
    select: { id: true },
  });

  createdSystemLogIds.push(oldLog.id, freshLog.id);

  const result = await systemLogService.cleanupExpiredSystemLogs(30);

  assert.ok(result.deletedCount >= 1);
  assert.equal(await prisma.systemLog.findUnique({ where: { id: oldLog.id } }), null);
  assert.notEqual(await prisma.systemLog.findUnique({ where: { id: freshLog.id } }), null);
});
