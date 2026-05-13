require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

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

<<<<<<< Updated upstream
  console.log('Sedang mengisi data...');

  // ==================== CREATE ADMIN USER ====================
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mail.com' },
    update: {},
    create: {
      email: 'admin@mail.com',
      name: 'Aryo Jaty',
      password: hashedPassword,
      phone: '628134567890',
      role: 'admin',
      gender: 'male',
      birthDate: new Date("1996-04-23T00:00:00Z"),
      status: 'active',
      avatarUrl: '/uploads/users/admin.png'
    },
  });

  console.log('Admin created:', adminUser.id);

  // ==================== CREATE ADMIN SETTINGS ====================
  await prisma.adminSettings.upsert({
    where: { adminId: adminUser.id },
    update: {},
    create: {
      adminId: adminUser.id,
      twoFactorEnabled: false,
      emailNotifications: true,
      verificationAlerts: true,
      dataVisibility: 'restricted_clinical_team_only',
      language: 'English (US)',
    },
  });

  console.log('Admin settings created');

  // ==================== CREATE TEST USERS ====================
  const testUsers = [
    {
      email: 'doctor1@mail.com',
      name: 'Dr. Elena Aris',
      role: 'doctor',
      gender: 'female',
      phone: '628134567891',
      birthDate: new Date("1996-04-23T00:00:00Z"),
      status: 'active',
    },
    {
      email: 'doctor2@mail.com',
      name: 'Dr. Muhammad Rizki',
      role: 'doctor',
      gender: 'male',
      phone: '628134567892',
      birthDate: new Date("1992-08-15T00:00:00Z"),
      status: 'active',
    },
    {
      email: 'patient1@mail.com',
      name: 'Sarah Johnson',
      role: 'patient',
      gender: 'female',
      phone: '628134567893',
      birthDate: new Date("1998-01-15T00:00:00Z"),
      status: 'active',
    },
    {
      email: 'patient2@mail.com',
      name: 'John Doe',
      role: 'patient',
      gender: 'male',
      phone: '628134567894',
      birthDate: new Date("2000-05-20T00:00:00Z"),
      status: 'active',
    },
    {
      email: 'patient3@mail.com',
      name: 'Emma Wilson',
      role: 'patient',
      gender: 'female',
      phone: '628134567895',
      birthDate: new Date("1995-10-10T00:00:00Z"),
      status: 'pending',
    },
  ];

  const createdUsers = [];
  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        password: hashedPassword,
        avatarUrl: `/uploads/users/${userData.email.split('@')[0]}.png`
      },
    });
    createdUsers.push(user);
    console.log(`User created: ${user.email}`);
  }

  // ==================== CREATE DOCTOR PROFILES ====================
  const doctorUsers = createdUsers.filter(u => u.role === 'doctor');
  for (let i = 0; i < doctorUsers.length; i++) {
    const doctor = doctorUsers[i];
    await prisma.doctorProfile.upsert({
      where: { userId: doctor.id },
      update: {},
      create: {
        userId: doctor.id,
        doctorId: `SKN-${2041 + i}`,
        profileImageUrl: `/uploads/doctors/${doctor.email.split('@')[0]}.png`,
        verificationStatus: 'verified',
        practitionerLicense: `ML-${2024}${String(i + 1).padStart(4, '0')}`,
        specialization: 'Senior Dermatologist',
        joinedAt: new Date(),
      },
    });
    console.log(`Doctor profile created for ${doctor.email}`);
  }

  // ==================== CREATE SYSTEM LOGS ====================
  const systemLogs = [
    {
      logId: 'LOG-001',
      title: 'Storage Capacity Warning',
      description: 'Image repository DB-East-1 has exceeded 90% capacity threshold.',
      severity: 'critical',
      category: 'infrastructure',
      metadata: JSON.stringify({ storage: '4.2TB', capacity: '5.0TB' }),
    },
    {
      logId: 'LOG-002',
      title: 'AI Model Update Deployed',
      description: 'Melanoma detection model v4.2.1 successfully deployed to production.',
      severity: 'info',
      category: 'ai_engine',
      metadata: JSON.stringify({ version: '4.2.1', status: 'success' }),
    },
    {
      logId: 'LOG-003',
      title: 'Database Backup Completed',
      description: 'Daily database backup completed successfully.',
      severity: 'info',
      category: 'system',
      metadata: JSON.stringify({ backupSize: '2.1TB', duration: '45min' }),
    },
    {
      logId: 'LOG-004',
      title: 'Security Alert',
      description: 'Multiple failed login attempts detected from IP 192.168.1.100',
      severity: 'warning',
      category: 'security',
      metadata: JSON.stringify({ ip: '192.168.1.100', attempts: 5 }),
    },
  ];

  for (const logData of systemLogs) {
    await prisma.systemLog.upsert({
      where: { logId: logData.logId },
      update: {},
      create: logData,
    });
    console.log(`System log created: ${logData.logId}`);
  }

  // ==================== CREATE AUDIT LOGS ====================
  const auditLogs = [
    {
      auditId: 'AUD-001',
      adminId: adminUser.id,
      adminName: adminUser.name,
      action: 'CREATE_USER',
      description: `Admin created new doctor account Dr. Helena Troy.`,
      targetResourceType: 'user',
      targetResourceId: doctorUsers[0].id,
      ipAddress: '192.168.1.10',
      userAgent: 'Mozilla/5.0',
      status: 'success',
    },
    {
      auditId: 'AUD-002',
      adminId: adminUser.id,
      adminName: adminUser.name,
      action: 'APPROVE_DOCTOR',
      description: `Admin approved doctor Dr. Elena Aris.`,
      targetResourceType: 'doctor',
      targetResourceId: doctorUsers[0].id,
      ipAddress: '192.168.1.10',
      userAgent: 'Mozilla/5.0',
      status: 'success',
    },
    {
      auditId: 'AUD-003',
      adminId: adminUser.id,
      adminName: adminUser.name,
      action: 'UPDATE_SYSTEM_SETTINGS',
      description: `Admin updated system settings.`,
      ipAddress: '192.168.1.10',
      userAgent: 'Mozilla/5.0',
      status: 'success',
    },
  ];

  for (const logData of auditLogs) {
    await prisma.auditLog.upsert({
      where: { auditId: logData.auditId },
      update: {},
      create: logData,
    });
    console.log(`Audit log created: ${logData.auditId}`);
  }

  // ==================== CREATE ADMIN NOTIFICATIONS ====================
  const adminNotifications = [
    {
      notificationId: 'N-001',
      adminId: adminUser.id,
      title: 'New doctor approval request',
      message: 'A new doctor account is waiting for verification.',
      type: 'doctor_approval',
      isRead: false,
    },
    {
      notificationId: 'N-002',
      adminId: adminUser.id,
      title: 'Storage Capacity Warning',
      message: 'Image repository has exceeded 90% capacity threshold.',
      type: 'system_warning',
      isRead: false,
    },
    {
      notificationId: 'N-003',
      adminId: adminUser.id,
      title: 'New user registered',
      message: 'A new user Emma Wilson has registered to the system.',
      type: 'user_management',
      isRead: true,
    },
  ];

  for (const notifData of adminNotifications) {
    await prisma.adminNotification.upsert({
      where: { notificationId: notifData.notificationId },
      update: {},
      create: notifData,
    });
    console.log(`Admin notification created: ${notifData.notificationId}`);
  }

  // ==================== CREATE TEST DETECTIONS ====================
  const patientUsers = createdUsers.filter(u => u.role === 'patient');
  for (const patient of patientUsers.slice(0, 2)) {
    await prisma.detection.create({
      data: {
        imageUrl: '/uploads/detections/sample1.jpg',
        complaint: 'Brown spot on my arm that looks suspicious',
        result: 'Melanoma',
        confidence: 0.87,
        userId: patient.id,
      },
    });
    console.log(`Detection created for ${patient.email}`);
  }

  console.log('✅ Seeding selesai!');
=======
  const admin = await prisma.user.upsert({
    where: { email: 'admin@melanoma.com' },
    update: {},
    create: {
      email: 'admin@melanoma.com',
      name: 'Super Admin',
      password: 'password_hash_disini', // Ganti dengan hash bcrypt
      role: 'admin',
      gender: 'male',
    },
  });

  console.log('Seeding selesai. User Admin dibuat:', admin.email);
>>>>>>> Stashed changes
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
<<<<<<< Updated upstream
    console.error('❌ Error during seeding:', e);
=======
    console.error('Error saat seeding:', e);
>>>>>>> Stashed changes
    await prisma.$disconnect();
    process.exit(1);
  });