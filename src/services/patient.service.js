/**
 * Patient Service
 * Business logic untuk patient features
 */

const prisma = require('../config/prisma');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// ==================== DASHBOARD ====================

const getDashboard = async (userId) => {
  // 1. Ambil data PatientProfile beserta relasi terkait
  const patientProfile = await prisma.patientProfile.findUnique({
    where: { userId },
    include: {
      // Mengambil data user sekaligus sesi konsultasi yang sedang aktif
      user: { 
        select: { 
          id: true, 
          name: true, 
          email: true, 
          phone: true, 
          gender: true, 
          birthDate: true,
          avatarUrl: true,
          // FITUR KURANG: Tambahkan konsultasi aktif
          patientConsultations: {
            where: { status: 'OPEN' },
            take: 3,
            orderBy: { createdAt: 'desc' }
          }
        } 
      },
      // Ambil 5 scan terbaru (baik yang sudah dianalisis maupun belum)
      scans: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          scanId: true,
          imageUrl: true,
          isAnalyzed: true,
          aiPrediction: true,
          aiConfidence: true,
          createdAt: true
        }
      },
      verificationRequests: {
        where: { status: 'pending' },
        take: 3,
        orderBy: { createdAt: 'desc' }
      },
      notifications: {
        where: { isRead: false },
        take: 5,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!patientProfile) {
    throw new Error('Patient profile not found');
  }

  // 2. Hitung statistik untuk summary/ringkasan angka di Dashboard
  const totalScans = await prisma.scan.count({ 
    where: { patientId: patientProfile.id } 
  });
  
  const analyzedScans = await prisma.scan.count({ 
    where: { patientId: patientProfile.id, isAnalyzed: true } 
  });
  
  // Asumsi field patientId di Report terhubung dengan ID User pasien
  const totalReports = await prisma.report.count({ 
    where: { patientId: userId } 
  });

  // 3. Format Response agar rapi dan langsung siap dirender oleh UI Frontend
  return {
    profile: {
      id: patientProfile.user.id,
      name: patientProfile.user.name,
      email: patientProfile.user.email,
      phone: patientProfile.user.phone,
      gender: patientProfile.user.gender,
      birthDate: patientProfile.user.birthDate,
      avatarUrl: patientProfile.user.avatarUrl,
      patientProfileId: patientProfile.id
    },
    statistics: {
      totalScans,
      analyzedScans,
      totalReports,
      pendingVerificationsCount: patientProfile.verificationRequests.length // Tambahan info
    },
    activeConsultations: patientProfile.user.patientConsultations, // Menampilkan data yang kurang
    recentScans: patientProfile.scans,
    pendingVerifications: patientProfile.verificationRequests,
    unreadNotifications: patientProfile.notifications
  };
};

// ==================== SCAN MANAGEMENT ====================

const uploadScan = async (userId, fileData, complaint, bodySite) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  // Simpan file
  const filename = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileData.originalname.split('.').pop()}`;
  const uploadDir = path.join(__dirname, '../../uploads');
  const filepath = path.join(uploadDir, filename);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  fs.writeFileSync(filepath, fileData.buffer);

  // Generate scanId
  const scanId = `SCN-${Date.now()}`;

  // Buat record scan di database
  const scan = await prisma.scan.create({
    data: {
      scanId,
      patientId: patient.id,
      imageUrl: `/uploads/${filename}`,
      complaint,
      bodySite: bodySite || 'unspecified',
      isAnalyzed: false
    },
    include: {
      patient: { select: { user: { select: { name: true, email: true } } } }
    }
  });

  return {
    scanId: scan.scanId,
    id: scan.id,
    imageUrl: scan.imageUrl,
    uploadedAt: scan.uploadedAt,
    message: 'Scan uploaded successfully. Waiting for analysis.'
  };
};

const findScanByIdentifier = async (scanIdentifier, include) => {
  return prisma.scan.findFirst({
    where: {
      OR: [
        { scanId: scanIdentifier },
        { id: scanIdentifier }
      ]
    },
    ...(include && { include })
  });
};

const analyzeScan = async (userId, scanId) => {
  // 1. Ambil AI Base URL dari environment variable
  const AI_BASE_URL = process.env.AI_BASE_URL;

  if (!AI_BASE_URL) {
    throw new Error('AI_BASE_URL is not defined in environment variables');
  }

  // 2. Cari Patient Profile
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  // 3. Cari Scan Record
  const scan = await findScanByIdentifier(scanId);

  if (!scan) {
    throw new Error('Scan not found');
  }

  // 4. Validasi kepemilikan scan
  if (scan.patientId !== patient.id) {
    throw new Error('Unauthorized to access this scan');
  }

  if (scan.isAnalyzed) {
    throw new Error('Scan has already been analyzed');
  }

  try {
    // 5. Siapkan file untuk dikirim ke AI
    // Mengasumsikan struktur folder: melanoma-api/src/services/auth.service.js
    // dan folder uploads ada di root: melanoma-api/uploads
    const absolutePath = path.join(__dirname, '../../', scan.imageUrl);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File image tidak ditemukan: ${absolutePath}`);
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(absolutePath));

    // 6. Request ke Model AI (FastAPI / Ngrok)
    const aiResponse = await axios.post(`${AI_BASE_URL}/predict`, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    const aiResult = aiResponse.data;

    // 7. Update status scan di database dengan hasil AI asli
    const updatedScan = await prisma.scan.update({
      where: { id: scan.id },
      data: {
        isAnalyzed: true,
        analyzeCompletedAt: new Date(),
        // Sesuaikan key JSON (prediction/confidence) dengan output API AI Anda
        aiPrediction: aiResult.prediction || aiResult.class,
        aiConfidence: parseFloat(aiResult.confidence || aiResult.score || 0),
        aiDetails: JSON.stringify(aiResult) // Simpan full response untuk backup
      }
    });

    // 8. Buat Notifikasi untuk Pasien
    await prisma.patientNotification.create({
      data: {
        notificationId: `PN-${Date.now()}`,
        patientId: patient.id,
        title: 'Analisis Scan Selesai',
        message: `Scan Anda telah dianalisis. Hasil Prediksi: ${updatedScan.aiPrediction}`,
        type: 'scan_completed'
      }
    });

    return {
      scanId: updatedScan.scanId,
      aiPrediction: updatedScan.aiPrediction,
      aiConfidence: updatedScan.aiConfidence,
      analyzeCompletedAt: updatedScan.analyzeCompletedAt,
      message: 'Scan analyzed successfully by AI Model'
    };

  } catch (error) {
    console.error("AI Analysis Error:", error.message);
    
    // Berikan pesan error yang lebih spesifik jika API AI mati
    const errorMessage = error.response 
      ? `AI Service Error: ${JSON.stringify(error.response.data)}` 
      : error.message;
      
    throw new Error(`Gagal melakukan analisis AI: ${errorMessage}`);
  }
};

