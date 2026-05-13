require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Untuk auto-create folder uploads
const userRoutes = require('./src/routes/auth.route');
const detectionRoutes = require('./src/routes/detection.route');
const userManagementRoutes = require("./src/routes/userManagement.route");
const doctorRoutes = require('./src/routes/doctor.route');
const adminRoutes = require('./src/routes/admin.route');

const app = express();

// 1. BUAT FOLDER UPLOADS OTOMATIS (Mencegah error ENOENT)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 2. MIDDLEWARE UTAMA (Body Parser diletakkan paling atas dengan limit 10MB)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 3. STATIC FILES
app.use('/uploads', express.static(uploadDir));

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

// 5. Report uploads 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. ROUTES
app.use('/api/auth', userRoutes);
app.use('/api/detection', detectionRoutes);
app.use("/api/user", userManagementRoutes);
app.use('/api/v1/doctor', doctorRoutes);
app.use('/api/v1/admin', adminRoutes);

// 6. 404 HANDLER (Jika route tidak ditemukan)
app.use((req, res) => {
    res.status(404).json({ status: "error", message: "Endpoint tidak ditemukan" });
});

// 7. GLOBAL ERROR HANDLING
app.use((err, req, res, next) => {
  console.error('Error log:', err.message);
  res.status(err.status || 500).json({ 
    status: "error",
    message: err.message || 'Something went wrong!' 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});