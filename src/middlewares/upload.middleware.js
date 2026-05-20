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

const uploadInstance = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Batas maksimal ukuran file (contoh: 5MB)
  }
});

// Wrapper untuk single file upload dengan error handling
const uploadSingleFile = (fieldName) => {
  return (req, res, next) => {
    uploadInstance.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            message: 'File size exceeds 5MB limit'
          });
        }
        return res.status(400).json({
          status: 'error',
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          status: 'error',
          message: err.message || 'Invalid file upload format. Use multipart/form-data with correct field name'
        });
      }
      next();
    });
  };
};

// Legacy error handler untuk kompatibilitas
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File size exceeds 5MB limit'
      });
    }
    return res.status(400).json({
      status: 'error',
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Invalid file upload format. Use multipart/form-data'
    });
  }
  next();
};

module.exports = { 
  upload: uploadInstance,
  uploadSingleFile,
  handleUploadError
};