const getScanAnalysis = async (userId, scanId) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });
  console.log("DEBUG getScanAnalysis - patient:", patient);
  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const scan = await findScanByIdentifier(scanId);

  if (!scan || scan.patientId !== patient.id) {
    throw new Error('Scan not found or unauthorized');
  }

  if (!scan.isAnalyzed) {
    throw new Error('Scan is not yet analyzed');
  }

  // Get case review if exists
  const caseReview = await prisma.caseReview.findUnique({
    where: { scanId: scan.id },
    include: {
      doctor: {
        include: {
          user: { select: { name: true } }
        }
      }
    }
  });

  return {
    scanId: scan.scanId,
    imageUrl: scan.imageUrl,
    complaint: scan.complaint,
    bodySite: scan.bodySite,
    analysis: {
      prediction: scan.aiPrediction,
      confidence: scan.aiConfidence,
      details: scan.aiDetails
    },
    doctorReview: caseReview ? {
      doctorName: caseReview.doctor?.user.name,
      diagnosis: caseReview.finalDiagnosis,
      observation: caseReview.physicianObservation,
      status: caseReview.reviewStatus,
      reviewedAt: caseReview.reviewedAt
    } : null,
    uploadedAt: scan.uploadedAt,
    analyzedAt: scan.analyzeCompletedAt
  };
};

const getRecentScans = async (userId, pagination) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const scans = await prisma.scan.findMany({
    where: { patientId: patient.id },
    skip: pagination.skip,
    take: pagination.limit,
    orderBy: { [pagination.sortBy]: pagination.order },
    select: {
      id: true,
      scanId: true,
      imageUrl: true,
      complaint: true,
      bodySite: true,
      isAnalyzed: true,
      aiPrediction: true,
      aiConfidence: true,
      uploadedAt: true,
      analyzeCompletedAt: true
    }
  });

  const total = await prisma.scan.count({ where: { patientId: patient.id } });

  return {
    data: scans,
    pagination: {
      page: Math.floor(pagination.skip / pagination.limit) + 1,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit)
    }
  };
};

