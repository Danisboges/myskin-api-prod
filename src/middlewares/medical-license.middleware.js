const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "../../uploads/licenses");
const maxFileSize = 5 * 1024 * 1024;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `medical-license-${uniqueSuffix}${path.extname(file.originalname).toLowerCase() || ".pdf"}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSize,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      const error = new Error("Medical license must be a PDF file");
      error.status = 400;
      return cb(error);
    }

    return cb(null, true);
  },
});

const uploadMedicalLicense = (req, res, next) => {
  upload.single("medicalLicense")(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "error",
        message: "Medical license file size must not exceed 5MB",
      });
    }

    return res.status(err.status || 400).json({
      status: "error",
      message: err.message,
    });
  });
};

module.exports = uploadMedicalLicense;
