const prisma = require('../config/prisma');

const createDetection = async (userId, filePath, complaint) => {
  return await prisma.detection.create({
    data: {
      userId: userId,
      imageUrl: filePath,
      result: "Malignant (Simulation)", // Contoh hasil dummy
      confidence: 0.85, // Contoh skor dummy
      complaint: complaint                
    }
  });
};

const getHistoryByUserId = async (userId) => {
  return await prisma.detection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
};

// ==================== CASE SUBMISSION TO DOCTOR ====================

const submitCaseToDoctor = async (detectionId, patientId, doctorId, notes) => {
  // Verify detection exists and belongs to patient
  const detection = await prisma.detection.findUnique({
    where: { id: detectionId },
    include: { user: true }
  });

  if (!detection) {
    const error = new Error("Detection not found");
    error.status = 404;
    throw error;
  }

  if (detection.userId !== patientId) {
    const error = new Error("This detection does not belong to you");
    error.status = 403;
    throw error;
  }

  // Verify doctor exists
  const doctor = await prisma.doctorProfile.findUnique({
    where: { doctorId },
    include: { user: true }
  });

  if (!doctor) {
    const error = new Error("Doctor not found");
    error.status = 404;
    throw error;
  }

  // Create or update case review
  const caseReview = await prisma.caseReview.create({
    data: {
      caseId: `CASE-${Date.now()}`,
      patientId,
      patientName: detection.user.name,
      patientAge: new Date().getFullYear() - detection.user.birthDate?.getFullYear() || 0,
      patientGender: detection.user.gender,
      clinicalImageUrl: detection.imageUrl,
      aiPredictionLabel: detection.result,
      aiConfidencePercentage: detection.confidence * 100,
      patientNotes: notes || detection.complaint,
      reviewStatus: 'pending_review',
      receivedAt: new Date(),
    }
  });

  // Create case assignment
  await prisma.caseAssignment.create({
    data: {
      doctorId: doctor.id,
      caseId: caseReview.caseId,
      assignedAt: new Date(),
    }
  });

  return {
    message: "Case submitted to doctor successfully",
    data: {
      caseId: caseReview.caseId,
      doctorId: doctor.doctorId,
      doctorName: doctor.user.name,
      status: caseReview.reviewStatus,
      submittedAt: caseReview.receivedAt,
    }
  };
};

const getPatientCases = async (patientId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [cases, total] = await Promise.all([
    prisma.caseReview.findMany({
      where: { patientId },
      skip,
      take: parseInt(limit),
      orderBy: { receivedAt: 'desc' },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    }),
    prisma.caseReview.count({ where: { patientId } })
  ]);

  return {
    data: cases.map(caseReview => ({
      caseId: caseReview.caseId,
      patientName: caseReview.patientName,
      imageUrl: caseReview.clinicalImageUrl,
      aiDiagnosis: `${caseReview.aiConfidencePercentage}% ${caseReview.aiPredictionLabel}`,
      status: caseReview.reviewStatus,
      assignedDoctor: caseReview.doctor ? {
        doctorId: caseReview.doctor.doctorId,
        name: caseReview.doctor.user.name,
        email: caseReview.doctor.user.email,
        avatarUrl: caseReview.doctor.user.avatarUrl
      } : null,
      submittedAt: caseReview.receivedAt,
      reviewedAt: caseReview.reviewedAt
    })),
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// ==================== DOCTOR CASE MANAGEMENT ====================

const getDoctorAssignedCases = async (doctorId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const doctor = await prisma.doctorProfile.findUnique({
    where: { doctorId }
  });

  if (!doctor) {
    const error = new Error("Doctor not found");
    error.status = 404;
    throw error;
  }

  const [cases, total] = await Promise.all([
    prisma.caseReview.findMany({
      where: { doctorId: doctor.id },
      skip,
      take: parseInt(limit),
      orderBy: { receivedAt: 'desc' },
      include: {
        observations: true
      }
    }),
    prisma.caseReview.count({ where: { doctorId: doctor.id } })
  ]);

  return {
    data: cases.map(caseReview => ({
      caseId: caseReview.caseId,
      patientName: caseReview.patientName,
      patientGender: caseReview.patientGender,
      imageUrl: caseReview.clinicalImageUrl,
      aiDiagnosis: `${caseReview.aiConfidencePercentage}% ${caseReview.aiPredictionLabel}`,
      status: caseReview.reviewStatus,
      submittedAt: caseReview.receivedAt,
      observationCount: caseReview.observations.length,
      reviewedAt: caseReview.reviewedAt
    })),
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const getCaseDetail = async (caseId) => {
  const caseReview = await prisma.caseReview.findUnique({
    where: { caseId },
    include: {
      doctor: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      },
      observations: {
        include: {
          doctor: {
            include: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!caseReview) {
    const error = new Error("Case not found");
    error.status = 404;
    throw error;
  }

  return {
    caseId: caseReview.caseId,
    patientName: caseReview.patientName,
    patientAge: caseReview.patientAge,
    patientGender: caseReview.patientGender,
    imageUrl: caseReview.clinicalImageUrl,
    aiDiagnosis: `${caseReview.aiConfidencePercentage}% ${caseReview.aiPredictionLabel}`,
    patientNotes: caseReview.patientNotes,
    status: caseReview.reviewStatus,
    doctor: caseReview.doctor ? {
      doctorId: caseReview.doctor.doctorId,
      name: caseReview.doctor.user.name,
      email: caseReview.doctor.user.email,
      avatarUrl: caseReview.doctor.user.avatarUrl
    } : null,
    doctorObservation: caseReview.physicianObservation,
    finalDiagnosis: caseReview.finalDiagnosis,
    observations: caseReview.observations.map(obs => ({
      observationId: obs.id,
      doctorName: obs.doctor.user.name,
      observation: obs.observation,
      createdAt: obs.createdAt
    })),
    submittedAt: caseReview.receivedAt,
    reviewedAt: caseReview.reviewedAt
  };
};

const submitCaseReview = async (caseId, doctorId, observation, finalDiagnosis, approvalStatus) => {
  const caseReview = await prisma.caseReview.findUnique({
    where: { caseId },
    include: {
      doctor: true
    }
  });

  if (!caseReview) {
    const error = new Error("Case not found");
    error.status = 404;
    throw error;
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { doctorId }
  });

  if (!doctor || caseReview.doctorId !== doctor.id) {
    const error = new Error("You are not authorized to review this case");
    error.status = 403;
    throw error;
  }

  // Update case review
  const updatedCase = await prisma.caseReview.update({
    where: { caseId },
    data: {
      physicianObservation: observation,
      finalDiagnosis: finalDiagnosis,
      reviewStatus: approvalStatus,
      reviewedAt: new Date()
    }
  });

  // Create observation record
  if (observation) {
    await prisma.doctorObservation.create({
      data: {
        caseReviewId: caseReview.id,
        doctorId: doctor.id,
        observation: observation
      }
    });
  }

  return {
    message: "Case review submitted successfully",
    data: {
      caseId: updatedCase.caseId,
      status: updatedCase.reviewStatus,
      reviewedAt: updatedCase.reviewedAt
    }
  };
};

module.exports = { 
  createDetection, 
  getHistoryByUserId,
  submitCaseToDoctor,
  getPatientCases,
  getDoctorAssignedCases,
  getCaseDetail,
  submitCaseReview
};