const getScanHistory = async (userId, pagination, filters = {}) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  // Build filter
  const where = { patientId: patient.id };
  if (filters.bodySite) {
    where.bodySite = filters.bodySite;
  }
  if (filters.isAnalyzed !== undefined) {
    where.isAnalyzed = filters.isAnalyzed === 'true';
  }

  const scans = await prisma.scan.findMany({
    where,
    skip: pagination.skip,
    take: pagination.limit,
    orderBy: { [pagination.sortBy]: pagination.order },
    select: {
      id: true,
      scanId: true,
      imageUrl: true,
      complaint: true,
      bodySite: true,
      isAnalyzed: true,
      aiPrediction: true,
      aiConfidence: true,
      uploadedAt: true,
      analyzeCompletedAt: true,
      isSharedWithDoctor: true
    }
  });

  const total = await prisma.scan.count({ where });

  return {
    data: scans,
    pagination: {
      page: Math.floor(pagination.skip / pagination.limit) + 1,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit)
    }
  };
};

const getScanDetail = async (userId, scanId, doctorUserId = null) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const scan = await findScanByIdentifier(scanId, {
      reports: {
        select: {
          reportId: true,
          title: true,
          diagnosis: true,
          status: true,
          createdAt: true
        }
      }
  });

  if (!scan || scan.patientId !== patient.id) {
    throw new Error('Scan not found or unauthorized');
  }

  // If doctorUserId is provided, verify doctor has access to this scan
  if (doctorUserId) {
    const sharedWith = scan.sharedWith ? JSON.parse(scan.sharedWith) : [];
    if (!sharedWith.includes(doctorUserId)) {
      throw new Error('Doctor unauthorized to view this scan');
    }
  }

  return scan;
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Helper: Create notification untuk doctor
 */
const createDoctorNotification = async (doctorId, title, message, type = 'case_request') => {
  try {
    await prisma.notification.create({
      data: {
        doctorId,
        notificationId: `ND-${Date.now()}`,
        title,
        message,
        type,
        isRead: false
      }
    });
  } catch (err) {
    console.error('Error creating doctor notification:', err.message);
    // Jangan throw, notifikasi gagal tidak boleh menggagalkan operasi utama
  }
};

/**
 * Helper: Create notification untuk patient
 */
const createPatientNotification = async (patientId, title, message, type = 'system_message') => {
  try {
    await prisma.patientNotification.create({
      data: {
        patientId,
        notificationId: `PN-${Date.now()}`,
        title,
        message,
        type,
        isRead: false
      }
    });
  } catch (err) {
    console.error('Error creating patient notification:', err.message);
    // Jangan throw, notifikasi gagal tidak boleh menggagalkan operasi utama
  }
};

// ==================== SCAN MANAGEMENT ====================

