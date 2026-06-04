const prisma = require("../config/prisma");

const VALID_ADMIN_NOTIFICATION_SETTINGS = new Set([
  "doctorApprovalAlerts",
  "clinicRequestAlerts",
  "systemAlerts",
  "weeklyDigest",
  "emailNotifications",
]);

const createAdminNotificationForEnabledAdmins = async (
  type,
  title,
  message,
  settingKey,
  metadata = {}
) => {
  if (process.env.ADMIN_NOTIFICATION_TEST_DISABLE === "true") {
    return {
      count: 0,
      metadata,
    };
  }

  if (!VALID_ADMIN_NOTIFICATION_SETTINGS.has(settingKey)) {
    const error = new Error("Invalid admin notification setting key");
    error.status = 400;
    throw error;
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: {
      id: true,
      adminSettings: true,
    },
  });

  const notificationData = admins
    .filter((admin) => admin.adminSettings?.[settingKey] === true)
    .map((admin) => ({
      adminId: admin.id,
      type,
      title,
      message,
    }));

  if (notificationData.length === 0) {
    return {
      count: 0,
      metadata,
    };
  }

  const result = await prisma.adminNotification.createMany({
    data: notificationData,
  });

  return {
    count: result.count,
    metadata,
  };
};

const createCriticalSystemAlert = async (title, message, metadata = {}) => (
  createAdminNotificationForEnabledAdmins(
    "system_alert",
    title,
    message,
    "systemAlerts",
    metadata
  )
);

module.exports = {
  createAdminNotificationForEnabledAdmins,
  createCriticalSystemAlert,
};
