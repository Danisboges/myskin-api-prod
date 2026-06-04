const prisma = require("../config/prisma");
const fs = require('fs');
const path = require('path');
const crypto = require("crypto");
const PDFDocument = require('pdfkit');
const {
  validateAndNormalizeEmail,
  ensureEmailAvailable,
} = require("../utils/email.util");
const {
  createAdminNotificationForEnabledAdmins,
} = require("./admin-notification.service");
const { formatDateForAdmin } = require("../utils/admin-date.util");
const {
  hashPassword,
  verifyPassword,
  assertStrongPassword,
} = require("../utils/password.util");

const formatDate = (date) => {
  if (!date) return null;
  return date.toISOString().split("T")[0];
};

const formatDateTime = (date) => {
  if (!date) return null;
  return date.toISOString();
};

const formatUserForAdmin = (user) => ({
  userId: user.id,
  fullName: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  gender: user.gender,
  phoneNumber: user.phone,
  birthDate: formatDate(user.birthDate),
  avatarUrl: user.avatarUrl,
  clinicId: user.doctorProfile?.clinicId || null,
  specialization: user.doctorProfile?.specialization || null,
  licenseNumber: user.doctorProfile?.practitionerLicense || null,
  licenseFile: user.doctorProfile?.licenseFile || null,
});

const formatDoctorForAdmin = (doctor) => ({
  doctorId: doctor.id,
  userId: doctor.userId,
  fullName: doctor.user.name,
  email: doctor.user.email,
  role: doctor.user.role,
  userStatus: doctor.user.status,
  gender: doctor.user.gender,
  phoneNumber: doctor.user.phone,
  birthDate: formatDate(doctor.user.birthDate),
  avatarUrl: doctor.user.avatarUrl,
  clinicId: doctor.clinicId,
  clinicName: doctor.clinic?.name || null,
  clinic: doctor.clinic ? {
    clinicId: doctor.clinic.clinicId,
    name: doctor.clinic.name,
  } : null,
  licenseNumber: doctor.practitionerLicense,
  licenseFile: doctor.licenseFile,
  specialization: doctor.specialization,
  registrationDate: formatDateTime(doctor.joinedAt),
  joinedAt: formatDateTime(doctor.joinedAt),
  status: doctor.verificationStatus,
  patientLoad: doctor.caseReviews?.length || 0,
});

const findDoctorProfileById = async (doctorId, include = {}) => {
  const doctor = await prisma.doctorProfile.findFirst({
    where: {
      OR: [
        { id: doctorId },
        { userId: doctorId },
        { clinicId: doctorId },
      ],
    },
    include,
  });

  if (!doctor) {
    const error = new Error("Doctor not found");
    error.status = 404;
    throw error;
  }

  return doctor;
};


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
      totalScans
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

      // 3. Rata-rata Akurasi Deteksi (dari Scan, bukan Detection)
      prisma.scan.aggregate({
        _avg: { aiConfidence: true },
      }),

      // 4. Hitung jumlah scan untuk estimasi storage lokal
      prisma.scan.count()
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
    const estimatedMB = totalScans * 0.5; // Asumsi 1 gambar = 500KB
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
      averageDetectionAccuracy: accuracyData._avg.aiConfidence 
        ? parseFloat((accuracyData._avg.aiConfidence * 100).toFixed(1)) 
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
      totalPages: Math.max(1, Math.ceil(total / limit)),
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




const REPORT_PAGE_BOTTOM = 760;

const percent = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

const toPercent = (value) => {
  if (value === null || value === undefined) return 0;
  return value > 1 ? Math.round(value) : Math.round(value * 100);
};

const ensurePdfSpace = (doc, requiredSpace = 80) => {
  if (doc.y + requiredSpace > REPORT_PAGE_BOTTOM) {
    doc.addPage();
  }
};

const drawSectionTitle = (doc, title) => {
  ensurePdfSpace(doc, 70);
  doc.moveDown(1.3);
  doc.fontSize(15).font('Helvetica-Bold').fillColor('#1e3a8a').text(title);
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.8).stroke('#d1d5db');
  doc.moveDown(0.7);
};

const drawRow = (doc, label, value, options = {}) => {
  ensurePdfSpace(doc, 34);
  const currentY = doc.y;
  doc.fillColor('#374151').font('Helvetica').fontSize(options.fontSize || 10.5)
    .text(label, 60, currentY, { width: 330 });
  doc.font('Helvetica-Bold').fillColor(options.color || '#111827')
    .text(String(value), 390, currentY, { align: 'right', width: 140 });
  doc.moveDown(0.75);
  if (!options.last) {
    doc.moveTo(55, doc.y).lineTo(540, doc.y).lineWidth(0.4).stroke('#eef2f7');
    doc.moveDown(0.55);
  }
};

const drawTextBlock = (doc, text) => {
  ensurePdfSpace(doc, 60);
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
    .text(text, 60, doc.y, { width: 470, lineGap: 3 });
  doc.moveDown(0.7);
};

const drawTable = (doc, columns, rows, emptyText = 'Tidak ada data pada periode ini.') => {
  if (!rows.length) {
    drawTextBlock(doc, emptyText);
    return;
  }

  ensurePdfSpace(doc, 55);
  const startX = 55;
  const widths = columns.map((column) => column.width);
  const headerY = doc.y;

  doc.rect(startX, headerY, widths.reduce((sum, width) => sum + width, 0), 22).fill('#f3f4f6');
  let x = startX;
  columns.forEach((column, index) => {
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8.5)
      .text(column.label, x + 5, headerY + 7, {
        width: widths[index] - 10,
        align: column.align || 'left',
      });
    x += widths[index];
  });
  doc.y = headerY + 30;

  rows.forEach((row) => {
    ensurePdfSpace(doc, 32);
    const y = doc.y;
    x = startX;
    columns.forEach((column, index) => {
      doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
        .text(row[column.key] ?? '-', x + 5, y, {
          width: widths[index] - 10,
          align: column.align || 'left',
        });
      x += widths[index];
    });
    doc.moveDown(0.95);
    doc.moveTo(startX, doc.y).lineTo(startX + widths.reduce((sum, width) => sum + width, 0), doc.y)
      .lineWidth(0.35).stroke('#eef2f7');
    doc.moveDown(0.35);
  });
};