const shareScanWithDoctor = async (userId, scanId, doctorUserId) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: { id: true, name: true, gender: true, birthDate: true }
      }
    }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const scan = await findScanByIdentifier(scanId);

  if (!scan || scan.patientId !== patient.id) {
    throw new Error('Scan not found or unauthorized');
  }

  // Validasi doctor exists by userId
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: doctorUserId },
    include: {
      user: {
        select: { role: true, name: true }
      }
    }
  });

  if (!doctor || doctor.user.role !== 'doctor') {
    throw new Error('Doctor not found or invalid');
  }

  // Update scan share status with doctorUserId
  const sharedWith = scan.sharedWith ? JSON.parse(scan.sharedWith) : [];
  const isNewShare = !sharedWith.includes(doctorUserId);
  
  if (isNewShare) {
    sharedWith.push(doctorUserId);
  }

  const updatedScan = await prisma.scan.update({
    where: { id: scan.id },
    data: {
      isSharedWithDoctor: true,
      sharedWith: JSON.stringify(sharedWith)
    }
  });

  // Jika ini adalah share pertama, buat CaseReview dan CaseAssignment + Notifikasi
  if (isNewShare) {
    // Calculate patient age
    const birthDate = patient.user.birthDate ? new Date(patient.user.birthDate) : null;
    const today = new Date();
    const patientAge = birthDate ? today.getFullYear() - birthDate.getFullYear() : 0;

    // Generate caseId dengan format SK-XXXX
    const caseId = `SK-${Date.now()}`;

    // Cek apakah CaseReview sudah ada untuk scan ini
    let caseReview = await prisma.caseReview.findUnique({
      where: { scanId: scan.id }
    });

    // Jika belum ada, buat CaseReview baru
    if (!caseReview) {
      caseReview = await prisma.caseReview.create({
        data: {
          caseId,
          scanId: scan.id,
          doctorId: doctor.id,
          reviewStatus: 'pending_review'
        }
      });
    } else if (!caseReview.doctorId) {
      // Jika CaseReview sudah ada tapi doctorId masih NULL, maka update!
      caseReview = await prisma.caseReview.update({
        where: { id: caseReview.id },
        data: { doctorId: doctor.id }
      });
    }

    // Buat CaseAssignment untuk dokter ini
    try {
      await prisma.caseAssignment.create({
        data: {
          doctorId: doctor.id,
          caseId: caseReview.caseId
        }
      });
    } catch (err) {
      // Jika unique constraint violation, berarti sudah ada assignment
      if (err.code !== 'P2002') {
        throw err;
      }
    }

    // ===== NOTIFIKASI KE DOCTOR =====
    await createDoctorNotification(
      doctor.id,
      'New Scan Shared',
      `Patient ${patient.user.name} has shared a scan with you. Case ID: ${caseReview.caseId}`,
      'case_request'
    );
  }

  return {
    scanId: updatedScan.scanId,
    isSharedWithDoctor: updatedScan.isSharedWithDoctor,
    sharedWith: JSON.parse(updatedScan.sharedWith),
    message: 'Scan shared with doctor successfully'
  };
};

// ==================== REPORT MANAGEMENT ====================

const getPatientReports = async (userId, pagination, filters = {}) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  // Build filter
  const where = { patientId: userId };
  if (filters.status) {
    where.status = filters.status;
  }

  const reports = await prisma.report.findMany({
    where,
    skip: pagination.skip,
    take: pagination.limit,
    orderBy: { [pagination.sortBy]: pagination.order },
    select: {
      reportId: true,
      id: true,
      title: true,
      diagnosis: true,
      status: true,
      createdAt: true,
      approvedAt: true,
      scan: {
        select: {
          scanId: true,
          imageUrl: true
        }
      }
    }
  });

  const total = await prisma.report.count({ where });

  return {
    data: reports,
    pagination: {
      page: Math.floor(pagination.skip / pagination.limit) + 1,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit)
    }
  };
};

const getReportDetail = async (userId, reportId) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const report = await prisma.report.findUnique({
    where: { reportId },
    include: {
      scan: {
        select: {
          scanId: true,
          imageUrl: true,
          complaint: true,
          bodySite: true,
          uploadedAt: true
        }
      }
    }
  });

  if (!report || report.patientId !== patient.userId) {
    throw new Error('Report not found or unauthorized');
  }

  return report;
};

const exportReportPDF = async (userId, reportId) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const report = await prisma.report.findUnique({
    where: { reportId }
  });

  if (!report || report.patientId !== patient.userId) {
    throw new Error('Report not found or unauthorized');
  }

  // Return PDF URL atau buat PDF jika belum ada
  if (!report.pdfUrl) {
    throw new Error('PDF not yet generated');
  }

  return {
    reportId: report.reportId,
    pdfUrl: report.pdfUrl,
    title: report.title
  };
};

// ==================== PROFILE MANAGEMENT ====================

const getPatientProfile = async (userId) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          gender: true,
          birthDate: true
        }
      }
    }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  return {
    ...patient.user,
    profilePhotoUrl: patient.profilePhotoUrl,
    medicalHistory: patient.medicalHistory ? JSON.parse(patient.medicalHistory) : null,
    allergies: patient.allergies ? JSON.parse(patient.allergies) : null,
    medications: patient.medications ? JSON.parse(patient.medications) : null,
    familyHistory: patient.familyHistory ? JSON.parse(patient.familyHistory) : null
  };
};

