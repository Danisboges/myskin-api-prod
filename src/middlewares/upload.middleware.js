const multer = require('multer');

// Gunakan memoryStorage agar data gambar disimpan di RAM (Buffer)
// bukan langsung dibuang/disimpan ke hardisk sementara
const storage = multer.memoryStorage();

// Jika ada filter file (misal hanya boleh JPG/PNG), bisa ditaruh di sini juga
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Batas maksimal ukuran file (contoh: 5MB)
  }
});

module.exports = upload;