const buildReportInsights = (stats) => {
  const insights = [];

  if (stats.totalScans === 0) {
    insights.push('Belum ada scan pada periode ini, sehingga tren risiko dan performa AI belum dapat disimpulkan.');
  } else {
    insights.push(`${stats.highRiskCases} dari ${stats.totalScans} scan (${stats.highRiskRate}%) terindikasi risiko melanoma dan perlu prioritas monitoring klinis.`);
  }

  if (stats.pendingConsultations > 0) {
    insights.push(`${stats.pendingConsultations} konsultasi masih terbuka dan perlu dipantau agar pasien mendapat tindak lanjut tepat waktu.`);
  } else {
    insights.push('Tidak ada konsultasi terbuka pada periode ini.');
  }

  if (stats.avgConfidence > 0) {
    insights.push(`Rata-rata confidence AI berada di ${stats.avgConfidence}%, dengan confidence terendah ${stats.minConfidence}% dan tertinggi ${stats.maxConfidence}%.`);
  }

  if (stats.pendingDoctorApprovals > 0) {
    insights.push(`${stats.pendingDoctorApprovals} dokter masih menunggu approval admin.`);
  }

  return insights;
};

const normalizeDateFilter = (startDate, endDate, field = 'createdAt') => {
  if (!startDate && !endDate) return {};

  const range = {};
  if (startDate) range.gte = new Date(startDate);
  if (endDate) range.lte = new Date(`${endDate}T23:59:59.999Z`);

  return { [field]: range };
};

