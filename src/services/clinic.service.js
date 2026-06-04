const prisma = require("../config/prisma");

const formatClinic = (clinic) => ({
  id: clinic.id,
  clinicId: clinic.clinicId,
  name: clinic.name,
  address: clinic.address,
  phone: clinic.phone,
  email: clinic.email,
  isActive: clinic.isActive,
  doctorsCount: clinic._count?.doctors ?? undefined,
  createdAt: clinic.createdAt,
  updatedAt: clinic.updatedAt,
});

const buildClinicWhere = ({ search, isActive } = {}) => {
  const where = {};

  if (search) {
    const query = search.trim();
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { address: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
    ];
  }

  if (isActive !== undefined && isActive !== null && isActive !== "all") {
    if (typeof isActive === "boolean") {
      where.isActive = isActive;
    } else {
      where.isActive = String(isActive).toLowerCase() === "true";
    }
  }

  return where;
};

const getClinics = async (filters = {}) => {
  const {
    search,
    isActive = "true",
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;
  const allowedSortFields = ["name", "createdAt", "updatedAt", "isActive"];
  const orderField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const orderDirection = sortOrder === "asc" ? "asc" : "desc";
  const where = buildClinicWhere({ search, isActive });

  const [clinics, total] = await Promise.all([
    prisma.clinic.findMany({
      where,
      skip,
      take: limitNumber,
      orderBy: { [orderField]: orderDirection },
      include: {
        _count: {
          select: { doctors: true },
        },
      },
    }),
    prisma.clinic.count({ where }),
  ]);

  return {
    data: clinics.map(formatClinic),
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getClinicById = async (clinicId) => {
  const clinic = await prisma.clinic.findFirst({
    where: {
      OR: [
        { id: clinicId },
        { clinicId },
      ],
    },
    include: {
      _count: {
        select: { doctors: true },
      },
    },
  });

  if (!clinic) {
    const error = new Error("Clinic not found");
    error.status = 404;
    throw error;
  }

  return formatClinic(clinic);
};

const createClinic = async (data) => {
  const clinic = await prisma.clinic.create({
    data: {
      name: data.name.trim(),
      address: data.address?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim().toLowerCase() || undefined,
      isActive: data.isActive ?? true,
    },
    include: {
      _count: {
        select: { doctors: true },
      },
    },
  });

  return formatClinic(clinic);
};

const updateClinic = async (clinicId, data) => {
  const existingClinic = await getClinicById(clinicId);
  const updateData = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.address !== undefined) updateData.address = data.address?.trim() || null;
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
  if (data.email !== undefined) updateData.email = data.email?.trim().toLowerCase() || null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const clinic = await prisma.clinic.update({
    where: { clinicId: existingClinic.clinicId },
    data: updateData,
    include: {
      _count: {
        select: { doctors: true },
      },
    },
  });

  return formatClinic(clinic);
};

const deleteClinic = async (clinicId) => {
  const clinic = await prisma.clinic.findFirst({
    where: {
      OR: [
        { id: clinicId },
        { clinicId },
      ],
    },
    include: {
      _count: {
        select: { doctors: true },
      },
    },
  });

  if (!clinic) {
    const error = new Error("Clinic not found");
    error.status = 404;
    throw error;
  }

  try {
    await prisma.$transaction([
      prisma.doctorProfile.updateMany({
        where: { clinicId: clinic.clinicId },
        data: { clinicId: null },
      }),
      prisma.clinicRequest.updateMany({
        where: { clinicId: clinic.clinicId },
        data: { clinicId: null },
      }),
      prisma.clinic.delete({
        where: { clinicId: clinic.clinicId },
      }),
    ]);
  } catch (error) {
    if (error.code === "P2003") {
      const conflictError = new Error("Clinic tidak dapat dihapus karena masih memiliki doctor terkait");
      conflictError.status = 409;
      throw conflictError;
    }

    throw error;
  }

  return formatClinic(clinic);
};

const deactivateClinic = async (clinicId) => {
  return deleteClinic(clinicId);
};

module.exports = {
  getClinics,
  getClinicById,
  createClinic,
  updateClinic,
  deleteClinic,
  deactivateClinic,
};
