const prisma = require("../config/prisma");

const MAINTENANCE_RESPONSE = {
  status: "error",
  code: "maintenance_mode",
  message: "System is under maintenance.",
};

const isMaintenanceModeActive = async () => {
  if (process.env.MAINTENANCE_MODE_TEST_OVERRIDE === "true") {
    return true;
  }

  if (process.env.MAINTENANCE_MODE_TEST_OVERRIDE === "false") {
    return false;
  }

  const setting = await prisma.adminSettings.findFirst({
    where: { maintenanceMode: true },
    select: { id: true },
  });

  return Boolean(setting);
};

const createMaintenanceError = () => {
  const error = new Error(MAINTENANCE_RESPONSE.message);
  error.status = 503;
  error.code = MAINTENANCE_RESPONSE.code;
  error.response = MAINTENANCE_RESPONSE;
  return error;
};

module.exports = {
  MAINTENANCE_RESPONSE,
  isMaintenanceModeActive,
  createMaintenanceError,
};
