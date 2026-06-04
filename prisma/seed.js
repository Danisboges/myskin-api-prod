require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/password.util');

// 1. Buat koneksi pool menggunakan pg
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// 2. Hubungkan pool ke Prisma Adapter
const adapter = new PrismaPg(pool);

// 3. Masukkan adapter ke PrismaClient
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Memulai proses seeding...');

  const hashedPassword = await hashPassword('Str0ng!Pass2026', { validate: false });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@melanoma.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'admin@melanoma.com',
      name: 'Super Admin',
      password: hashedPassword,
      role: 'admin',
      gender: 'male',
    },
  });

  console.log('Seeding selesai. User Admin dibuat:', admin.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error saat seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
