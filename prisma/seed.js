const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// 1. Setup koneksi pool
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
const adapter = new PrismaPg(pool);

// 2. Inisialisasi Client dengan adapter (WAJIB di Prisma 7)
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  console.log('Sedang mengisi data...');

  // Membuat Admin
  await prisma.user.upsert({
    where: { email: 'admin@mail.com' },
    update: {},
    create: {
      email: 'admin@mail.com',
      name: 'Admin Melanoma',
      password: hashedPassword,
      phone: '081234567890',
      role: 'admin',
      gender: 'male',
      birthDate: new Date("1990-01-01T00:00:00Z"),
    },
  });

  console.log('Seeding selesai!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });