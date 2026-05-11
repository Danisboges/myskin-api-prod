const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');


// ==================== DASHBOARD ENDPOINTS ====================

// Catatan: Jika sudah deploy, Anda tinggal menginstal @google-cloud/storage
// const { Storage } = require('@google-cloud/storage');
// const storage = new Storage();

const getDashboardSummary = async () => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers, 
      usersPrevMonth, 
      activeSessionsData, 
      accuracyData,
      totalDetections
    ] = await Promise.all([
      // 1. Total User & Growth Data
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),

      // 2. Sesi Aktif (24 Jam Terakhir)
      prisma.consultation.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { patientId: true },
        distinct: ["patientId"],
      }),

      // 3. Rata-rata Akurasi Deteksi
      prisma.detection.aggregate({
        _avg: { confidence: true },
      }),

      // 4. Hitung jumlah deteksi untuk estimasi storage lokal
      prisma.detection.count()
    ]);

    // LOGIKA PERHITUNGAN GROWTH
    const totalUsersGrowth = usersPrevMonth > 0 
      ? ((totalUsers - usersPrevMonth) / usersPrevMonth) * 100 
      : (totalUsers > 0 ? 100 : 0);

    /**
     * CATATAN STRATEGI STORAGE:
     * Saat ini (Tahap Development), kita menggunakan estimasi berbasis jumlah database.
     * Setelah DEPLOY, Anda bisa mengganti variabel 'storageUsage' di bawah dengan 
     * hasil dari fungsi getRealCloudStorageUsage().
     */
    
    // Estimasi Lokal (Dev Mode)
    const estimatedMB = totalDetections * 0.5; // Asumsi 1 gambar = 500KB
    const limitMB = 5120; // Contoh limit 5GB

    const storageUsage = {
      percentage: Math.min(Math.round((estimatedMB / limitMB) * 100), 100),
      used: estimatedMB < 1024 ? `${estimatedMB.toFixed(2)} MB` : `${(estimatedMB/1024).toFixed(2)} GB`,
      total: "5.0 GB",
    };

    return {
      totalUsers,
      totalUsersGrowth: parseFloat(totalUsersGrowth.toFixed(1)),
      activeSessions: activeSessionsData.length,
      storageUsage, // <--- Siap diganti data asli setelah deploy
      averageDetectionAccuracy: accuracyData._avg.confidence 
        ? parseFloat((accuracyData._avg.confidence * 100).toFixed(1)) 
        : 96.4,
      accuracyGrowth: 0.2, 
    };
  } catch (error) {
    console.error("Dashboard Error:", error);
    throw error;
  }
};

/** * FUNGSI SIAP PAKAI SETELAH DEPLOY (Google Cloud Storage)
 * Anda bisa memanggil ini di dalam getDashboardSummary nanti
 */
/*
const getRealCloudStorageUsage = async (bucketName) => {
  const [files] = await storage.bucket(bucketName).getFiles();
  let totalSizeBytes = 0;
  files.forEach(file => totalSizeBytes += parseInt(file.metadata.size));
  
  const usedGB = totalSizeBytes / (1024 ** 3);
  const totalGB = 10; // Sesuaikan kuota
  return {
    percentage: Math.round((usedGB / totalGB) * 100),
    used: `${usedGB.toFixed(2)} GB`,
    total: `${totalGB} GB`
  };
};
*/

const getUserGrowthData = async (range = "30d") => {
  try {
    const now = new Date();
    let startDate;
    let groupBy = 'day'; // Default pengelompokan

    // 1. Tentukan rentang waktu berdasarkan parameter
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupBy = 'week';
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        groupBy = 'month';
        break;
      case "30d":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'week';
    }

    // 2. Ambil data asli dari database
    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    // 3. Olah data sesuai dengan label chart (Day/Week/Month)
    const processedData = processChartData(users, range, groupBy);

    return {
      range,
      data: processedData,
    };
  } catch (error) {
    console.error("Error in getUserGrowthData:", error);
    throw error;
  }
};

