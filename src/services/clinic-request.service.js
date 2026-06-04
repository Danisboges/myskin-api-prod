const prisma = require("../config/prisma");
const {
  createAdminNotificationForEnabledAdmins,
} = require("./admin-notification.service");

const formatClinicRequest = (request) => ({
  id: request.id,
  requestId: request.requestId,
  clinicName: request.clinicName,
  address: request.address,
  phone: request.phone,
  email: request.email,
  requesterName: request.requesterName,
  requesterEmail: request.requesterEmail,
  requesterPhone: request.requesterPhone,
  message: request.message,
  status: request.status,
  reviewNote: request.reviewNote,
  reviewedByAdminId: request.reviewedByAdminId,
  reviewedByAdminName: request.reviewedByAdminName,
  reviewedAt: request.reviewedAt,
  clinicId: request.clinicId,
  clinic: request.clinic ? {
    clinicId: request.clinic.clinicId,
    name: request.clinic.name,
    address: request.clinic.address,
    phone: request.clinic.phone,
    email: request.clinic.email,
    isActive: request.clinic.isActive,
  } : null,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const findClinicRequestByIdentifier = async (id) => {
  const clinicRequest = await prisma.clinicRequest.findFirst({
    where: {
      OR: [
        { id },
        { requestId: id },
      ],
    },
    include: {
      clinic: true,
    },
  });

  if (!clinicRequest) {
    const error = new Error("Clinic request tidak ditemukan");
    error.status = 404;
    throw error;
  }

  return clinicRequest;
};

const assertNoDuplicateClinicRequest = async ({ clinicName, requesterEmail }) => {
  const activeClinic = await prisma.clinic.findFirst({
    where: {
      name: { equals: clinicName.trim(), mode: "insensitive" },
      isActive: true,
    },
    select: { clinicId: true },
  });

  if (activeClinic) {
    const error = new Error("Clinic sudah terdaftar");
    error.status = 409;
    throw error;
  }

  const pendingByClinicName = await prisma.clinicRequest.findFirst({
    where: {
      clinicName: { equals: clinicName.trim(), mode: "insensitive" },
      status: "pending",
    },
    select: { requestId: true },
  });

  if (pendingByClinicName) {
    const error = new Error("Clinic request dengan nama clinic tersebut masih menunggu review");
    error.status = 409;
    throw error;
  }

  const pendingByRequesterEmail = await prisma.clinicRequest.findFirst({
    where: {
      requesterEmail: requesterEmail.trim().toLowerCase(),
      status: "pending",
    },
    select: { requestId: true },
  });

  if (pendingByRequesterEmail) {
    const error = new Error("Requester email masih memiliki clinic request yang menunggu review");
    error.status = 409;
    throw error;
  }
};

const createClinicRequest = async (data) => {
  await assertNoDuplicateClinicRequest({
    clinicName: data.clinicName,
    requesterEmail: data.requesterEmail,
  });

  const clinicRequest = await prisma.clinicRequest.create({
    data: {
      clinicName: data.clinicName.trim(),
      address: normalizeOptionalString(data.address),
      phone: normalizeOptionalString(data.phone),
      email: normalizeOptionalString(data.email)?.toLowerCase(),
      requesterName: data.requesterName.trim(),
      requesterEmail: data.requesterEmail.trim().toLowerCase(),
      requesterPhone: normalizeOptionalString(data.requesterPhone),
      message: normalizeOptionalString(data.message),
    },
    include: {
      clinic: true,
    },
  });

  await createAdminNotificationForEnabledAdmins(
    "clinic_request",
    "New clinic request",
    `${clinicRequest.clinicName} is waiting for approval`,
    "clinicRequestAlerts",
    { requestId: clinicRequest.requestId }
  );

  return formatClinicRequest(clinicRequest);
};

const getClinicRequests = async (filters = {}) => {
  const {
    search,
    status = "all",
    page = 1,
    limit = 10,
    sortOrder = "desc",
  } = filters;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;
  const where = {};

  if (status && status !== "all") {
    where.status = status;
  }

  if (search) {
    const query = search.trim();
    where.OR = [
      { clinicName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { requesterName: { contains: query, mode: "insensitive" } },
      { requesterEmail: { contains: query, mode: "insensitive" } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.clinicRequest.findMany({
      where,
      skip,
      take: limitNumber,
      orderBy: { createdAt: sortOrder === "asc" ? "asc" : "desc" },
      include: {
        clinic: true,
      },
    }),
    prisma.clinicRequest.count({ where }),
  ]);

  return {
    data: requests.map(formatClinicRequest),
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const reviewClinicRequest = async (id, { status, reviewNote, adminId, adminName }) => {
  const existingRequest = await findClinicRequestByIdentifier(id);

  if (existingRequest.status !== "pending") {
    const error = new Error("Clinic request sudah diproses");
    error.status = 400;
    throw error;
  }

  if (status === "approved") {
    const activeClinic = await prisma.clinic.findFirst({
      where: {
        name: { equals: existingRequest.clinicName, mode: "insensitive" },
        isActive: true,
      },
      select: { clinicId: true },
    });

    if (activeClinic) {
      const error = new Error("Clinic sudah terdaftar");
      error.status = 409;
      throw error;
    }
  }

  const reviewedRequest = await prisma.$transaction(async (tx) => {
    let clinic = null;

    if (status === "approved") {
      clinic = await tx.clinic.create({
        data: {
          name: existingRequest.clinicName,
          address: existingRequest.address,
          phone: existingRequest.phone,
          email: existingRequest.email,
          isActive: true,
        },
      });
    }

    return tx.clinicRequest.update({
      where: { id: existingRequest.id },
      data: {
        status,
        reviewNote: normalizeOptionalString(reviewNote) || null,
        reviewedByAdminId: adminId || null,
        reviewedByAdminName: adminName || "Admin",
        reviewedAt: new Date(),
        clinicId: clinic?.clinicId || null,
      },
      include: {
        clinic: true,
      },
    });
  });

  return formatClinicRequest(reviewedRequest);
};

module.exports = {
  createClinicRequest,
  getClinicRequests,
  reviewClinicRequest,
};
