const jwt = require("jsonwebtoken");
const {
  MAINTENANCE_RESPONSE,
  isMaintenanceModeActive,
} = require("../utils/maintenance.util");

const EXCLUDED_PATHS = [
  "/uploads",
  "/admin",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/google",
  "/api/auth/google/callback",
];

const isExcludedPath = (path) => (
  EXCLUDED_PATHS.some((excludedPath) => (
    path === excludedPath || path.startsWith(`${excludedPath}/`)
  ))
);

const maintenanceModeMiddleware = async (req, res, next) => {
  try {
    if (isExcludedPath(req.path)) {
      return next();
    }

    const isActive = await isMaintenanceModeActive();
    if (!isActive) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = req.user || decoded;

      if (decoded.role === "admin") {
        return next();
      }

      return res.status(503).json(MAINTENANCE_RESPONSE);
    } catch (err) {
      return next();
    }
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  maintenanceModeMiddleware,
  isExcludedPath,
};