/**
 * Helper function untuk mengolah data sesuai format label chart
 */
function processChartData(users, range, groupBy) {
  const dataMap = {};

  users.forEach((user) => {
    let label;
    const date = new Date(user.createdAt);

    if (range === "7d") {
      // Label: Day 1, Day 2, dst.
      label = `Day ${date.getDate()}`;
    } else if (range === "30d" || range === "90d") {
      // Label: Week 1, Week 2, dst.
      // Menghitung minggu ke-berapa di bulan tersebut
      const weekNum = Math.ceil(date.getDate() / 7);
      label = `Week ${weekNum} (${date.toLocaleString('default', { month: 'short' })})`;
    } else if (range === "1y") {
      // Label: Jan, Feb, dst.
      label = date.toLocaleString('default', { month: 'short' });
    }

    dataMap[label] = (dataMap[label] || 0) + 1;
  });

  // Ubah Map menjadi Array of Object sesuai format Anda
  return Object.keys(dataMap).map(label => ({
    label: label,
    users: dataMap[label]
  }));
}

const getRoleDistribution = async () => {
  const [adminCount, doctorCount, patientCount, totalUsers] = await Promise.all([
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "doctor" } }),
    prisma.user.count({ where: { role: "patient" } }),
    prisma.user.count(),
  ]);

  const adminPercentage = totalUsers > 0 ? Math.round((adminCount / totalUsers) * 100) : 0;
  const doctorPercentage = totalUsers > 0 ? Math.round((doctorCount / totalUsers) * 100) : 0;
  const patientPercentage = totalUsers > 0 ? 100 - adminPercentage - doctorPercentage : 0;

  return {
    data: [
      {
        role: "patient",
        label: "Patients",
        percentage: patientPercentage,
        total: patientCount,
      },
      {
        role: "doctor",
        label: "Doctors",
        percentage: doctorPercentage,
        total: doctorCount,
      },
      {
        role: "admin",
        label: "Admins",
        percentage: adminPercentage,
        total: adminCount,
      },
    ],
  };
};

const getSystemLogs = async (filters = {}) => {
  const { type, severity, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  const where = {};
  if (type) where.category = type;
  if (severity) where.severity = severity;

  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
    }),
    prisma.systemLog.count({ where }),
  ]);

  return {
    data: logs,
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const generateReport = async (startDate, endDate, reportType, format) => {
  // Mock report generation
  return {
    message: "Report generated successfully",
    reportId: `RPT-${Date.now()}`,
    startDate,
    endDate,
    reportType,
    format,
    generatedAt: new Date().toISOString(),
  };
};




// 1. Fungsi getReportStatistics (Disesuaikan dengan Schema terbaru)
const getReportStatistics = async (startDate, endDate) => {
  // Siapkan filter tanggal jika user mengirimkan startDate dan endDate
  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter = {
      createdAt: {
        gte: new Date(startDate), 
        lte: new Date(endDate + 'T23:59:59.999Z') 
      }
    };
  }

  // Kita gunakan Promise.all agar semua query jalan paralel & lebih cepat
  const [
    totalNewPatients,
    totalScans,
    highRiskCases,
    lowRiskCases,
    completedConsultations,
    confidenceAgg
  ] = await Promise.all([
    // A. Hitung Pasien Baru Terdaftar (Berdasarkan Enum Role: 'patient')
    prisma.user.count({
      where: { role: 'patient', ...dateFilter }
    }),
    
    // B. Hitung Total Deteksi (Scans)
    prisma.detection.count({
      where: dateFilter
    }),

    // C. Hitung Kasus Risiko Tinggi (Sesuai komentar schema: result "Melanoma")
    prisma.detection.count({
      where: { 
        // Ubah string ini jika AI kamu mengembalikan nilai yang berbeda (misal: "Malignant")
        result: { contains: 'Melanoma', mode: 'insensitive' }, 
        ...dateFilter 
      } 
    }),

    // D. Hitung Kasus Risiko Rendah (Sesuai komentar schema: result "Benign")
    prisma.detection.count({
      where: { 
        result: { contains: 'Benign', mode: 'insensitive' }, 
        ...dateFilter 
      }
    }),

    // E. Hitung Konsultasi Selesai (Berdasarkan Enum ConsultationStatus: 'CLOSED')
    prisma.consultation.count({
      where: { status: 'CLOSED', ...dateFilter }
    }),

    // F. Hitung Rata-rata Confidence (Akurasi AI)
    prisma.detection.aggregate({
      _avg: { confidence: true },
      where: dateFilter
    })
  ]);

  return {
    totalNewPatients,
    totalScans,
    highRiskCases,
    lowRiskCases,
    completedConsultations,
    avgConfidence: confidenceAgg._avg.confidence ? Math.round(confidenceAgg._avg.confidence) : 0
  };
};

