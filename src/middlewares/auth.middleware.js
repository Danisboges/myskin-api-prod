const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      status: "error", 
      message: "Akses ditolak, token tidak ditemukan" 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ 
      status: "error", 
      message: "Token tidak valid atau sudah kadaluwarsa" 
    });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ 
      status: "error", 
      message: "Akses ditolak. Endpoint ini hanya untuk Admin." 
    });
  }
  next();
};

const isAdminOrDoctor = (req, res, next) => {
  // Asumsi data user disimpan di req.user (sesuaikan dengan implementasi verifyToken Anda)
  if (req.user && (req.user.role === "admin" || req.user.role === "doctor")) {
    next(); // Izinkan lanjut ke controller
  } else {
    return res.status(403).json({ 
      success: false, 
      message: "Akses ditolak. Hanya Admin atau Dokter yang diizinkan." 
    });
  }
};

const isDoctor = (req, res, next) => {
  if (!req.user || req.user.role !== "doctor") {
    return res.status(403).json({
      status: "error",
      message: "Akses ditolak. Endpoint ini hanya untuk Dokter."
    });
  }
  next();
};

<<<<<<< Updated upstream
// Pastikan nama di sini sesuai dengan yang akan di-import di route
module.exports = { verifyToken, isAdmin, isAdminOrDoctor, isDoctor };
=======
const isPatient = (req, res, next) => {
  if (!req.user || req.user.role !== "patient") {
    return res.status(403).json({
      status: "error",
      message: "Akses ditolak. Endpoint ini hanya untuk Pasien."
    });
  }
  next();
};

// Pastikan nama di sini sesuai dengan yang akan di-import di route
module.exports = { verifyToken, isAdmin, isAdminOrDoctor, isDoctor, isPatient };
>>>>>>> Stashed changes