// 1. Fungsi getReportStatistics (Disesuaikan dengan Schema terbaru)
const getReportStatistics = async (startDate, endDate) => {
  const dateFilter = normalizeDateFilter(startDate, endDate);

  const [
    totalNewPatients,
    totalNewDoctors,
    totalAdmins,
    activeUsers,
    inactiveUsers,
    pendingUsers,
    suspendedUsers,
    verifiedDoctors,
    pendingDoctorApprovals,
    totalClinics,
    activeClinics,
    totalScans,
    analyzedScans,
    sharedScans,
    highRiskCases,
    lowRiskCases,
    openConsultations,
    completedConsultations,
    totalReports,
    approvedReports,
    confidenceAgg,
    scansByBodySite,
    scansByPrediction,
    consultationsByDoctor,
    recentScans,
    recentConsultations,
    clinicDoctorCounts,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'patient', ...dateFilter } }),
    prisma.user.count({ where: { role: 'doctor', ...dateFilter } }),
    prisma.user.count({ where: { role: 'admin', ...dateFilter } }),
    prisma.user.count({ where: { status: 'active', ...dateFilter } }),
    prisma.user.count({ where: { status: 'inactive', ...dateFilter } }),
    prisma.user.count({ where: { status: 'pending', ...dateFilter } }),
    prisma.user.count({ where: { status: 'suspended', ...dateFilter } }),
    prisma.doctorProfile.count({ where: { verificationStatus: 'verified', ...dateFilter } }),
    prisma.doctorProfile.count({ where: { verificationStatus: 'pending', ...dateFilter } }),
    prisma.clinic.count({ where: dateFilter }),
    prisma.clinic.count({ where: { isActive: true, ...dateFilter } }),
    prisma.scan.count({ where: dateFilter }),
    prisma.scan.count({ where: { isAnalyzed: true, ...dateFilter } }),
    prisma.scan.count({ where: { isSharedWithDoctor: true, ...dateFilter } }),
    prisma.scan.count({ where: { aiPrediction: { contains: 'Melanoma', mode: 'insensitive' }, ...dateFilter } }),
    prisma.scan.count({ where: { aiPrediction: { contains: 'Benign', mode: 'insensitive' }, ...dateFilter } }),
    prisma.consultation.count({ where: { status: 'OPEN', ...dateFilter } }),
    prisma.consultation.count({ where: { status: 'CLOSED', ...dateFilter } }),
    prisma.report.count({ where: dateFilter }),
    prisma.report.count({ where: { status: 'approved', ...dateFilter } }),
    prisma.scan.aggregate({
      _avg: { aiConfidence: true },
      _min: { aiConfidence: true },
      _max: { aiConfidence: true },
      where: dateFilter,
    }),
    prisma.scan.groupBy({
      by: ['bodySite'],
      where: dateFilter,
      _count: { _all: true },
    }),
    prisma.scan.groupBy({
      by: ['aiPrediction'],
      where: dateFilter,
      _count: { _all: true },
    }),
    prisma.consultation.groupBy({
      by: ['doctorId'],
      where: dateFilter,
      _count: { _all: true },
    }),
    prisma.scan.findMany({
      where: dateFilter,
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        scanId: true,
        bodySite: true,
        aiPrediction: true,
        aiConfidence: true,
        isAnalyzed: true,
        createdAt: true,
        patient: {
          select: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.consultation.findMany({
      where: dateFilter,
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        status: true,
        createdAt: true,
        patient: { select: { name: true, email: true } },
        doctor: { select: { name: true, email: true } },
        scan: { select: { scanId: true, aiPrediction: true } },
      },
    }),
    prisma.clinic.findMany({
      where: dateFilter,
      orderBy: { name: 'asc' },
      take: 10,
      select: {
        clinicId: true,
        name: true,
        isActive: true,
        doctors: { select: { id: true } },
      },
    }),
  ]);

  const doctorNames = await prisma.user.findMany({
    where: {
      id: { in: consultationsByDoctor.map((item) => item.doctorId).filter(Boolean) },
    },
    select: { id: true, name: true },
  });
  const doctorNameMap = new Map(doctorNames.map((doctor) => [doctor.id, doctor.name]));

  const totalUsers = totalNewPatients + totalNewDoctors + totalAdmins;
  const totalConsultations = openConsultations + completedConsultations;
  const highRiskRate = percent(highRiskCases, totalScans);
  const analyzedRate = percent(analyzedScans, totalScans);
  const completionRate = percent(completedConsultations, totalConsultations);

  const stats = {
    totalNewPatients,
    totalNewDoctors,
    totalAdmins,
    totalUsers,
    activeUsers,
    inactiveUsers,
    pendingUsers,
    suspendedUsers,
    verifiedDoctors,
    pendingDoctorApprovals,
    totalClinics,
    activeClinics,
    inactiveClinics: Math.max(0, totalClinics - activeClinics),
    totalScans,
    analyzedScans,
    sharedScans,
    highRiskCases,
    lowRiskCases,
    unclassifiedScans: Math.max(0, totalScans - highRiskCases - lowRiskCases),
    openConsultations,
    completedConsultations,
    totalConsultations,
    totalReports,
    approvedReports,
    draftReports: Math.max(0, totalReports - approvedReports),
    avgConfidence: toPercent(confidenceAgg._avg.aiConfidence),
    minConfidence: toPercent(confidenceAgg._min.aiConfidence),
    maxConfidence: toPercent(confidenceAgg._max.aiConfidence),
    highRiskRate,
    analyzedRate,
    completionRate,
    scansByBodySite: scansByBodySite
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 8)
      .map((item) => ({
      bodySite: item.bodySite || 'Unknown',
      total: item._count._all,
      percentage: percent(item._count._all, totalScans),
    })),
    scansByPrediction: scansByPrediction
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 8)
      .map((item) => ({
      prediction: item.aiPrediction || 'Unclassified',
      total: item._count._all,
      percentage: percent(item._count._all, totalScans),
    })),
    consultationsByDoctor: consultationsByDoctor
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 8)
      .map((item) => ({
      doctorId: item.doctorId,
      doctorName: doctorNameMap.get(item.doctorId) || 'Unknown Doctor',
      total: item._count._all,
      percentage: percent(item._count._all, totalConsultations),
    })),
    recentScans: recentScans.map((scan) => ({
      scanId: scan.scanId,
      patientName: scan.patient?.user?.name || 'Unknown Patient',
      patientEmail: scan.patient?.user?.email || '-',
      bodySite: scan.bodySite || '-',
      aiPrediction: scan.aiPrediction || 'Unclassified',
      aiConfidence: `${toPercent(scan.aiConfidence)}%`,
      isAnalyzed: scan.isAnalyzed ? 'Analyzed' : 'Pending',
      createdAt: formatDate(scan.createdAt),
    })),
    recentConsultations: recentConsultations.map((consultation) => ({
      consultationId: consultation.id,
      patientName: consultation.patient?.name || 'Unknown Patient',
      doctorName: consultation.doctor?.name || 'Unknown Doctor',
      scanId: consultation.scan?.scanId || '-',
      aiPrediction: consultation.scan?.aiPrediction || 'Unclassified',
      status: consultation.status,
      createdAt: formatDate(consultation.createdAt),
    })),
    clinicDoctorCounts: clinicDoctorCounts.map((clinic) => ({
      clinicId: clinic.clinicId,
      name: clinic.name,
      status: clinic.isActive ? 'Active' : 'Inactive',
      doctorCount: clinic.doctors.length,
    })),
  };

  stats.insights = buildReportInsights(stats);
  return {
    ...stats,
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
      doc.moveDown(1);

      drawSectionTitle(doc, 'EXECUTIVE SUMMARY');
      drawRow(doc, 'Total User Baru', `${stats.totalUsers} User`);
      drawRow(doc, 'Pasien Baru', `${stats.totalNewPatients} Orang`);
      drawRow(doc, 'Dokter Baru', `${stats.totalNewDoctors} Orang`);
      drawRow(doc, 'Total Klinik Baru', `${stats.totalClinics} Klinik`);
      drawRow(doc, 'Total Scan Dilakukan', `${stats.totalScans} Scan`);
      drawRow(doc, 'Scan Sudah Dianalisis', `${stats.analyzedScans} Scan (${stats.analyzedRate}%)`);
      drawRow(doc, 'Kasus Berisiko Melanoma', `${stats.highRiskCases} Kasus (${stats.highRiskRate}%)`, { color: '#b91c1c' });
      drawRow(doc, 'Konsultasi Selesai', `${stats.completedConsultations} dari ${stats.totalConsultations} Sesi (${stats.completionRate}%)`);
      drawRow(doc, 'Rata-rata Confidence AI', `${stats.avgConfidence}%`, { last: true });

      drawSectionTitle(doc, 'USER, DOCTOR, DAN CLINIC OVERVIEW');
      drawRow(doc, 'User Aktif', `${stats.activeUsers} User`);
      drawRow(doc, 'User Pending', `${stats.pendingUsers} User`);
      drawRow(doc, 'User Inactive', `${stats.inactiveUsers} User`);
      drawRow(doc, 'User Suspended', `${stats.suspendedUsers} User`);
      drawRow(doc, 'Dokter Terverifikasi', `${stats.verifiedDoctors} Dokter`);
      drawRow(doc, 'Dokter Menunggu Approval', `${stats.pendingDoctorApprovals} Dokter`);
      drawRow(doc, 'Klinik Aktif', `${stats.activeClinics} Klinik`);
      drawRow(doc, 'Klinik Nonaktif', `${stats.inactiveClinics} Klinik`, { last: true });

      drawTable(doc, [
        { key: 'name', label: 'Clinic', width: 260 },
        { key: 'status', label: 'Status', width: 90 },
        { key: 'doctorCount', label: 'Doctors', width: 90, align: 'right' },
      ], stats.clinicDoctorCounts);

      drawSectionTitle(doc, 'AI SCAN ANALYSIS');
      drawRow(doc, 'Total Scan', `${stats.totalScans} Scan`);
      drawRow(doc, 'Scan Dibagikan ke Dokter', `${stats.sharedScans} Scan`);
      drawRow(doc, 'Melanoma / High Risk', `${stats.highRiskCases} Kasus`);
      drawRow(doc, 'Benign / Low Risk', `${stats.lowRiskCases} Kasus`);
      drawRow(doc, 'Belum Terklasifikasi', `${stats.unclassifiedScans} Scan`);
      drawRow(doc, 'Confidence Terendah', `${stats.minConfidence}%`);
      drawRow(doc, 'Confidence Tertinggi', `${stats.maxConfidence}%`, { last: true });

      drawTable(doc, [
        { key: 'prediction', label: 'AI Prediction', width: 250 },
        { key: 'total', label: 'Total', width: 80, align: 'right' },
        { key: 'percentage', label: '%', width: 70, align: 'right' },
      ], stats.scansByPrediction.map((item) => ({ ...item, percentage: `${item.percentage}%` })));

      drawTable(doc, [
        { key: 'bodySite', label: 'Body Site', width: 250 },
        { key: 'total', label: 'Total', width: 80, align: 'right' },
        { key: 'percentage', label: '%', width: 70, align: 'right' },
      ], stats.scansByBodySite.map((item) => ({ ...item, percentage: `${item.percentage}%` })));

      drawSectionTitle(doc, 'CONSULTATION AND REPORT PERFORMANCE');
      drawRow(doc, 'Total Konsultasi', `${stats.totalConsultations} Sesi`);
      drawRow(doc, 'Konsultasi Terbuka', `${stats.openConsultations} Sesi`);
      drawRow(doc, 'Konsultasi Selesai', `${stats.completedConsultations} Sesi`);
      drawRow(doc, 'Completion Rate', `${stats.completionRate}%`);
      drawRow(doc, 'Total Report Klinis', `${stats.totalReports} Report`);
      drawRow(doc, 'Report Approved', `${stats.approvedReports} Report`);
      drawRow(doc, 'Report Draft', `${stats.draftReports} Report`, { last: true });

      drawTable(doc, [
        { key: 'doctorName', label: 'Doctor', width: 250 },
        { key: 'total', label: 'Consultations', width: 90, align: 'right' },
        { key: 'percentage', label: '%', width: 60, align: 'right' },
      ], stats.consultationsByDoctor.map((item) => ({ ...item, percentage: `${item.percentage}%` })));

      drawSectionTitle(doc, 'RECENT SCANS');
      drawTable(doc, [
        { key: 'createdAt', label: 'Date', width: 65 },
        { key: 'patientName', label: 'Patient', width: 120 },
        { key: 'bodySite', label: 'Body Site', width: 80 },
        { key: 'aiPrediction', label: 'Prediction', width: 115 },
        { key: 'aiConfidence', label: 'Conf.', width: 50, align: 'right' },
      ], stats.recentScans);

      drawSectionTitle(doc, 'RECENT CONSULTATIONS');
      drawTable(doc, [
        { key: 'createdAt', label: 'Date', width: 65 },
        { key: 'patientName', label: 'Patient', width: 115 },
        { key: 'doctorName', label: 'Doctor', width: 115 },
        { key: 'aiPrediction', label: 'AI Result', width: 105 },
        { key: 'status', label: 'Status', width: 60 },
      ], stats.recentConsultations);

      drawSectionTitle(doc, 'OPERATIONAL INSIGHTS');
      stats.insights.forEach((insight, index) => {
        drawTextBlock(doc, `${index + 1}. ${insight}`);
      });

      const bottom = doc.page.height - 70;
      doc.moveTo(50, bottom).lineTo(545, bottom).stroke('#e5e7eb');
      doc.fontSize(9).fillColor('gray').text('Laporan ini dihasilkan secara otomatis oleh MySkin System.', 50, bottom + 15, { align: 'center' });

      doc.end();
    });
  } 
  
  // Jika formatnya txt ATAU tidak diisi (Default)
  else {
    const fileName = `MySkin_Report_${Date.now()}.txt`;
    const formatRows = (items, formatter) => (
      items.length
        ? items.map((item, index) => `${index + 1}. ${formatter(item)}`).join('\n')
        : 'Tidak ada data pada periode ini.'
    );

    const content = `=========================================
MY SKIN - MELANOMA DETECTION REPORT
=========================================
Report Type : ${reportType ? reportType.toUpperCase() : 'ALL'}
Period      : ${startDate || 'Semua Waktu'} to ${endDate || 'Semua Waktu'}
Generated At: ${new Date().toLocaleString('id-ID')}
-----------------------------------------

EXECUTIVE SUMMARY
- Total User Baru               : ${stats.totalUsers} User
- Pasien Baru                   : ${stats.totalNewPatients} Pasien
- Dokter Baru                   : ${stats.totalNewDoctors} Dokter
- Klinik Baru                   : ${stats.totalClinics} Klinik
- Total Scan Dilakukan          : ${stats.totalScans} Scan
- Scan Sudah Dianalisis         : ${stats.analyzedScans} Scan (${stats.analyzedRate}%)
- Kasus Risiko Melanoma         : ${stats.highRiskCases} Kasus (${stats.highRiskRate}%)
- Kasus Benign                  : ${stats.lowRiskCases} Kasus
- Konsultasi Selesai            : ${stats.completedConsultations} dari ${stats.totalConsultations} Sesi (${stats.completionRate}%)
- Rata-rata Confidence AI       : ${stats.avgConfidence}%

USER, DOCTOR, AND CLINIC OVERVIEW
- User Aktif                    : ${stats.activeUsers}
- User Pending                  : ${stats.pendingUsers}
- User Inactive                 : ${stats.inactiveUsers}
- User Suspended                : ${stats.suspendedUsers}
- Dokter Terverifikasi          : ${stats.verifiedDoctors}
- Dokter Menunggu Approval      : ${stats.pendingDoctorApprovals}
- Klinik Aktif                  : ${stats.activeClinics}
- Klinik Nonaktif               : ${stats.inactiveClinics}

CLINIC DOCTOR DISTRIBUTION
${formatRows(stats.clinicDoctorCounts, (item) => `${item.name} (${item.status}) - ${item.doctorCount} dokter`)}

AI SCAN ANALYSIS
- Total Scan                    : ${stats.totalScans}
- Scan Dibagikan ke Dokter      : ${stats.sharedScans}
- Melanoma / High Risk          : ${stats.highRiskCases}
- Benign / Low Risk             : ${stats.lowRiskCases}
- Belum Terklasifikasi          : ${stats.unclassifiedScans}
- Confidence Terendah           : ${stats.minConfidence}%
- Confidence Tertinggi          : ${stats.maxConfidence}%

AI PREDICTION BREAKDOWN
${formatRows(stats.scansByPrediction, (item) => `${item.prediction}: ${item.total} scan (${item.percentage}%)`)}

BODY SITE BREAKDOWN
${formatRows(stats.scansByBodySite, (item) => `${item.bodySite}: ${item.total} scan (${item.percentage}%)`)}

CONSULTATION AND REPORT PERFORMANCE
- Total Konsultasi              : ${stats.totalConsultations}
- Konsultasi Terbuka            : ${stats.openConsultations}
- Konsultasi Selesai            : ${stats.completedConsultations}
- Completion Rate               : ${stats.completionRate}%
- Total Report Klinis           : ${stats.totalReports}
- Report Approved               : ${stats.approvedReports}
- Report Draft                  : ${stats.draftReports}

CONSULTATION BY DOCTOR
${formatRows(stats.consultationsByDoctor, (item) => `${item.doctorName}: ${item.total} konsultasi (${item.percentage}%)`)}

RECENT SCANS
${formatRows(stats.recentScans, (item) => `${item.createdAt} | ${item.patientName} | ${item.bodySite} | ${item.aiPrediction} | ${item.aiConfidence} | ${item.isAnalyzed}`)}

RECENT CONSULTATIONS
${formatRows(stats.recentConsultations, (item) => `${item.createdAt} | ${item.patientName} dengan ${item.doctorName} | Scan ${item.scanId} | ${item.aiPrediction} | ${item.status}`)}

OPERATIONAL INSIGHTS
${formatRows(stats.insights, (item) => item)}
-----------------------------------------
*Dokumen ini digenerate secara otomatis oleh sistem MySkin.*`;

    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const uploadPath = path.join(dir, fileName);
    fs.writeFileSync(uploadPath, content, 'utf-8');

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
    status = "all",
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
  if (status && status !== "all") {
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
        email: true,
        role: true,
        status: true,
        gender: true,
        phone: true,
        birthDate: true,
        avatarUrl: true,
        doctorProfile: {
          select: {
            clinicId: true,
            specialization: true,
            practitionerLicense: true,
            licenseFile: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users.map(formatUserForAdmin),
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
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
      doctorProfile: {
        select: {
          clinicId: true,
          specialization: true,
          practitionerLicense: true,
          licenseFile: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    ...formatUserForAdmin(user),
    joinedAt: formatDateTime(user.createdAt),
    createdAt: formatDateTime(user.createdAt),
  };
};

const createUser = async (userData) => {
  if (userData.role === "doctor" && !userData.specialization) {
    const error = new Error("Specialization is required for doctor");
    error.status = 400;
    throw error;
  }

  if (userData.role === "doctor" && !userData.licenseNumber) {
    const error = new Error("License number is required for doctor");
    error.status = 400;
    throw error;
  }

  let clinic = null;
  if (userData.role === "doctor") {
    const clinicId = typeof userData.clinicId === "string"
      ? userData.clinicId.trim()
      : userData.clinicId;

    if (!clinicId) {
      const error = new Error("Clinic wajib dipilih untuk doctor");
      error.status = 400;
      throw error;
    }

    clinic = await prisma.clinic.findFirst({
      where: {
        clinicId,
        isActive: true,
      },
      select: {
        clinicId: true,
        name: true,
      },
    });

    if (!clinic) {
      const error = new Error("Clinic tidak ditemukan atau tidak aktif");
      error.status = 400;
      throw error;
    }
  }

  const normalizedEmail = validateAndNormalizeEmail(userData.email);
  await ensureEmailAvailable(prisma, normalizedEmail);

  const hashedPassword = await hashPassword(userData.password, {
    email: normalizedEmail,
    name: userData.fullName,
  });

  const doctorProfileData = userData.role === "doctor"
    ? {
        clinicId: clinic.clinicId,
        verificationStatus: "pending",
        specialization: userData.specialization,
        practitionerLicense: userData.licenseNumber,
        licenseFile: userData.medicalLicense || null,
        settings: {
          create: {
            twoFactorEnabled: false,
            emailNotifications: true,
            verificationAlerts: true,
            dataVisibility: "restricted_clinical_team_only",
            language: "English (US)",
          },
        },
      }
    : undefined;
  const patientProfileData = userData.role === "patient"
    ? {
        settings: {
          create: {
            twoFactorEnabled: false,
            emailNotifications: true,
            scanNotifications: true,
            reportNotifications: true,
            dataVisibility: "restricted_self_only",
            language: "English (US)",
            theme: "light",
          },
        },
      }
    : undefined;

  const user = await prisma.user.create({
    data: {
      name: userData.fullName,
      email: normalizedEmail,
      password: hashedPassword,
      role: userData.role,
      gender: userData.gender.toLowerCase(),
      phone: userData.phoneNumber,
      birthDate: userData.birthDate ? new Date(userData.birthDate) : null,
      status: "pending",
      ...(doctorProfileData && {
        doctorProfile: {
          create: doctorProfileData,
        },
      }),
      ...(patientProfileData && {
        patientProfile: {
          create: patientProfileData,
        },
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      doctorProfile: {
        select: {
          id: true,
          specialization: true,
          practitionerLicense: true,
          licenseFile: true,
          verificationStatus: true,
          joinedAt: true,
          clinicId: true,
          clinic: {
            select: {
              clinicId: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (user.role === "doctor" && user.doctorProfile?.verificationStatus === "pending") {
    await createAdminNotificationForEnabledAdmins(
      "doctor_approval",
      "New doctor approval request",
      `${user.name} is waiting for approval`,
      "doctorApprovalAlerts",
      { doctorId: user.id }
    );
  }

  return {
    message: "User created successfully",
    data: {
      userId: user.id,
      fullName: user.name,
      role: user.role,
      email: user.email,
      status: user.status,
      ...(user.doctorProfile && {
        doctorProfile: {
          doctorId: user.doctorProfile.id,
          specialization: user.doctorProfile.specialization,
          practitionerLicense: user.doctorProfile.practitionerLicense,
          licenseFile: user.doctorProfile.licenseFile,
          verificationStatus: user.doctorProfile.verificationStatus,
          joinedAt: user.doctorProfile.joinedAt,
          clinicId: user.doctorProfile.clinicId,
          clinicName: user.doctorProfile.clinic?.name || null,
          clinic: user.doctorProfile.clinic ? {
            clinicId: user.doctorProfile.clinic.clinicId,
            name: user.doctorProfile.clinic.name,
          } : null,
        },
      }),
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

  let normalizedEmail;
  if (updateData.email !== undefined) {
    normalizedEmail = validateAndNormalizeEmail(updateData.email);
    await ensureEmailAvailable(prisma, normalizedEmail, userId);
  }

  const updatePayload = {};
  if (updateData.fullName) updatePayload.name = updateData.fullName;
  if (normalizedEmail) updatePayload.email = normalizedEmail;
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

const deleteDoctorOwnedRelations = async (tx, user) => {
  const doctorProfileId = user.doctorProfile?.id;

  const consultations = await tx.consultation.findMany({
    where: { doctorId: user.id },
    select: { id: true },
  });
  const consultationIds = consultations.map((consultation) => consultation.id);

  if (consultationIds.length > 0) {
    await tx.chatMessageReadReceipt.deleteMany({
      where: { message: { consultationId: { in: consultationIds } } },
    });
    await tx.chatMessageAttachment.deleteMany({
      where: { message: { consultationId: { in: consultationIds } } },
    });
    await tx.chatMessage.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await tx.prescription.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await tx.consultation.deleteMany({
      where: { id: { in: consultationIds } },
    });
  }

  await tx.chatMessageReadReceipt.deleteMany({
    where: { userId: user.id },
  });
  await tx.chatMessageReadReceipt.deleteMany({
    where: { message: { senderId: user.id } },
  });
  await tx.chatMessageAttachment.deleteMany({
    where: { message: { senderId: user.id } },
  });
  await tx.chatMessage.deleteMany({
    where: { senderId: user.id },
  });
  await tx.prescription.deleteMany({
    where: { doctorId: user.id },
  });
  await tx.report.updateMany({
    where: { approvedByDoctorId: user.id },
    data: { approvedByDoctorId: null, approvedAt: null },
  });
  await tx.verificationRequest.updateMany({
    where: {
      OR: [
        { assignedDoctorId: user.id },
        ...(doctorProfileId ? [{ assignedDoctorId: doctorProfileId }] : []),
      ],
    },
    data: {
      assignedDoctorId: null,
      assignedDoctorName: null,
    },
  });

  if (!doctorProfileId) {
    return;
  }

  await tx.doctorObservation.deleteMany({
    where: { doctorId: doctorProfileId },
  });
  await tx.notification.deleteMany({
    where: { doctorId: doctorProfileId },
  });
  await tx.doctorSettings.deleteMany({
    where: { doctorId: doctorProfileId },
  });
  await tx.caseAssignment.deleteMany({
    where: { doctorId: doctorProfileId },
  });
  await tx.caseReview.updateMany({
    where: { doctorId: doctorProfileId },
    data: { doctorId: null },
  });
};

const deleteUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      doctorProfile: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (user.role === "doctor") {
        await deleteDoctorOwnedRelations(tx, user);
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });
  } catch (err) {
    if (err.code === "P2003") {
      const error = new Error("User tidak dapat dihapus karena masih memiliki data relasi");
      error.status = 409;
      throw error;
    }

    throw err;
  }

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

  const isSamePassword = await verifyPassword(newPassword, user.password);
  if (isSamePassword) {
    const error = new Error("Password baru harus berbeda dari password sebelumnya");
    error.status = 400;
    throw error;
  }

  const hashedPassword = await hashPassword(newPassword, {
    email: user.email,
    name: user.name,
  });

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
    status = "all",
    clinicId = "all",
    page = 1,
    limit = 8,
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  if (status && status !== "all") {
    where.verificationStatus = status;
  }

  if (clinicId && clinicId !== "all") {
    where.clinicId = clinicId;
  }

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
            role: true,
            status: true,
            gender: true,
            phone: true,
            birthDate: true,
            avatarUrl: true,
          },
        },
        caseReviews: {
          select: { id: true },
        },
        clinic: {
          select: {
            clinicId: true,
            name: true,
          },
        },
      },
    }),
    prisma.doctorProfile.count({ where }),
  ]);

  return {
    data: doctors.map(formatDoctorForAdmin),
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

const getDoctorById = async (doctorId) => {
  const doctor = await findDoctorProfileById(doctorId, {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        gender: true,
        phone: true,
        birthDate: true,
        avatarUrl: true,
      },
    },
    caseReviews: {
      select: { id: true },
    },
    clinic: {
      select: {
        clinicId: true,
        name: true,
      },
    },
  });

  return formatDoctorForAdmin(doctor);
};

const getDoctorVerificationRequests = async (doctorId) => {
  const doctor = await findDoctorProfileById(doctorId, {
    user: true,
  });

  const caseReviews = await prisma.caseReview.findMany({
    where: { doctorId: doctor.id },
    include: {
      scan: {
        include: {
          patient: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      },
      observations: {
        select: { id: true, observation: true },
      },
    },
    orderBy: { receivedAt: "desc" },
  });

  return {
    doctor: {
      doctorId: doctor.id,
      userId: doctor.userId,
      fullName: doctor.user.name,
    },
    data: caseReviews.map((caseReview) => ({
      requestId: caseReview.caseId,
      patientName: caseReview.scan.patient.user.name,
      patientId: caseReview.scan.patient.user.id,
      patientAvatarUrl: caseReview.scan.patient.user.avatarUrl,
      patientEmail: caseReview.scan.patient.user.email,
      date: formatDateTime(caseReview.receivedAt),
      aiDiagnosis: caseReview.scan.aiPrediction,
      aiConfidence: caseReview.scan.aiConfidence,
      reviewStatus: caseReview.reviewStatus,
      caseId: caseReview.caseId,
      observations: caseReview.observations,
    })),
  };
};

const approveDoctorRequest = async (doctorId, note) => {
  const doctor = await findDoctorProfileById(doctorId);

  await prisma.doctorProfile.update({
    where: { id: doctor.id },
    data: { verificationStatus: "verified" },
  });

  return {
    message: "Doctor approval request accepted",
  };
};

const rejectDoctorRequest = async (doctorId, reason) => {
  const doctor = await findDoctorProfileById(doctorId);

  await prisma.doctorProfile.update({
    where: { id: doctor.id },
    data: { verificationStatus: "rejected" },
  });

  return {
    message: "Doctor approval request rejected",
  };
};

const updateDoctorLicense = async (doctorId, licenseFile) => {
  const doctor = await findDoctorProfileById(doctorId);
  const previousLicenseFile = doctor.licenseFile;

  const updatedDoctor = await prisma.doctorProfile.update({
    where: { id: doctor.id },
    data: { licenseFile },
    select: {
      id: true,
      licenseFile: true,
    },
  });

  if (previousLicenseFile?.startsWith("/uploads/licenses/")) {
    const previousPath = path.join(__dirname, "../..", previousLicenseFile);
    if (fs.existsSync(previousPath)) {
      fs.unlinkSync(previousPath);
    }
  }

  return {
    message: "Doctor medical license updated successfully",
    data: {
      doctorId: updatedDoctor.id,
      licenseFile: updatedDoctor.licenseFile,
    },
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

  let settings = await prisma.adminSettings.findUnique({
    where: { adminId },
  });

  if (!settings) {
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
    adminId: admin.id,
    fullName: admin.name,
    email: admin.email,
    gender: admin.gender,
    role: admin.role,
    phoneNumber: admin.phone,
    birthDate: formatDate(admin.birthDate),
    joinedAt: formatDateTime(admin.createdAt),
    createdAt: formatDateTime(admin.createdAt),
    avatarUrl: admin.avatarUrl,
    twoFactorEnabled: settings.twoFactorEnabled,
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

const formatAdminSettings = (admin, settings) => ({
  account: {
    email: admin.email,
  },
  notifications: {
    emailNotifications: settings.emailNotifications,
    doctorApprovalAlerts: settings.doctorApprovalAlerts,
    clinicRequestAlerts: settings.clinicRequestAlerts,
    systemAlerts: settings.systemAlerts,
    weeklyDigest: settings.weeklyDigest,
  },
  operations: {
    defaultPageSize: settings.defaultPageSize,
    auditLogRetentionDays: settings.auditLogRetentionDays,
    maintenanceMode: settings.maintenanceMode,
    deleteConfirmationRequired: settings.deleteConfirmationRequired,
  },
  preferences: {
    language: settings.language,
    timezone: settings.timezone,
  },
});

const formatAdminOperationsSettings = (settings) => ({
  defaultPageSize: settings.defaultPageSize,
  auditLogRetentionDays: settings.auditLogRetentionDays,
  maintenanceMode: settings.maintenanceMode,
  deleteConfirmationRequired: settings.deleteConfirmationRequired,
});

const getOrCreateAdminSettings = async (adminId) => {
  let settings = await prisma.adminSettings.findUnique({
    where: { adminId },
  });

  if (!settings) {
    settings = await prisma.adminSettings.create({
      data: { adminId },
    });
  }

  return settings;
};

const getAdminSettings = async (adminId) => {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      email: true,
    },
  });

  if (!admin) {
    const error = new Error("Admin not found");
    error.status = 404;
    throw error;
  }

  const settings = await getOrCreateAdminSettings(adminId);
  return formatAdminSettings(admin, settings);
};

const getAdminOperationsSettings = async (adminId) => {
  const settings = await getOrCreateAdminSettings(adminId);
  return formatAdminOperationsSettings(settings);
};

const updateAdminSettingsAccount = async (adminId, email, currentPassword, newPassword) => {
  const admin = await prisma.user.findUnique({ where: { id: adminId } });

  if (!admin) {
    const error = new Error("Admin not found");
    error.status = 404;
    throw error;
  }

  if (email !== undefined) {
    const normalizedEmail = validateAndNormalizeEmail(email);
    await ensureEmailAvailable(prisma, normalizedEmail, adminId);

    await prisma.user.update({
      where: { id: adminId },
      data: { email: normalizedEmail },
    });
  }

  if (newPassword) {
    const passwordMatch = await verifyPassword(currentPassword, admin.password);

    if (!passwordMatch) {
      const error = new Error("Current password is incorrect");
      error.status = 400;
      throw error;
    }

    const isSamePassword = await verifyPassword(newPassword, admin.password);
    if (isSamePassword) {
      const error = new Error("Password baru harus berbeda dari password sebelumnya");
      error.status = 400;
      throw error;
    }

    assertStrongPassword(newPassword, {
      email: admin.email,
      name: admin.name,
    });

    const hashedPassword = await hashPassword(newPassword, { validate: false });

    await prisma.user.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });
  }

  return {
    message: "Account settings updated successfully",
  };
};

const updateAdminSettingsNotifications = async (adminId, data) => {
  await getOrCreateAdminSettings(adminId);

  const updateData = {};
  [
    "emailNotifications",
    "doctorApprovalAlerts",
    "clinicRequestAlerts",
    "systemAlerts",
    "weeklyDigest",
  ].forEach((field) => {
    if (data[field] !== undefined) updateData[field] = data[field];
  });

  const settings = await prisma.adminSettings.update({
    where: { adminId },
    data: updateData,
  });

  return {
    message: "Notification settings updated successfully",
    data: {
      emailNotifications: settings.emailNotifications,
      doctorApprovalAlerts: settings.doctorApprovalAlerts,
      clinicRequestAlerts: settings.clinicRequestAlerts,
      systemAlerts: settings.systemAlerts,
      weeklyDigest: settings.weeklyDigest,
    },
  };
};

const updateAdminSettingsOperations = async (adminId, data) => {
  await getOrCreateAdminSettings(adminId);

  const updateData = {};
  if (data.defaultPageSize !== undefined) updateData.defaultPageSize = Number(data.defaultPageSize);
  if (data.auditLogRetentionDays !== undefined) {
    updateData.auditLogRetentionDays = Number(data.auditLogRetentionDays);
  }
  if (data.maintenanceMode !== undefined) updateData.maintenanceMode = data.maintenanceMode;
  if (data.deleteConfirmationRequired !== undefined) {
    updateData.deleteConfirmationRequired = data.deleteConfirmationRequired;
  }

  const settings = await prisma.adminSettings.update({
    where: { adminId },
    data: updateData,
  });

  return {
    message: "Operation settings updated successfully",
    data: formatAdminOperationsSettings(settings),
  };
};

const updateAdminSettingsPreferences = async (adminId, data) => {
  await getOrCreateAdminSettings(adminId);

  const updateData = {};
  if (data.language !== undefined) updateData.language = data.language;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;

  const settings = await prisma.adminSettings.update({
    where: { adminId },
    data: updateData,
  });

  return {
    message: "Preferences updated successfully",
    data: {
      language: settings.language,
      timezone: settings.timezone,
    },
  };
};

const resolveAdminPagination = async (adminId, { page = 1, limit } = {}) => {
  const pageNumber = parseInt(page || 1, 10);

  if (limit !== undefined && limit !== null && limit !== "") {
    return {
      page: pageNumber,
      limit: parseInt(limit, 10),
    };
  }

  const settings = await getOrCreateAdminSettings(adminId);
  return {
    page: pageNumber,
    limit: settings.defaultPageSize,
  };
};

const cleanupExpiredAuditLogs = async ({ adminIds: scopedAdminIds } = {}) => {
  const now = new Date();
  const admins = await prisma.user.findMany({
    where: {
      role: "admin",
      ...(scopedAdminIds ? { id: { in: scopedAdminIds } } : {}),
    },
    select: {
      id: true,
      adminSettings: {
        select: { auditLogRetentionDays: true },
      },
    },
  });

  let deletedCount = 0;

  for (const admin of admins) {
    const retentionDays = admin.adminSettings?.auditLogRetentionDays || 180;
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.auditLog.deleteMany({
      where: {
        adminId: admin.id,
        createdAt: { lt: cutoff },
      },
    });
    deletedCount += result.count;
  }

  if (!scopedAdminIds) {
    const adminIds = admins.map((admin) => admin.id);
    const defaultCutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const orphanedResult = await prisma.auditLog.deleteMany({
      where: {
        ...(adminIds.length > 0 ? { adminId: { notIn: adminIds } } : {}),
        createdAt: { lt: defaultCutoff },
      },
    });
    deletedCount += orphanedResult.count;
  }

  return {
    message: "Expired audit logs cleaned up successfully",
    deletedCount,
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
    requestingAdminId,
    adminId,
    action,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};
  let timezone = "Asia/Jakarta";

  if (requestingAdminId) {
    const settings = await getOrCreateAdminSettings(requestingAdminId);
    timezone = settings.timezone;
  }

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
      formattedCreatedAt: formatDateForAdmin(log.createdAt, timezone),
    })),
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    },
  };
};

const generateAuditId = () => `AUD-${crypto.randomUUID()}`;

const isAuditIdUniqueCollision = (error) => (
  error?.code === "P2002" &&
  (
    error.meta?.target === "AuditLog_auditId_key" ||
    error.meta?.target?.includes?.("auditId") ||
    error.meta?.target?.includes?.("AuditLog_auditId_key")
  )
);

const createAuditLog = async (adminId, adminName, action, description, additionalData = {}) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.auditLog.create({
        data: {
          auditId: generateAuditId(),
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
    } catch (error) {
      if (attempt < maxAttempts && isAuditIdUniqueCollision(error)) {
        continue;
      }

      throw error;
    }
  }
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
  updateDoctorLicense,

  // Profile
  getAdminProfile,
  updateAdminProfile,
  updateAdminPhoto,
  getVerificationStatus,

  // Settings
  getAdminSettings,
  getAdminOperationsSettings,
  updateAdminSettingsAccount,
  updateAdminSettingsNotifications,
  updateAdminSettingsOperations,
  updateAdminSettingsPreferences,
  resolveAdminPagination,
  cleanupExpiredAuditLogs,

  // Notifications
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,

  // Audit Logs
  getAuditLogs,
  createAuditLog,
};