// 2. Fungsi exportReport (Tetap menggunakan format yang rapi)
const exportReport = async (startDate, endDate, reportType, format) => {
  const stats = await getReportStatistics(startDate, endDate);

  // Jika format yang diminta adalah PDF
  if (format === 'pdf') {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      let buffers = [];

      const fileName = `MySkin_Report_${Date.now()}.pdf`;
      const uploadPath = path.join(__dirname, '../../uploads', fileName);

      // Buat folder jika belum ada
      const dir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // Simpan ke lokal dan ke buffer
      const fileStream = fs.createWriteStream(uploadPath);
      doc.pipe(fileStream);

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const buffer = Buffer.concat(buffers);
        // Kembalikan objek yang berisi data lengkap
        resolve({ buffer, fileName, contentType: 'application/pdf' });
      });
      doc.on('error', (err) => reject(err));

      // --- DESAIN PDF ---
      doc.rect(0, 0, 612, 100).fill('#1e3a8a');
      doc.fillColor('white').fontSize(22).text('MY SKIN - ANALYTICS REPORT', 50, 40);
      doc.fontSize(10).text('Skin Cancer Detection & Consultation System', 50, 70);

      doc.fillColor('black').moveDown(4);
      doc.fontSize(12).font('Helvetica-Bold').text(`Informasi Laporan:`);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Tipe Laporan  : ${reportType ? reportType.toUpperCase() : 'SUMMARY'}`);
      doc.text(`Periode Data  : ${startDate || 'Awal'} s/d ${endDate || 'Hari Ini'}`);
      doc.text(`Tanggal Cetak : ${new Date().toLocaleString('id-ID')}`);
      doc.moveDown(2);

      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e3a8a').text('SUMMARY STATISTICS');
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
      doc.moveDown(1);

      const drawRow = (label, value, isLast = false) => {
        const currentY = doc.y;
        doc.fillColor('#374151').font('Helvetica').fontSize(11).text(label, 60, currentY);
        doc.font('Helvetica-Bold').text(value, 400, currentY, { align: 'right', width: 140 });
        doc.moveDown(0.8);
        if (!isLast) {
          doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).stroke('#f3f4f6');
          doc.moveDown(0.8);
        }
      };

      drawRow('Total Pasien Baru', `${stats.totalNewPatients} Orang`);
      drawRow('Total Scan Dilakukan', `${stats.totalScans} Kali`);
      drawRow('Kasus Berisiko (Melanoma)', `${stats.highRiskCases} Kasus`);
      drawRow('Kasus Jinak (Benign)', `${stats.lowRiskCases} Kasus`);
      drawRow('Konsultasi Medis Selesai', `${stats.completedConsultations} Sesi`);
      drawRow('Rata-rata Akurasi AI', `${stats.avgConfidence}%`, true);

      const bottom = doc.page.height - 70;
      doc.moveTo(50, bottom).lineTo(545, bottom).stroke('#e5e7eb');
      doc.fontSize(9).fillColor('gray').text('Laporan ini dihasilkan secara otomatis oleh MySkin System.', 50, bottom + 15, { align: 'center' });

      doc.end();
    });
  } 
  
  // Jika formatnya txt ATAU tidak diisi (Default)
  else {
    const fileName = `MySkin_Report_${Date.now()}.txt`;
    const content = `=========================================