const updatePatientProfile = async (userId, updateData) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  // Update user data
  const { name, phone } = updateData;
  if (name || phone) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone && { phone })
      }
    });
  }

  // Update patient profile data
  const updatePayload = {};
  if (updateData.medicalHistory) {
    updatePayload.medicalHistory = JSON.stringify(updateData.medicalHistory);
  }
  if (updateData.allergies) {
    updatePayload.allergies = JSON.stringify(updateData.allergies);
  }
  if (updateData.medications) {
    updatePayload.medications = JSON.stringify(updateData.medications);
  }
  if (updateData.familyHistory) {
    updatePayload.familyHistory = JSON.stringify(updateData.familyHistory);
  }

  const updatedPatient = await prisma.patientProfile.update({
    where: { id: patient.id },
    data: updatePayload,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          gender: true,
          birthDate: true
        }
      }
    }
  });

  return {
    ...updatedPatient.user,
    message: 'Profile updated successfully'
  };
};

const updateProfilePhoto = async (userId, fileData) => {
  try {
    // Validasi awal fileData
    if (!fileData) {
      throw new Error('No file provided');
    }

    if (!fileData.buffer) {
      throw new Error('File buffer is missing');
    }

    if (fileData.size === 0) {
      throw new Error('File is empty');
    }

    // 1. Cek apakah User tersebut ada di database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // 2. Generate nama file unik
    const fileExtension = fileData.originalname.split('.').pop().toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    if (!validExtensions.includes(fileExtension)) {
      throw new Error(`Invalid file type. Allowed: ${validExtensions.join(', ')}`);
    }

    const filename = `profile_${userId}_${Date.now()}.${fileExtension}`;
    
    // 3. Tentukan direktori penyimpanan
    const uploadDir = path.join(__dirname, '../../uploads/patient-profile');
    const filepath = path.join(uploadDir, filename);

    // Buat folder jika belum tersedia
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 4. Hapus foto lama dari storage jika sebelumnya sudah pernah upload
    // PENTING: Ganti 'avatarUrl' dengan nama kolom asli di tabel User Anda jika berbeda
    const currentPhotoPath = user.avatarUrl || user.profilePhotoUrl;
    if (currentPhotoPath) {
      const oldFilePath = path.join(__dirname, '../../', currentPhotoPath);
      try {
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (err) {
        console.warn('Warning: Could not delete old photo file:', err.message);
      }
    }

    // 5. Simpan file foto baru secara fisik ke server
    fs.writeFileSync(filepath, fileData.buffer);

    // 6. UPDATE DATABASE DI TABEL USER
    // PENTING: Ganti 'avatarUrl' di bawah sesuai nama kolom di model User Anda
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: `/uploads/patient-profile/${filename}` 
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true // Sesuaikan namanya dengan kolom Anda
      }
    });

    return {
      profilePhotoUrl: updatedUser.avatarUrl || updatedUser.profilePhotoUrl,
      message: 'Profile photo updated successfully',
      fileName: filename,
      fileSize: fileData.size
    };
  } catch (err) {
    console.error('Error in updateProfilePhoto:', err.message);
    throw err;
  }
};

// ==================== SETTINGS MANAGEMENT ====================

const getPatientProfileOrThrow = async (userId) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  return patient;
};

const getOrCreatePatientSettings = async (patientId) => {
  const existingSettings = await prisma.patientSettings.findUnique({
    where: { patientId }
  });

  if (existingSettings) {
    return existingSettings;
  }

  return prisma.patientSettings.create({
    data: {
      patientId,
      twoFactorEnabled: false,
      emailNotifications: true,
      scanNotifications: true,
      reportNotifications: true,
      dataVisibility: 'restricted_self_only',
      language: 'English (US)',
      theme: 'light'
    }
  });
};

const getPatientSettings = async (userId) => {
  const patient = await getPatientProfileOrThrow(userId);
  return getOrCreatePatientSettings(patient.id);
};

const updateAccountSettings = async (userId, updateData) => {
  const patient = await getPatientProfileOrThrow(userId);
  const settings = await getOrCreatePatientSettings(patient.id);

  const updatedSettings = await prisma.patientSettings.update({
    where: { id: settings.id },
    data: {
      ...(updateData.twoFactorEnabled !== undefined && { twoFactorEnabled: updateData.twoFactorEnabled })
    }
  });

  return updatedSettings;
};

