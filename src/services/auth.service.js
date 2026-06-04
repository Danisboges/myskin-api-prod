const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const emailService = require('./email.service');
const {
  validateAndNormalizeEmail,
  ensureEmailAvailable,
} = require('../utils/email.util');
const {
  isMaintenanceModeActive,
  createMaintenanceError,
} = require('../utils/maintenance.util');
const {
  createAdminNotificationForEnabledAdmins,
} = require('./admin-notification.service');
const systemLogService = require('./system-log.service');
const {
  hashPassword,
  verifyPassword,
  assertStrongPassword,
  generateSecureTemporaryPassword,
} = require('../utils/password.util');

const formatRegisteredUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  ...(user.doctorProfile && {
    doctorProfile: {
      clinicId: user.doctorProfile.clinicId,
      clinicName: user.doctorProfile.clinic?.name || null,
      verificationStatus: user.doctorProfile.verificationStatus,
      specialization: user.doctorProfile.specialization,
      clinic: user.doctorProfile.clinic ? {
        clinicId: user.doctorProfile.clinic.clinicId,
        name: user.doctorProfile.clinic.name,
        address: user.doctorProfile.clinic.address,
        phone: user.doctorProfile.clinic.phone,
        email: user.doctorProfile.clinic.email,
      } : null,
    },
  }),
});

