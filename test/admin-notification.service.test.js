const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = "false";
process.env.ADMIN_NOTIFICATION_TEST_DISABLE = "false";

const prisma = require("../src/config/prisma");
const adminService = require("../src/services/admin.service");
const { registerUser } = require("../src/services/auth.service");
const clinicRequestService = require("../src/services/clinic-request.service");
const {
  createAdminNotificationForEnabledAdmins,
} = require("../src/services/admin-notification.service");

const createdUserIds = [];
const createdClinicIds = [];
const notificationTokens = [];

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const rememberToken = (token) => {
  notificationTokens.push(token);
  return token;
};

const createAdmin = async (settings = {}) => {
  const token = stamp();
  const admin = await prisma.user.create({
    data: {
      name: `Notification Admin ${token}`,
      email: `notification.admin.${token}@example.com`,
      password: await bcrypt.hash("Str0ng!Pass2026", 10),
      role: "admin",
      gender: "male",
      status: "active",
      adminSettings: {
        create: {
          doctorApprovalAlerts: settings.doctorApprovalAlerts ?? true,
          clinicRequestAlerts: settings.clinicRequestAlerts ?? true,
          systemAlerts: settings.systemAlerts ?? true,
          maintenanceMode: false,
        },
      },
    },
    select: { id: true },
  });

  createdUserIds.push(admin.id);
  return admin;
};

const createClinic = async (name) => {
  const clinic = await prisma.clinic.create({
    data: { name, isActive: true },
    select: { clinicId: true },
  });

  createdClinicIds.push(clinic.clinicId);
  return clinic;
};

const countNotifications = (adminId, token, type) => (
  prisma.adminNotification.count({
    where: {
      adminId,
      type,
      message: { contains: token },
    },
  })
);

test.after(async () => {
  if (notificationTokens.length > 0) {
    await prisma.adminNotification.deleteMany({
      where: {
        OR: notificationTokens.map((token) => ({
          message: { contains: token },
        })),
      },
    });

    await prisma.clinicRequest.deleteMany({
      where: {
        OR: notificationTokens.map((token) => ({
          clinicName: { contains: token },
        })),
      },
    });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }

  if (createdClinicIds.length > 0) {
    await prisma.clinic.deleteMany({
      where: { clinicId: { in: createdClinicIds } },
    });
  }

  await prisma.$disconnect();
});

test("doctor register membuat adminNotification jika doctorApprovalAlerts true", async () => {
  const token = rememberToken(`doctor-approval-true-${stamp()}`);
  const enabledAdmin = await createAdmin({ doctorApprovalAlerts: true });
  const clinic = await createClinic(`Clinic ${token}`);

  const doctor = await registerUser({
    fullName: `Doctor ${token}`,
    email: `doctor.${token}@example.com`,
    password: "Str0ng!Pass2026",
    role: "doctor",
    gender: "male",
    clinicId: clinic.clinicId,
    specialization: "Dermatology",
    licenseNumber: `LIC-${token}`,
  });
  createdUserIds.push(doctor.id);

  assert.equal(await countNotifications(enabledAdmin.id, token, "doctor_approval"), 1);
});

test("doctor register tidak membuat adminNotification jika doctorApprovalAlerts false", async () => {
  const token = rememberToken(`doctor-approval-false-${stamp()}`);
  const disabledAdmin = await createAdmin({ doctorApprovalAlerts: false });
  const clinic = await createClinic(`Clinic ${token}`);

  const doctor = await registerUser({
    fullName: `Doctor ${token}`,
    email: `doctor.${token}@example.com`,
    password: "Str0ng!Pass2026",
    role: "doctor",
    gender: "female",
    clinicId: clinic.clinicId,
    specialization: "Dermatology",
    licenseNumber: `LIC-${token}`,
  });
  createdUserIds.push(doctor.id);

  assert.equal(await countNotifications(disabledAdmin.id, token, "doctor_approval"), 0);
});

test("clinic request membuat adminNotification jika clinicRequestAlerts true", async () => {
  const token = rememberToken(`clinic-request-true-${stamp()}`);
  const enabledAdmin = await createAdmin({ clinicRequestAlerts: true });

  await clinicRequestService.createClinicRequest({
    clinicName: `Clinic Request ${token}`,
    requesterName: `Requester ${token}`,
    requesterEmail: `requester.${token}@example.com`,
    requesterPhone: "+628123456789",
  });

  assert.equal(await countNotifications(enabledAdmin.id, token, "clinic_request"), 1);
});

test("clinic request tidak membuat adminNotification jika clinicRequestAlerts false", async () => {
  const token = rememberToken(`clinic-request-false-${stamp()}`);
  const disabledAdmin = await createAdmin({ clinicRequestAlerts: false });

  await clinicRequestService.createClinicRequest({
    clinicName: `Clinic Request ${token}`,
    requesterName: `Requester ${token}`,
    requesterEmail: `requester.${token}@example.com`,
    requesterPhone: "+628123456789",
  });

  assert.equal(await countNotifications(disabledAdmin.id, token, "clinic_request"), 0);
});

test("GET admin notifications menampilkan notification yang dibuat", async () => {
  const token = rememberToken(`system-alert-${stamp()}`);
  const enabledAdmin = await createAdmin({ systemAlerts: true });

  await createAdminNotificationForEnabledAdmins(
    "system_alert",
    "Critical system error",
    `System alert ${token}`,
    "systemAlerts"
  );

  const notifications = await adminService.getAdminNotifications(enabledAdmin.id);
  const createdNotification = notifications.data.find((notification) => (
    notification.type === "system_alert" &&
    notification.title === "Critical system error" &&
    notification.message === `System alert ${token}`
  ));

  assert.ok(createdNotification);
  assert.equal(notifications.unreadCount >= 1, true);
});