const updateNotificationSettings = async (userId, updateData) => {
  const patient = await getPatientProfileOrThrow(userId);
  const settings = await getOrCreatePatientSettings(patient.id);

  const updatedSettings = await prisma.patientSettings.update({
    where: { id: settings.id },
    data: {
      ...(updateData.emailNotifications !== undefined && { emailNotifications: updateData.emailNotifications }),
      ...(updateData.scanNotifications !== undefined && { scanNotifications: updateData.scanNotifications }),
      ...(updateData.reportNotifications !== undefined && { reportNotifications: updateData.reportNotifications })
    }
  });

  return updatedSettings;
};

const updatePrivacySettings = async (userId, updateData) => {
  const patient = await getPatientProfileOrThrow(userId);
  const settings = await getOrCreatePatientSettings(patient.id);

  const updatedSettings = await prisma.patientSettings.update({
    where: { id: settings.id },
    data: {
      ...(updateData.dataVisibility && { dataVisibility: updateData.dataVisibility })
    }
  });

  return updatedSettings;
};

const updatePreferences = async (userId, updateData) => {
  const patient = await getPatientProfileOrThrow(userId);
  const settings = await getOrCreatePatientSettings(patient.id);

  const updatedSettings = await prisma.patientSettings.update({
    where: { id: settings.id },
    data: {
      ...(updateData.language && { language: updateData.language }),
      ...(updateData.theme && { theme: updateData.theme })
    }
  });

  return updatedSettings;
};

// ==================== NOTIFICATION MANAGEMENT ====================

const getPatientNotifications = async (userId, pagination) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const notifications = await prisma.patientNotification.findMany({
    where: { patientId: patient.id },
    skip: pagination.skip,
    take: pagination.limit,
    orderBy: { createdAt: 'desc' }
  });

  const total = await prisma.patientNotification.count({
    where: { patientId: patient.id }
  });

  return {
    data: notifications,
    pagination: {
      page: Math.floor(pagination.skip / pagination.limit) + 1,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit)
    }
  };
};

const markNotificationAsRead = async (userId, notificationId) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const notification = await prisma.patientNotification.findUnique({
    where: { notificationId }
  });

  if (!notification || notification.patientId !== patient.id) {
    throw new Error('Notification not found or unauthorized');
  }

  const updatedNotification = await prisma.patientNotification.update({
    where: { id: notification.id },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return updatedNotification;
};

const markAllNotificationsAsRead = async (userId) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  const result = await prisma.patientNotification.updateMany({
    where: {
      patientId: patient.id,
      isRead: false
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return {
    message: `${result.count} notifications marked as read`
  };
};

// ==================== DOCTOR & VERIFICATION ====================

const getAvailableDoctors = async () => {
  const doctors = await prisma.user.findMany({
    where: { role: 'doctor' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true
    }
  });

  return doctors;
};

const submitVerificationRequest = async (userId, message) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId }
  });

  if (!patient) {
    throw new Error('Patient profile not found');
  }

  // Check existing pending requests
  const existingRequest = await prisma.verificationRequest.findFirst({
    where: {
      patientId: patient.id,
      status: 'pending'
    }
  });

  if (existingRequest) {
    throw new Error('You already have a pending verification request');
  }

  const requestId = `VER-${Date.now()}`;

  const verificationRequest = await prisma.verificationRequest.create({
    data: {
      requestId,
      patientId: patient.id,
      message
    }
  });

  // Create notification untuk patient
  await createPatientNotification(
    patient.id,
    'Verification Request Submitted',
    'Your request for doctor verification has been submitted. You will be notified once a doctor accepts.',
    'verification_alert'
  );

  return {
    requestId: verificationRequest.requestId,
    status: verificationRequest.status,
    submittedAt: verificationRequest.submittedAt,
    message: 'Verification request submitted successfully'
  };
};

module.exports = {
  getDashboard,
  uploadScan,
  analyzeScan,
  getScanAnalysis,
  getRecentScans,
  getScanHistory,
  getScanDetail,
  shareScanWithDoctor,
  getPatientReports,
  getReportDetail,
  exportReportPDF,
  getPatientProfile,
  updatePatientProfile,
  updateProfilePhoto,
  getPatientSettings,
  updateAccountSettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updatePreferences,
  getPatientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getAvailableDoctors,
  submitVerificationRequest,
  // Helper functions untuk notifikasi
  createDoctorNotification,
  createPatientNotification
};