const registerUser = async (userData) => {
  const {
    email,
    password,
    role,
    gender,
    birthDate,
    specialization,
    clinicId,
  } = userData;

  const name = userData.name || userData.fullName;
  const phone = userData.phone || userData.phoneNumber;
  const practitionerLicense = userData.practitionerLicense || userData.licenseNumber;
  const assignedRole = role || 'patient';

  const normalizedEmail = validateAndNormalizeEmail(email);

  // 1. Validasi input wajib
  if (!name || !password || !gender) {
    throw new Error("name, password, dan gender harus disediakan");
  }

  // 2. Cek email unik sebelum memproses lebih jauh
  await ensureEmailAvailable(prisma, normalizedEmail);

  let selectedClinic = null;
  if (assignedRole === 'doctor') {
    if (!clinicId || typeof clinicId !== 'string' || clinicId.trim().length === 0) {
      const error = new Error("clinicId harus disediakan untuk registrasi dokter");
      error.status = 400;
      throw error;
    }

    selectedClinic = await prisma.clinic.findUnique({
      where: { clinicId: clinicId.trim() },
      select: { clinicId: true, isActive: true },
    });

    if (!selectedClinic || !selectedClinic.isActive) {
      const error = new Error("Clinic tidak ditemukan atau tidak aktif");
      error.status = 400;
      throw error;
    }
  }

  // 3. Persiapan data
  const hashedPassword = await hashPassword(password, {
    email: normalizedEmail,
    name,
  });
  
  // Pastikan gender sesuai enum (male/female)
  const normalizedGender = gender.toLowerCase();
  if (normalizedGender !== 'male' && normalizedGender !== 'female') {
    throw new Error("Gender harus 'male' atau 'female'");
  }

  // 4. Bangun objek data Prisma
  // Gunakan undefined agar Prisma menggunakan @default dari schema
  const prismaData = {
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: assignedRole,
    gender: normalizedGender,
    phone: phone || undefined,
    birthDate: birthDate ? new Date(birthDate) : undefined,
    status: assignedRole === 'doctor' ? 'pending' : 'active',
  };

  // 5. Tambahkan nested create profil secara dinamis
  if (assignedRole === 'patient') {
    prismaData.patientProfile = {
      create: {
        settings: {
          create: {
            twoFactorEnabled: false,
            emailNotifications: true,
            scanNotifications: true,
            reportNotifications: true,
            dataVisibility: 'restricted_self_only',
            language: 'English (US)',
            theme: 'light',
          },
        },
      },
    };
  } else if (assignedRole === 'doctor') {
    prismaData.doctorProfile = {
      create: {
        clinicId: selectedClinic.clinicId,
        verificationStatus: 'pending',
        practitionerLicense: practitionerLicense ? practitionerLicense.trim() : undefined,
        licenseFile: userData.medicalLicense || undefined,
        specialization: specialization ? specialization.trim() : undefined,
        settings: {
          create: {}
        }
      },
    };
  } else if (assignedRole === 'admin') {
    prismaData.adminSettings = {
      create: {}
    };
  }

  try {
    const user = await prisma.user.create({
      data: prismaData,
      select: { 
        id: true, 
        name: true, 
        email: true, 
        role: true, 
        status: true,
        createdAt: true,
        doctorProfile: {
          select: {
            clinicId: true,
            verificationStatus: true,
            specialization: true,
            clinic: {
              select: {
                clinicId: true,
                name: true,
                address: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      }
    });

    if (assignedRole === 'doctor') {
      await createAdminNotificationForEnabledAdmins(
        'doctor_approval',
        'New doctor approval request',
        `${user.name} is waiting for approval`,
        'doctorApprovalAlerts',
        { doctorId: user.id }
      );
    }

    return formatRegisteredUser(user);
  } catch (error) {
    // Jika masih error 'not available', kemungkinan besar DB belum di-migrate reset
    console.error("DEBUG DB ERROR:", error);
    throw new Error(`Database menolak data: ${error.message}`);
  }
};

const createFailedLoginSystemLog = async (email, ipAddress) => {
  if (!email) {
    return null;
  }

  return systemLogService.createSystemLog({
    severity: "warning",
    category: "security",
    title: "Failed login attempt",
    description: "Invalid login credentials submitted",
    metadata: {
      email,
      ipAddress,
    },
  });
};

const loginUser = async (email, password, context = {}) => {
  if (!email || !password) {
    throw new Error("Email dan password harus disediakan");
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: userDataForLoginInclude(),
  });

  if (!user) {
    await createFailedLoginSystemLog(email, context.ipAddress);
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await verifyPassword(password, user.password);
  if (!isPasswordValid) {
    await createFailedLoginSystemLog(email, context.ipAddress);
    throw new Error("Invalid email or password");
  }

  if (user.role === 'doctor') {
    assertDoctorCanLogin(user.doctorProfile?.verificationStatus);
  }

  assertUserIsActive(user.status);

  if (user.role !== 'admin' && await isMaintenanceModeActive()) {
    throw createMaintenanceError();
  }
  
  const token = createAuthToken(user);

  return {
    token,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.role === 'doctor' && {
      verificationStatus: user.doctorProfile.verificationStatus,
    }),
  };
};

const assertUserIsActive = (status) => {
  if (status === 'active') {
    return status;
  }

  const error = new Error('Akun Anda tidak aktif. Silakan hubungi administrator.');
  error.status = 403;
  throw error;
};

const userDataForLoginInclude = () => ({
  doctorProfile: {
    select: {
      verificationStatus: true,
    },
  },
});

const assertDoctorCanLogin = (verificationStatus) => {
  const normalizedStatus = verificationStatus || 'pending';

  if (normalizedStatus === 'verified') {
    return normalizedStatus;
  }

  const error = new Error(
    normalizedStatus === 'rejected'
      ? 'Akun dokter Anda ditolak. Silakan hubungi admin untuk informasi lebih lanjut.'
      : 'Akun dokter Anda masih menunggu verifikasi admin.'
  );
  error.status = 403;
  throw error;
};

const createAuthToken = (user) => jwt.sign(
  { id: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

const hashPasswordResetToken = (token) => (
  crypto.createHash('sha256').update(token).digest('hex')
);

const requestPasswordReset = async (email) => {
  if (!email || typeof email !== 'string') {
    const error = new Error('Email harus disediakan');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true }
  });

  const genericMessage = 'Jika email terdaftar, instruksi reset password akan dikirim.';

  if (!user) {
    return { message: genericMessage };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const passwordResetToken = hashPasswordResetToken(resetToken);
  const passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken,
      passwordResetExpires
    }
  });

  const resetUrl = emailService.buildPasswordResetUrl(resetToken);

  try {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresAt: passwordResetExpires
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
    return { message: genericMessage };
  }

  const result = { message: genericMessage };

  if (process.env.NODE_ENV !== 'production') {
    result.resetToken = resetToken;
    result.resetUrl = resetUrl;
    result.expiresAt = passwordResetExpires;
  }

  return result;
};

const resetPassword = async (token, password) => {
  if (!token || typeof token !== 'string') {
    const error = new Error('Token reset password harus disediakan');
    error.status = 400;
    throw error;
  }

  assertStrongPassword(password);

  const passwordResetToken = hashPasswordResetToken(token.trim());
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken,
      passwordResetExpires: {
        gt: new Date()
      }
    },
    select: {
      id: true,
      password: true
    }
  });

  if (!user) {
    const error = new Error('Token reset password tidak valid atau sudah kadaluarsa');
    error.status = 400;
    throw error;
  }

  const isSamePassword = await verifyPassword(password, user.password);
  if (isSamePassword) {
    const error = new Error('Password baru harus berbeda dari password sebelumnya');
    error.status = 400;
    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(password, { validate: false }),
      passwordResetToken: null,
      passwordResetExpires: null
    }
  });

  return { message: 'Password berhasil direset' };
};

