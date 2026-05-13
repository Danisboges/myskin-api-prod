const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registerUser = async (userData) => {
  const { name, email, password, phone, role, gender, birthDate } = userData;
<<<<<<< Updated upstream
  const hashedPassword = await bcrypt.hash(password, 10);

  return await prisma.user.create({
    data: { name, email, password: hashedPassword, phone, role: role || 'user', gender, birthDate },
    select: { id: true, name: true, email: true, role: true, phone: true, gender: true, birthDate: true, createdAt: true }
  });
=======

  // 1. Validasi input wajib
  if (!name || !email || !password || !gender) {
    throw new Error("name, email, password, dan gender harus disediakan");
  }

  // 2. Cek email unik sebelum memproses lebih jauh
  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingUser) throw new Error("Email sudah terdaftar");

  // 3. Persiapan data
  const hashedPassword = await bcrypt.hash(password, 10);
  const assignedRole = role || 'patient';
  
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
    status: 'active', // Berikan nilai eksplisit untuk menghindari bug default di beberapa versi DB
  };

  // 5. Tambahkan nested create profil secara dinamis
  if (assignedRole === 'patient') {
    prismaData.patientProfile = { create: {} };
  } else if (assignedRole === 'doctor') {
    // Di schema baru, semua field DoctorProfile opsional/default
    prismaData.doctorProfile = { create: {} };
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
        createdAt: true 
      }
    });
  } catch (error) {
    // Jika masih error 'not available', kemungkinan besar DB belum di-migrate reset
    console.error("DEBUG DB ERROR:", error);
    throw new Error(`Database menolak data: ${error.message}`);
  }
>>>>>>> Stashed changes
};

const loginUser = async (email, password) => {
  // Log 1: Cek apakah email masuk
  
  const user = await prisma.user.findUnique({ where: { email } });
    const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return { token, role: user.role };
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