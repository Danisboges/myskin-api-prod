const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = 'false';

const prisma = require('../src/config/prisma');
const doctorRoutes = require('../src/routes/doctor.route');
const emailService = require('../src/services/email.service');
const doctorNotificationService = require('../src/services/doctor-notification.service');

const createdUserIds = [];
const sentDoctorEmails = [];
const originalSendDoctorNotificationEmail = emailService.sendDoctorNotificationEmail;

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/doctor', doctorRoutes);
  return app;
};

const request = async (app, { method, path, token }) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      method,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    }, (res) => {
      let rawBody = '';
      res.on('data', (chunk) => {
        rawBody += chunk;
      });
      res.on('end', () => {
        server.close(() => {
          resolve({
            statusCode: res.statusCode,
            body: rawBody ? JSON.parse(rawBody) : null,
          });
        });
      });
    });

    req.on('error', (error) => {
      server.close(() => reject(error));
    });
    req.end();
  });
});

const createToken = (user) => jwt.sign(
  { id: user.id, name: user.name, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

async function createDoctor({ verificationAlerts = true, emailNotifications = true } = {}) {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name: `Notification Doctor ${token}`,
      email: `notification.doctor.${token}@example.com`,
      password: await bcrypt.hash('Str0ng!Pass2026', 10),
      role: 'doctor',
      gender: 'female',
      status: 'active',
      doctorProfile: {
        create: {
          verificationStatus: 'verified',
          practitionerLicense: `NOTIF-LIC-${token}`,
          specialization: 'Dermatology',
          settings: {
            create: {
              emailNotifications,
              verificationAlerts,
              twoFactorEnabled: false,
              dataVisibility: 'restricted_clinical_team_only',
              language: 'English (US)',
            },
          },
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  createdUserIds.push(user.id);
  return user;
}

async function createVerificationEvent(doctor, title = 'New verification case') {
  return doctorNotificationService.createDoctorNotification({
    doctorId: doctor.doctorProfile.id,
    title,
    message: 'A patient case requires verification review.',
    type: 'verification_alert',
    metadata: {
      source: 'doctor-notification-settings-test',
    },
  });
}

test.beforeEach(() => {
  sentDoctorEmails.length = 0;
  emailService.sendDoctorNotificationEmail = async (payload) => {
    sentDoctorEmails.push(payload);
    return { messageId: `test-email-${sentDoctorEmails.length}` };
  };
});

test.afterEach(() => {
  emailService.sendDoctorNotificationEmail = originalSendDoctorNotificationEmail;
});

test.after(async () => {
  if (createdUserIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { doctor: { userId: { in: createdUserIds } } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }

  await prisma.$disconnect();
});

test('doctor dengan verificationAlerts true menerima in-app notification saat event dibuat', async () => {
  const doctor = await createDoctor({ verificationAlerts: true, emailNotifications: false });

  const result = await createVerificationEvent(doctor);

  assert.equal(result.inAppNotificationCreated, true);
  assert.equal(result.emailNotificationQueued, false);
  assert.equal(await prisma.notification.count({
    where: {
      doctorId: doctor.doctorProfile.id,
      type: 'verification_alert',
    },
  }), 1);
});

test('doctor dengan verificationAlerts false tidak menerima in-app notification', async () => {
  const doctor = await createDoctor({ verificationAlerts: false, emailNotifications: false });

  const result = await createVerificationEvent(doctor);

  assert.equal(result.inAppNotificationCreated, false);
  assert.equal(result.emailNotificationQueued, false);
  assert.equal(await prisma.notification.count({
    where: {
      doctorId: doctor.doctorProfile.id,
      type: 'verification_alert',
    },
  }), 0);
});

test('doctor dengan emailNotifications true membuat email queue/send terpisah dari in-app alert', async () => {
  const doctor = await createDoctor({ verificationAlerts: false, emailNotifications: true });

  const result = await createVerificationEvent(doctor);

  assert.equal(result.inAppNotificationCreated, false);
  assert.equal(result.emailNotificationQueued, true);
  assert.equal(sentDoctorEmails.length, 1);
  assert.equal(sentDoctorEmails[0].to, doctor.email);
  assert.equal(sentDoctorEmails[0].type, 'verification_alert');
});

test('doctor dengan emailNotifications false tidak membuat email queue/send', async () => {
  const doctor = await createDoctor({ verificationAlerts: true, emailNotifications: false });

  const result = await createVerificationEvent(doctor);

  assert.equal(result.inAppNotificationCreated, true);
  assert.equal(result.emailNotificationQueued, false);
  assert.equal(sentDoctorEmails.length, 0);
});

test('GET /api/v1/doctor/notifications hanya menampilkan notification doctor login', async () => {
  const doctorA = await createDoctor({ verificationAlerts: true, emailNotifications: false });
  const doctorB = await createDoctor({ verificationAlerts: true, emailNotifications: false });
  const titleA = `Visible notification ${stamp()}`;
  const titleB = `Hidden notification ${stamp()}`;

  await createVerificationEvent(doctorA, titleA);
  await createVerificationEvent(doctorB, titleB);

  const response = await request(createApp(), {
    method: 'GET',
    path: '/api/v1/doctor/notifications',
    token: createToken(doctorA),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'success');
  assert.ok(response.body.data.some((notification) => notification.title === titleA));
  assert.equal(response.body.data.some((notification) => notification.title === titleB), false);
});