const createGoogleOAuthState = () => jwt.sign(
  { nonce: crypto.randomBytes(16).toString('hex') },
  process.env.JWT_SECRET,
  { expiresIn: '10m' }
);

const verifyGoogleOAuthState = (state) => {
  if (!state) {
    const error = new Error('Google OAuth state is missing');
    error.status = 400;
    throw error;
  }

  try {
    return jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    const error = new Error('Google OAuth state is invalid or expired');
    error.status = 400;
    throw error;
  }
};

const getGoogleAuthorizationUrl = () => {
  const requiredEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CALLBACK_URL'];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing Google OAuth configuration: ${missingEnv.join(', ')}`);
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: createGoogleOAuthState(),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

const getGoogleProfileFromCode = async (code, state) => {
  verifyGoogleOAuthState(state);

  const requiredEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing Google OAuth configuration: ${missingEnv.join(', ')}`);
  }

  const tokenResponse = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const profileResponse = await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenResponse.data.access_token}`,
    },
  });

  return {
    email: profileResponse.data.email,
    name: profileResponse.data.name,
    googleId: profileResponse.data.sub,
  };
};

const loginWithGoogleProfile = async ({ email, name, googleId }) => {
  if (!email || !name || !googleId) {
    throw new Error('Google profile is incomplete');
  }

  const normalizedEmail = validateAndNormalizeEmail(email);

  let user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
    include: userDataForLoginInclude(),
  });

  if (!user) {
    const randomPassword = generateSecureTemporaryPassword();
    user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        googleId,
        password: await hashPassword(randomPassword, { validate: false }),
        role: 'patient',
        status: 'active',
        patientProfile: {
          create: {
            settings: {
              create: {
                twoFactorEnabled: false,
                emailNotifications: true,
                scanNotifications: true,
                reportNotifications: true,
                dataVisibility: 'restricted_self_only',
                language: 'English (US)',
                theme: 'light',
              },
            },
          },
        },
      },
      include: userDataForLoginInclude(),
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId },
      include: userDataForLoginInclude(),
    });
  }

  if (user.role === 'doctor') {
    assertDoctorCanLogin(user.doctorProfile?.verificationStatus);
  }

  assertUserIsActive(user.status);

  if (user.role !== 'admin' && await isMaintenanceModeActive()) {
    throw createMaintenanceError();
  }

  return {
    token: createAuthToken(user),
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.role === 'doctor' && {
      verificationStatus: user.doctorProfile.verificationStatus,
    }),
  };
};

// Tambahkan fungsi lain agar konsisten dengan gaya yang Anda minta
// const getAllUsers = async () => {
//   return await prisma.user.findMany({
//     select: { id: true, nama: true, email: true, role: true }
//   });
// };

// const getUserById = async (id) => {
//   const user = await prisma.user.findUnique({
//     where: { id },
//     select: { 
//       id: true, 
//       nama: true, 
//       email: true, 
//       role: true,
//       createdAt: true // Tambahkan jika ingin melihat kapan user dibuat
//     }
//   });

//   if (!user) {
//     throw new Error("User tidak ditemukan");
//   }

//   return user;
// };

module.exports = {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
  getGoogleAuthorizationUrl,
  getGoogleProfileFromCode,
  loginWithGoogleProfile,
  /*, getAllUsers, getUserById */
};
