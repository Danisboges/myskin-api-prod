require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Untuk auto-create folder uploads
const userRoutes = require('./src/routes/auth.route');
// const detectionRoutes = require('./src/routes/detection.route');
const guestRoutes = require('./src/routes/guest.route');
const userManagementRoutes = require("./src/routes/userManagement.route");
const doctorRoutes = require('./src/routes/doctor.route');
const adminRoutes = require('./src/routes/admin.route');
const patientRoutes = require('./src/routes/patient.route');
const consultationRoutes = require('./src/routes/consultation.route');
const aiConsultationRoutes = require('./src/routes/ai-consultation.route');
const clinicRoutes = require('./src/routes/clinic.route');
const clinicRequestRoutes = require('./src/routes/clinic-request.route');
const { maintenanceModeMiddleware } = require('./src/middlewares/maintenance.middleware');
const { createCriticalSystemAlert } = require('./src/services/admin-notification.service');
const systemLogService = require('./src/services/system-log.service');
const { assetUrlResponseMiddleware } = require('./src/utils/asset-url.util');

const app = express();
const adminUiDir = path.join(__dirname, 'public', 'admin');
app.set('trust proxy', 1);

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5500',
];

const allowedOrigins = (process.env.CORS_ORIGINS || defaultAllowedOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// 1. BUAT FOLDER UPLOADS OTOMATIS (Mencegah error ENOENT)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadStaticOptions = {
  setHeaders(res) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
};

// 2. MIDDLEWARE UTAMA (Body Parser diletakkan paling atas dengan limit 10MB)
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(assetUrlResponseMiddleware);

// 3. STATIC FILES
app.use('/uploads', express.static(uploadDir, uploadStaticOptions));
app.use('/api/uploads', express.static(uploadDir, uploadStaticOptions));
app.use('/admin', express.static(adminUiDir));

// 4. CUSTOM LOGGER MIDDLEWARE
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${req.method} ${req.originalUrl}`);

  if (req.body && Object.keys(req.body).length > 0) {
    // Jangan log body jika isinya terlalu besar (opsional)
    console.log('Body Payload:', req.body);
  }
  next();
});

app.use(maintenanceModeMiddleware);

// 5. ROUTES
app.use('/api/auth', userRoutes);
app.use('/api/v1/auth', userRoutes);
app.use('/api/guest', guestRoutes);
// app.use('/api/detection', detectionRoutes);
app.use("/api/user", userManagementRoutes);
app.use('/api/v1/doctor', doctorRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/patient', patientRoutes);
app.use('/api/v1/clinics', clinicRoutes);
app.use('/api/v1/clinic-requests', clinicRequestRoutes);
app.use('/api/v1/patient/ai-consultations', aiConsultationRoutes);
app.use('/api/v1/patient/consultations', consultationRoutes);
app.use('/api/v1/doctor/consultations', consultationRoutes);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(adminUiDir, 'index.html'));
});

// 6. 404 HANDLER (Jika route tidak ditemukan)
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Endpoint tidak ditemukan" });
});

// 7. GLOBAL ERROR HANDLING
const globalErrorHandler = async (err, req, res, next) => {
  console.error('Error log:', err.message);
  if ((err.status || 500) >= 500) {
    await systemLogService.createSystemLog({
      severity: "critical",
      category: "system",
      title: "Critical system error",
      description: err.message || "Unhandled server error",
      metadata: {
        method: req.method,
        path: req.originalUrl,
        status: err.status || 500,
      },
    });

    createCriticalSystemAlert(
      "Critical system error",
      err.message || "Unhandled server error",
      { method: req.method, path: req.originalUrl }
    ).catch((notificationError) => {
      console.error("Failed to create system alert notification:", notificationError.message);
    });
  }

  res.status(err.status || 500).json({
    status: "error",
    message: err.message || 'Something went wrong!'
  });
};

app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.globalErrorHandler = globalErrorHandler;
