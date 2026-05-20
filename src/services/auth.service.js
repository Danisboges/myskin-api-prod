const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');

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

  // 1. Validasi input wajib
  if (!name || !email || !password || !gender) {
    throw new Error("name, email, password, dan gender harus disediakan");
  }

  if (assignedRole === 'doctor' && (!specialization || !practitionerLicense)) {
    throw new Error("specialization dan licenseNumber harus disediakan untuk register doctor");
  }

  // 2. Cek email unik sebelum memproses lebih jauh
  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingUser) throw new Error("Email sudah terdaftar");

  // 3. Persiapan data
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Pastikan gender sesuai enum (male/female)
  const normalizedGender = gender.toLowerCase();
  if (normalizedGender !== 'male' && normalizedGender !== 'female') {
    throw new Error("Gender harus 'male' atau 'female'");
  }

  // 4. Bangun objek data Prisma
  // Gunakan undefined agar Prisma menggunakan @default dari schema
  const prismaData = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
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
        clinicId: clinicId || undefined,
        verificationStatus: 'pending',
        practitionerLicense: practitionerLicense.trim(),
        licenseFile: userData.medicalLicense || undefined,
        specialization: specialization.trim(),
      },
    };
  } 

  try {
    // Build select statement conditionally based on role
    const selectStatement = { 
      id: true, 
      name: true, 
      email: true, 
      role: true, 
      status: true,
      createdAt: true,
    };

    // Only select doctorProfile if role is doctor
    if (assignedRole === 'doctor') {
      selectStatement.doctorProfile = {
        select: {
          id: true,
          clinicId: true,
          verificationStatus: true,
          practitionerLicense: true,
          licenseFile: true,
          specialization: true,
          joinedAt: true,
        },
      };
    }

    // Only select patientProfile if role is patient
    if (assignedRole === 'patient') {
      selectStatement.patientProfile = {
        select: {
          id: true,
        },
      };
    }

    return await prisma.user.create({
      data: prismaData,
      select: selectStatement,
    });
  } catch (error) {
    // Jika masih error 'not available', kemungkinan besar DB belum di-migrate reset
    console.error("DEBUG DB ERROR:", error);
    throw new Error(`Database menolak data: ${error.message}`);
  }
};

const loginUser = async (email, password) => {
  if (!email || !password) {
    throw new Error("Email dan password harus disediakan");
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: userDataForLoginInclude(),
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  if (user.role === 'doctor') {
    assertDoctorCanLogin(user.doctorProfile?.verificationStatus);
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

  let user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: userDataForLoginInclude(),
  });

  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString('hex');
    user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        googleId,
        password: await bcrypt.hash(randomPassword, 10),
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
  getGoogleAuthorizationUrl,
  getGoogleProfileFromCode,
  loginWithGoogleProfile,
  /*, getAllUsers, getUserById */
};