MY SKIN - MELANOMA DETECTION REPORT
=========================================
Report Type : ${reportType ? reportType.toUpperCase() : 'ALL'}
Period      : ${startDate || 'Semua Waktu'} to ${endDate || 'Semua Waktu'}
Generated At: ${new Date().toLocaleString('id-ID')}
-----------------------------------------
SUMMARY STATISTICS:
- Pasien Baru Terdaftar         : ${stats.totalNewPatients} Pasien
- Total Deteksi AI Dilakukan    : ${stats.totalScans} Scan
- Hasil Risiko Tinggi (Melanoma): ${stats.highRiskCases} Kasus
- Hasil Risiko Rendah (Jinak)   : ${stats.lowRiskCases} Kasus
- Konsultasi Medis Selesai      : ${stats.completedConsultations} Sesi
- Rata-rata Akurasi/Confidence  : ${stats.avgConfidence}%
-----------------------------------------
*Dokumen ini digenerate secara otomatis oleh sistem MySkin.*`;

    // Kembalikan objek yang persis sama strukturnya dengan PDF
    return {
      buffer: Buffer.from(content, 'utf-8'),
      fileName: fileName,
      contentType: 'text/plain'
    };
  }
};
// ==================== USER MANAGEMENT ENDPOINTS ====================

const getAllUsers = async (filters = {}) => {
  const {
    search = "",
    role = "all",
    status = "active",
    page = 1,
    limit = 8,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  // Search filter
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  // Role filter
  if (role !== "all") {
    where.role = role;
  }

  // Status filter
  if (status) {
    where.status = status;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        status: true,
        gender: true,
        phone: true,
        birthDate: true,
        avatarUrl: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users.map((user) => ({
      userId: user.id,
      fullName: user.name,
      role: user.role,
      email: user.email,
      status: user.status,
      gender: user.gender,
      phoneNumber: user.phone,
      birthDate: user.birthDate,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    })),
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      status: true,
      gender: true,
      phone: true,
      birthDate: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    userId: user.id,
    fullName: user.name,
    role: user.role,
    email: user.email,
    status: user.status,
    gender: user.gender,
    phoneNumber: user.phone,
    birthDate: user.birthDate,
    avatarUrl: user.avatarUrl,
    joinedAt: user.createdAt,
  };
};

const createUser = async (userData) => {
  // Check if email exists
  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email },
  });

  if (existingUser) {
    const error = new Error("Email already exists");
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const user = await prisma.user.create({
    data: {
      name: userData.fullName,
      email: userData.email,
      password: hashedPassword,
      role: userData.role,
      gender: userData.gender.toLowerCase(),
      phone: userData.phoneNumber,
      birthDate: userData.birthDate ? new Date(userData.birthDate) : null,
      status: "pending",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  return {
    message: "User created successfully",
    data: {
      userId: user.id,
      fullName: user.name,
      role: user.role,
      email: user.email,
      status: user.status,
    },
  };
};

const updateUser = async (userId, updateData) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  // Check email uniqueness if updating email
  if (updateData.email && updateData.email !== user.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: updateData.email },
    });
    if (existingEmail) {
      const error = new Error("Email already exists");
      error.status = 409;
      throw error;
    }
  }

  const updatePayload = {};
  if (updateData.fullName) updatePayload.name = updateData.fullName;
  if (updateData.email) updatePayload.email = updateData.email;
  if (updateData.role) updatePayload.role = updateData.role;
  if (updateData.gender) updatePayload.gender = updateData.gender.toLowerCase();
  if (updateData.phoneNumber) updatePayload.phone = updateData.phoneNumber;
  if (updateData.birthDate) updatePayload.birthDate = new Date(updateData.birthDate);

  await prisma.user.update({
    where: { id: userId },
    data: updatePayload,
  });

  return {
    message: "User updated successfully",
  };
};

const updateUserStatus = async (userId, status) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  return {
    message: "User status updated successfully",
  };
};

const changeUserRole = async (userId, newRole) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  return {
    message: "User role changed successfully",
  };
};

const deleteUser = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  // Soft delete
  await prisma.user.update({
    where: { id: userId },
    data: { status: "inactive" },
  });

  return {
    message: "User deleted successfully",
  };
};

const resetUserPassword = async (userId, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return {
    message: "Password reset successfully",
  };
};

// ==================== DOCTOR MANAGEMENT ENDPOINTS ====================

const getDoctorsSummary = async () => {
  // Tentukan batasan waktu untuk menghitung pertumbuhan
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    totalDoctors,
    pendingApprovals,
    totalPatients,
    doctorsLast30Days,
    doctorsPrevious30Days
  ] = await Promise.all([
    // Hitung total semua dokter
    prisma.user.count({ where: { role: "doctor" } }),
    
    // Hitung profil dokter yang masih "pending"
    prisma.doctorProfile.count({
      where: { verificationStatus: "pending" },
    }),
    
    // Hitung total pasien
    prisma.user.count({ where: { role: "patient" } }),

    // Hitung dokter yang mendaftar 30 hari terakhir (Bulan Ini)
    prisma.user.count({
      where: {
        role: "doctor",
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    }),

    // Hitung dokter yang mendaftar antara 60 hingga 30 hari lalu (Bulan Lalu)
    prisma.user.count({
      where: {
        role: "doctor",
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      },
    }),
  ]);

  // Kalkulasi persentase pertumbuhan (Growth)
  let totalCliniciansGrowth = 0;
  if (doctorsPrevious30Days > 0) {
    // Rumus: ((Bulan Ini - Bulan Lalu) / Bulan Lalu) * 100
    totalCliniciansGrowth = ((doctorsLast30Days - doctorsPrevious30Days) / doctorsPrevious30Days) * 100;
  } else if (doctorsLast30Days > 0) {
    // Jika bulan lalu 0 tapi bulan ini ada pendaftar, anggap pertumbuhan 100%
    totalCliniciansGrowth = 100; 
  }

  // Format angka ke 1 angka di belakang koma (opsional, agar rapi di UI)
  totalCliniciansGrowth = Number(totalCliniciansGrowth.toFixed(1));

  // Kalkulasi rata-rata pasien per dokter
  const patientThroughput = totalDoctors > 0 ? Math.floor(totalPatients / totalDoctors) : 0;

  return {
    totalClinicians: totalDoctors,
    totalCliniciansGrowth: totalCliniciansGrowth,
    pendingApprovals,
    patientThroughput,
    patientThroughputLabel: "Avg / Mo", // Label bisa dikembalikan seperti aslinya
  };
};

const getAllDoctors = async (filters = {}) => {
  const {
    search = "",
    status = "verified",
    page = 1,
    limit = 8,
  } = filters;

  const skip = (page - 1) * limit;
  const where = {
    verificationStatus: status,
  };

  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [doctors, total] = await Promise.all([
    prisma.doctorProfile.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { joinedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        caseReviews: {
          select: { id: true },
        },
      },
    }),
    prisma.doctorProfile.count({ where }),
  ]);

  return {
    data: doctors.map((doctor) => ({
      doctorId: doctor.doctorId,
      fullName: doctor.user.name,
      email: doctor.user.email,
      registrationDate: doctor.joinedAt,
      patientLoad: doctor.caseReviews.length,
      status: doctor.verificationStatus,
      avatarUrl: doctor.user.avatarUrl,
    })),
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    },
  };
};

const getDoctorById = async (doctorId) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { doctorId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          gender: true,
          phone: true,
          avatarUrl: true,
        },
      },
      caseReviews: {
        select: { id: true },
      },
    },
  });

  if (!doctor) {
    const error = new Error("Doctor not found");
    error.status = 404;
    throw error;
  }

  return {
    doctorId: doctor.doctorId,
    fullName: doctor.user.name,
    email: doctor.user.email,
    gender: doctor.user.gender,
    phoneNumber: doctor.user.phone,
    specialization: doctor.specialization,
    registrationDate: doctor.joinedAt,
    status: doctor.verificationStatus,
    patientLoad: doctor.caseReviews.length,
    avatarUrl: doctor.user.avatarUrl,
  };
};

const getDoctorVerificationRequests = async (doctorId) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { doctorId },
    include: { user: true },
  });

  if (!doctor) {
    const error = new Error("Doctor not found");
    error.status = 404;
    throw error;
  }

  const caseReviews = await prisma.caseReview.findMany({
    where: { doctorId: doctor.id },
    include: {
      observations: {
        select: { id: true, observation: true },
      },
    },
  });

  return {
    doctor: {
      doctorId: doctor.doctorId,
      fullName: doctor.user.name,
    },
    data: caseReviews.map((caseReview) => ({
      requestId: caseReview.caseId,
      patientName: caseReview.patientName,
      patientId: caseReview.patientId,
      date: caseReview.receivedAt,
      aiDiagnosis: `${caseReview.aiConfidencePercentage}% ${caseReview.aiPredictionLabel}`,
      caseId: caseReview.caseId,
    })),
  };
};

const approveDoctorRequest = async (doctorId, note) => {
  const doctor = await prisma.doctorProfile.findUnique({ where: { doctorId } });

  if (!doctor) {
    const error = new Error("Doctor not found");
    error.status = 404;
    throw error;
  }

  await prisma.doctorProfile.update({
    where: { doctorId },
    data: { verificationStatus: "verified" },
  });

  return {
    message: "Doctor approval request accepted",
  };
};

const rejectDoctorRequest = async (doctorId, reason) => {
  const doctor = await prisma.doctorProfile.findUnique({ where: { doctorId } });

  if (!doctor) {
    const error = new Error("Doctor not found");
    error.status = 404;
    throw error;
  }

  await prisma.doctorProfile.update({
    where: { doctorId },
    data: { verificationStatus: "rejected" },
  });

  return {
    message: "Doctor approval request rejected",
  };
};

// ==================== PROFILE ENDPOINTS ====================

const getAdminProfile = async (adminId) => {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      name: true,
      email: true,
      gender: true,
      role: true,
      phone: true,
      birthDate: true,
      createdAt: true,
      avatarUrl: true,
    },
  });

  if (!admin) {
    const error = new Error("Admin not found");
    error.status = 404;
    throw error;
  }

  return {
    adminId: admin.id,
    fullName: admin.name,
    email: admin.email,
    gender: admin.gender,
    role: admin.role,
    phoneNumber: admin.phone,
    birthDate: admin.birthDate,
    joinedAt: admin.createdAt,
    profileImageUrl: admin.avatarUrl,
    administratorStatus: {
      status: "verified",
      label: "Verified Administrator",
      description:
        "Your administrator access for the MySkin platform has been verified to manage and oversee Melanoma AI analysis.",
    },
  };
};

const updateAdminProfile = async (adminId, updateData) => {
  const admin = await prisma.user.findUnique({ where: { id: adminId } });

  if (!admin) {
    const error = new Error("Admin not found");
    error.status = 404;
    throw error;
  }

  const updatePayload = {};
  if (updateData.fullName) updatePayload.name = updateData.fullName;
  if (updateData.phoneNumber) updatePayload.phone = updateData.phoneNumber;
  if (updateData.gender) updatePayload.gender = updateData.gender.toLowerCase();
  if (updateData.birthDate) updatePayload.birthDate = new Date(updateData.birthDate);

  await prisma.user.update({
    where: { id: adminId },
    data: updatePayload,
  });

  return {
    message: "Admin profile updated successfully",
  };
};

const updateAdminPhoto = async (adminId, photoUrl) => {
  const admin = await prisma.user.findUnique({ where: { id: adminId } });

  if (!admin) {
    const error = new Error("Admin not found");
    error.status = 404;
    throw error;
  }

  await prisma.user.update({
    where: { id: adminId },
    data: { avatarUrl: photoUrl },
  });

  return {
    message: "Admin photo updated successfully",
  };
};

const getVerificationStatus = async () => {
  return {
    status: "verified",
    label: "Verified Administrator",
    description:
      "Your administrator access for the MySkin platform has been verified to manage and oversee Melanoma AI analysis.",
  };
};

// ==================== SETTINGS ENDPOINTS ====================

const getAdminSettings = async (adminId) => {
  let settings = await prisma.adminSettings.findUnique({
    where: { adminId },
  });

  if (!settings) {
    // Create default settings
    settings = await prisma.adminSettings.create({
      data: {
        adminId,
        twoFactorEnabled: false,
        emailNotifications: true,
        verificationAlerts: false,
        dataVisibility: "restricted_clinical_team_only",
        language: "English (US)",
      },
    });
  }

  return {
    account: {
      email: (await prisma.user.findUnique({ where: { id: adminId }, select: { email: true } })).email,
      twoFactorEnabled: settings.twoFactorEnabled,
    },
    notifications: {
      emailNotifications: settings.emailNotifications,
      verificationAlerts: settings.verificationAlerts,
    },
    privacy: {
      dataVisibility: settings.dataVisibility,
    },
    preferences: {
      language: settings.language,
    },
  };
};

const updateAdminSettingsAccount = async (adminId, email, currentPassword, newPassword) => {
  const admin = await prisma.user.findUnique({ where: { id: adminId } });

  if (!admin) {
    const error = new Error("Admin not found");
    error.status = 404;
    throw error;
  }

  if (email) {
    // Check if email exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail && existingEmail.id !== adminId) {
      const error = new Error("Email already exists");
      error.status = 409;
      throw error;
    }

    await prisma.user.update({
      where: { id: adminId },
      data: { email },
    });
  }

  if (newPassword) {
    const passwordMatch = await bcrypt.compare(currentPassword, admin.password);

    if (!passwordMatch) {
      const error = new Error("Current password is incorrect");
      error.status = 400;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });
  }

  return {
    message: "Account settings updated successfully",
  };
};

const updateAdminSettings2FA = async (adminId, enabled) => {
  let settings = await prisma.adminSettings.findUnique({
    where: { adminId },
  });

  if (!settings) {
    settings = await prisma.adminSettings.create({
      data: {
        adminId,
        twoFactorEnabled: enabled,
      },
    });
  } else {
    await prisma.adminSettings.update({
      where: { adminId },
      data: { twoFactorEnabled: enabled },
    });
  }

  return {
    message: "2FA settings updated successfully",
  };
};

const updateAdminSettingsNotifications = async (adminId, emailNotifications, verificationAlerts) => {
  let settings = await prisma.adminSettings.findUnique({
    where: { adminId },
  });

  if (!settings) {
    settings = await prisma.adminSettings.create({
      data: {
        adminId,
        emailNotifications,
        verificationAlerts,
      },
    });
  } else {
    await prisma.adminSettings.update({
      where: { adminId },
      data: {
        emailNotifications,
        verificationAlerts,
      },
    });
  }

  return {
    message: "Notification settings updated successfully",
  };
};

const updateAdminSettingsPrivacy = async (adminId, dataVisibility) => {
  let settings = await prisma.adminSettings.findUnique({
    where: { adminId },
  });

  if (!settings) {
    settings = await prisma.adminSettings.create({
      data: {
        adminId,
        dataVisibility,
      },
    });
  } else {
    await prisma.adminSettings.update({
      where: { adminId },
      data: { dataVisibility },
    });
  }

  return {
    message: "Privacy settings updated successfully",
  };
};

const updateAdminSettingsPreferences = async (adminId, language) => {
  let settings = await prisma.adminSettings.findUnique({
    where: { adminId },
  });

  if (!settings) {
    settings = await prisma.adminSettings.create({
      data: {
        adminId,
        language,
      },
    });
  } else {
    await prisma.adminSettings.update({
      where: { adminId },
      data: { language },
    });
  }

  return {
    message: "Preferences updated successfully",
  };
};

// ==================== NOTIFICATION ENDPOINTS ====================

const getAdminNotifications = async (adminId) => {
  const notifications = await prisma.adminNotification.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    unreadCount,
    data: notifications.map((n) => ({
      notificationId: n.notificationId,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
  };
};

const markNotificationAsRead = async (notificationId) => {
  const notification = await prisma.adminNotification.findUnique({
    where: { notificationId },
  });

  if (!notification) {
    const error = new Error("Notification not found");
    error.status = 404;
    throw error;
  }

  await prisma.adminNotification.update({
    where: { notificationId },
    data: { isRead: true },
  });

  return {
    message: "Notification marked as read",
  };
};

const markAllNotificationsAsRead = async (adminId) => {
  await prisma.adminNotification.updateMany({
    where: { adminId },
    data: { isRead: true },
  });

  return {
    message: "All notifications marked as read",
  };
};

// ==================== AUDIT LOG ENDPOINTS ====================

const getAuditLogs = async (filters = {}) => {
  const {
    adminId,
    action,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  if (adminId) where.adminId = adminId;
  if (action) where.action = action;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs.map((log) => ({
      auditId: log.auditId,
      adminId: log.adminId,
      adminName: log.adminName,
      action: log.action,
      description: log.description,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    })),
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    },
  };
};

const createAuditLog = async (adminId, adminName, action, description, additionalData = {}) => {
  return await prisma.auditLog.create({
    data: {
      auditId: `AUD-${Date.now()}`, 
      adminId: adminId,
      adminName: adminName || "System Admin", 
      action: action,
      description: description,
      ipAddress: additionalData.ipAddress || "::1",
      userAgent: additionalData.userAgent || "Internal System",
      status: additionalData.status || "success",
      targetUserId: additionalData.targetUserId || null,
      targetResourceType: additionalData.targetResourceType || null,
      targetResourceId: additionalData.targetResourceId || null,
    },
  });
};


module.exports = {
  // Dashboard
  getDashboardSummary,
  getUserGrowthData,
  getRoleDistribution,
  getSystemLogs,
  generateReport,
  exportReport,

  // User Management
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  changeUserRole,
  deleteUser,
  resetUserPassword,

  // Doctor Management
  getDoctorsSummary,
  getAllDoctors,
  getDoctorById,
  getDoctorVerificationRequests,
  approveDoctorRequest,
  rejectDoctorRequest,

  // Profile
  getAdminProfile,
  updateAdminProfile,
  updateAdminPhoto,
  getVerificationStatus,

  // Settings
  getAdminSettings,
  updateAdminSettingsAccount,
  updateAdminSettings2FA,
  updateAdminSettingsNotifications,
  updateAdminSettingsPrivacy,
  updateAdminSettingsPreferences,

  // Notifications
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,

  // Audit Logs
  getAuditLogs,
  createAuditLog,
};
