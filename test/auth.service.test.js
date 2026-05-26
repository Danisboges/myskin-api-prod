const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const prisma = require('../src/config/prisma');
const {
  loginUser,
  loginWithGoogleProfile,
  requestPasswordReset,
  resetPassword,
} = require('../src/services/auth.service');

const createdUserIds = [];

const createDoctor = async (verificationStatus) => {
  const stamp = `${verificationStatus}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const password = 'password123';
  const user = await prisma.user.create({
    data: {
      name: `Doctor ${verificationStatus}`,
      email: `doctor.${stamp}@example.com`,
      password: await bcrypt.hash(password, 10),
      role: 'doctor',
      gender: 'female',
      status: verificationStatus === 'verified' ? 'active' : 'pending',
      doctorProfile: {
        create: {
          verificationStatus,
          practitionerLicense: `LIC-${stamp}`,
          specialization: 'Dermatology',
        },
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  createdUserIds.push(user.id);
  return { ...user, password };
};

const createNonDoctor = async (role) => {
  const stamp = `${role}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const password = 'password123';
  const user = await prisma.user.create({
    data: {
      name: `${role} user`,
      email: `${role}.${stamp}@example.com`,
      password: await bcrypt.hash(password, 10),
      role,
      gender: 'male',
      status: 'active',
      ...(role === 'patient' && {
        patientProfile: {
          create: {},
        },
      }),
    },
    select: {
      id: true,
      email: true,
    },
  });

  createdUserIds.push(user.id);
  return { ...user, password };
};

const createGoogleDoctor = async (verificationStatus) => {
  const stamp = `google.${verificationStatus}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      name: `Google Doctor ${verificationStatus}`,
      email: `doctor.${stamp}@example.com`,
      googleId: `google-${stamp}`,
      password: await bcrypt.hash('password123', 10),
      role: 'doctor',
      gender: 'female',
      status: verificationStatus === 'verified' ? 'active' : 'pending',
      doctorProfile: {
        create: {
          verificationStatus,
          practitionerLicense: `LIC-${stamp}`,
          specialization: 'Dermatology',
        },
      },
    },
    select: {
      id: true,
      email: true,
      googleId: true,
    },
  });

  createdUserIds.push(user.id);
  return user;
};

test.after(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }
  await prisma.$disconnect();
});

test('verified doctor can login and receives verificationStatus', async () => {
  const doctor = await createDoctor('verified');
  const result = await loginUser(doctor.email, doctor.password);

  assert.equal(result.role, 'doctor');
  assert.equal(result.verificationStatus, 'verified');
  assert.equal(typeof result.token, 'string');
});

test('pending doctor is rejected before token issuance', async () => {
  const doctor = await createDoctor('pending');

  await assert.rejects(
    loginUser(doctor.email, doctor.password),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun dokter Anda masih menunggu verifikasi admin.');
      return true;
    }
  );
});

test('rejected doctor is rejected before token issuance', async () => {
  const doctor = await createDoctor('rejected');

  await assert.rejects(
    loginUser(doctor.email, doctor.password),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun dokter Anda ditolak. Silakan hubungi admin untuk informasi lebih lanjut.');
      return true;
    }
  );
});

test('patient login behavior remains unchanged', async () => {
  const patient = await createNonDoctor('patient');
  const result = await loginUser(patient.email, patient.password);

  assert.equal(result.role, 'patient');
  assert.equal(typeof result.token, 'string');
  assert.equal('verificationStatus' in result, false);
});

test('admin login behavior remains unchanged', async () => {
  const admin = await createNonDoctor('admin');
  const result = await loginUser(admin.email, admin.password);

  assert.equal(result.role, 'admin');
  assert.equal(typeof result.token, 'string');
  assert.equal('verificationStatus' in result, false);
});

test('forgot password issues token and reset password updates credentials', async () => {
  const patient = await createNonDoctor('patient');
  const resetRequest = await requestPasswordReset(patient.email);

  assert.equal(resetRequest.message, 'Jika email terdaftar, instruksi reset password akan dikirim.');
  assert.equal(typeof resetRequest.resetToken, 'string');

  const resetResult = await resetPassword(resetRequest.resetToken, 'newpassword123');
  assert.equal(resetResult.message, 'Password berhasil direset');

  await assert.rejects(loginUser(patient.email, patient.password));

  const loginResult = await loginUser(patient.email, 'newpassword123');
  assert.equal(loginResult.role, 'patient');
  assert.equal(typeof loginResult.token, 'string');
});

test('forgot password uses generic response for unknown email', async () => {
  const result = await requestPasswordReset(`missing.${Date.now()}@example.com`);

  assert.equal(result.message, 'Jika email terdaftar, instruksi reset password akan dikirim.');
  assert.equal('resetToken' in result, false);
});

test('existing patient can login with Google', async () => {
  const patient = await createNonDoctor('patient');
  const result = await loginWithGoogleProfile({
    email: patient.email,
    name: 'Google Patient',
    googleId: `google-${patient.id}`,
  });

  assert.equal(result.role, 'patient');
  assert.equal(typeof result.token, 'string');

  const linkedPatient = await prisma.user.findUnique({
    where: { id: patient.id },
    select: { googleId: true },
  });
  assert.equal(linkedPatient.googleId, `google-${patient.id}`);
});

test('existing verified doctor can login with Google', async () => {
  const doctor = await createGoogleDoctor('verified');
  const result = await loginWithGoogleProfile({
    email: doctor.email,
    name: 'Verified Google Doctor',
    googleId: doctor.googleId,
  });

  assert.equal(result.role, 'doctor');
  assert.equal(result.verificationStatus, 'verified');
  assert.equal(typeof result.token, 'string');
});

test('pending doctor is rejected from Google login', async () => {
  const doctor = await createGoogleDoctor('pending');

  await assert.rejects(
    loginWithGoogleProfile({
      email: doctor.email,
      name: 'Pending Google Doctor',
      googleId: doctor.googleId,
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun dokter Anda masih menunggu verifikasi admin.');
      return true;
    }
  );
});

test('rejected doctor is rejected from Google login', async () => {
  const doctor = await createGoogleDoctor('rejected');

  await assert.rejects(
    loginWithGoogleProfile({
      email: doctor.email,
      name: 'Rejected Google Doctor',
      googleId: doctor.googleId,
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun dokter Anda ditolak. Silakan hubungi admin untuk informasi lebih lanjut.');
      return true;
    }
  );
});

test('new Google user is created as patient', async () => {
  const stamp = Date.now();
  const result = await loginWithGoogleProfile({
    email: `new.google.${stamp}@example.com`,
    name: 'New Google User',
    googleId: `google-new-${stamp}`,
  });

  createdUserIds.push(result.id);
  assert.equal(result.role, 'patient');
  assert.equal(typeof result.token, 'string');

  const createdUser = await prisma.user.findUnique({
    where: { id: result.id },
    include: {
      patientProfile: {
        include: {
          settings: true,
        },
      },
    },
  });

  assert.equal(createdUser.role, 'patient');
  assert.equal(createdUser.gender, null);
  assert.equal(createdUser.patientProfile.settings.theme, 'light');
});
