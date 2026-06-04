const prisma = require("../config/prisma");

const VALID_LOG_SEVERITIES = ["critical", "warning", "info"];
const VALID_LOG_CATEGORIES = ["infrastructure", "ai_engine", "user_management", "security", "system"];

const serializeMetadata = (metadata) => {
  if (metadata === undefined || metadata === null) {
    return undefined;
  }

  if (typeof metadata === "string") {
    return metadata;
  }

  return JSON.stringify(metadata);
};

const createSystemLog = async ({ title, description, severity, category, metadata }) => {
  try {
    if (!VALID_LOG_SEVERITIES.includes(severity)) {
      throw new Error("Invalid system log severity");
    }

    if (!VALID_LOG_CATEGORIES.includes(category)) {
      throw new Error("Invalid system log category");
    }

    return await prisma.systemLog.create({
      data: {
        title,
        description,
        severity,
        category,
        metadata: serializeMetadata(metadata),
      },
    });
  } catch (error) {
    console.error("Failed to create system log:", error.message);
    return null;
  }
};

const cleanupExpiredSystemLogs = async (retentionDays) => {
  const normalizedRetentionDays = Number(retentionDays);

  if (!Number.isFinite(normalizedRetentionDays) || normalizedRetentionDays <= 0) {
    throw new Error("retentionDays must be a positive number");
  }

  const cutoffDate = new Date(
    Date.now() - normalizedRetentionDays * 24 * 60 * 60 * 1000
  );

  const result = await prisma.systemLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return {
    deletedCount: result.count,
  };
};

module.exports = {
  VALID_LOG_SEVERITIES,
  VALID_LOG_CATEGORIES,
  createSystemLog,
  cleanupExpiredSystemLogs,
};
