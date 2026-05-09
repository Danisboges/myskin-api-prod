const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registerUser = async (userData) => {
  const { name, email, password, phone, role, gender, birthDate } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);

  return await prisma.user.create({
    data: { name, email, password: hashedPassword, phone, role: role || 'user', gender, birthDate },
    select: { id: true, name: true, email: true, role: true, phone: true, gender: true, birthDate: true, createdAt: true }
  });
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