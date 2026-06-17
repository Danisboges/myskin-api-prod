const prisma = require('../config/prisma');

const ACTIVE_CONSULTATION_ERROR_CODE = 'ACTIVE_CONSULTATION_EXISTS';
const ACTIVE_CONSULTATION_MESSAGE = 'You still have an active consultation. Please wait until the doctor closes the case before requesting another doctor.';
const CLOSED_CONSULTATION_STATUSES = new Set([
  'CLOSED',
  'case_resolved',
  'resolved',
  'completed',
]);

const isActiveConsultationStatus = (status) => !CLOSED_CONSULTATION_STATUSES.has(String(status || ''));

const createActiveConsultationError = (consultation) => {
  const error = new Error(ACTIVE_CONSULTATION_MESSAGE);
  error.status = 409;
  error.code = ACTIVE_CONSULTATION_ERROR_CODE;
  error.data = {
    consultationId: consultation.id,
    doctorId: consultation.doctorId,
    doctorName: consultation.doctor?.name || null,
    status: consultation.status,
  };
  return error;
};

const findActivePatientConsultation = async (patientUserId) => {
  const consultations = await prisma.consultation.findMany({
    where: {
      patientId: patientUserId,
      status: {
        not: 'CLOSED',
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return consultations.find((consultation) => isActiveConsultationStatus(consultation.status)) || null;
};

const assertNoActivePatientConsultation = async (patientUserId) => {
  const activeConsultation = await findActivePatientConsultation(patientUserId);

  if (activeConsultation) {
    throw createActiveConsultationError(activeConsultation);
  }

  return null;
};

module.exports = {
  ACTIVE_CONSULTATION_ERROR_CODE,
  ACTIVE_CONSULTATION_MESSAGE,
  assertNoActivePatientConsultation,
  findActivePatientConsultation,
  isActiveConsultationStatus,
};
