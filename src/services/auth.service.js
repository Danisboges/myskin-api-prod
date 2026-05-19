const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
        // Masukkan pengaturan (settings) DI DALAM profil pasien
        settings: {
          create: {}
        }
      } 
    };
  } else if (assignedRole === 'doctor') {
    prismaData.doctorProfile = {
      create: {
        clinicId: clinicId || undefined,
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
    return await prisma.user.create({
      data: prismaData,
      select: { 
        id: true, 
        name: true, 
        email: true, 
        role: true, 
        status: true,
        createdAt: true, 
      }
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
    where: { email: email.trim().toLowerCase() }
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }
  
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return { token, id: user.id, name: user.name, email: user.email, role: user.role };
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

module.exports = { registerUser, loginUser /*, getAllUsers, getUserById */ };
