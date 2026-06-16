const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MAINTENANCE_MODE_TEST_OVERRIDE = 'false';
process.env.ADMIN_NOTIFICATION_TEST_DISABLE = 'true';

const prisma = require('../src/config/prisma');
const emailService = require('../src/services/email.service');
const {
  registerUser,
  loginUser,
  loginWithGoogleProfile,
  requestPasswordReset,
  resetPassword,
  getGoogleAuthorizationUrl,
  getGoogleCallbackUrl,
} = require('../src/services/auth.service');

const createdUserIds = [];
const createdClinicIds = [];
const createdUserEmails = [];
const sentPasswordResetEmails = [];
const originalSendPasswordResetEmail = emailService.sendPasswordResetEmail;

test.beforeEach(() => {
  sentPasswordResetEmails.length = 0;
  process.env.FRONTEND_URL = 'http://localhost:5173';
  emailService.sendPasswordResetEmail = async (payload) => {
    sentPasswordResetEmails.push(payload);
    return { messageId: 'test-message-id' };
  };
});

const createDoctor = async (verificationStatus, status = verificationStatus === 'verified' ? 'active' : 'pending') => {
  const stamp = `${verificationStatus}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const password = 'Str0ng!Pass2026';
  const user = await prisma.user.create({
    data: {
      name: `Doctor ${verificationStatus}`,
      email: `doctor.${stamp}@example.com`,
      password: await bcrypt.hash(password, 10),
      role: 'doctor',
      gender: 'female',
      status,
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
  createdUserEmails.push(user.email);
  return { ...user, password };
};

const createNonDoctor = async (role, status = 'active') => {
  const stamp = `${role}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const password = 'Str0ng!Pass2026';
  const user = await prisma.user.create({
    data: {
      name: `${role} user`,
      email: `${role}.${stamp}@example.com`,
      password: await bcrypt.hash(password, 10),
      role,
      gender: 'male',
      status,
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
  createdUserEmails.push(user.email);
  return { ...user, password };
};

const createGoogleDoctor = async (verificationStatus, status = verificationStatus === 'verified' ? 'active' : 'pending') => {
  const stamp = `google.${verificationStatus}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      name: `Google Doctor ${verificationStatus}`,
      email: `doctor.${stamp}@example.com`,
      googleId: `google-${stamp}`,
      password: await bcrypt.hash('Str0ng!Pass2026', 10),
      role: 'doctor',
      gender: 'female',
      status,
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
  createdUserEmails.push(user.email);
  return user;
};

const createClinic = async () => {
  const stamp = `auth.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const clinic = await prisma.clinic.create({
    data: {
      name: `Auth Clinic ${stamp}`,
      email: `auth.clinic.${stamp}@example.com`,
    },
    select: {
      clinicId: true,
      name: true,
    },
  });

  createdClinicIds.push(clinic.clinicId);
  return clinic;
};

test.after(async () => {
  emailService.sendPasswordResetEmail = originalSendPasswordResetEmail;

  for (const email of createdUserEmails) {
    await prisma.systemLog.deleteMany({
      where: {
        title: 'Failed login attempt',
        metadata: { contains: email },
      },
    });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }

  if (createdClinicIds.length > 0) {
    await prisma.clinic.deleteMany({
      where: { clinicId: { in: createdClinicIds } },
    });
  }

  await prisma.$disconnect();
});

test('doctor registration requires an active clinic and returns clinic info', async () => {
  const clinic = await createClinic();
  const stamp = Date.now();

  const result = await registerUser({
    fullName: 'Registered Doctor',
    email: `registered.doctor.${stamp}@example.com`,
    password: 'Str0ng!Pass2026',
    role: 'doctor',
    gender: 'female',
    clinicId: clinic.clinicId,
    specialization: 'Dermatology',
    licenseNumber: `LIC-${stamp}`,
  });

  createdUserIds.push(result.id);

  assert.equal(result.role, 'doctor');
  assert.equal(result.status, 'pending');
  assert.equal(result.doctorProfile.clinicId, clinic.clinicId);
  assert.equal(result.doctorProfile.clinicName, clinic.name);
  assert.equal(result.doctorProfile.clinic.name, clinic.name);
});

test('doctor registration rejects missing clinicId', async () => {
  await assert.rejects(
    registerUser({
      fullName: 'Doctor Without Clinic',
      email: `doctor.no.clinic.${Date.now()}@example.com`,
      password: 'Str0ng!Pass2026',
      role: 'doctor',
      gender: 'male',
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, 'clinicId harus disediakan untuk registrasi dokter');
      return true;
    }
  );
});

test('registerUser normalizes email before storing', async () => {
  const stamp = Date.now();
  const result = await registerUser({
    fullName: 'Normalized Patient',
    email: `  Normalized.Patient.${stamp}@Example.COM  `,
    password: 'Str0ng!Pass2026',
    role: 'patient',
    gender: 'female',
  });

  createdUserIds.push(result.id);

  assert.equal(result.email, `normalized.patient.${stamp}@example.com`);

  const storedUser = await prisma.user.findUnique({
    where: { id: result.id },
    select: { email: true },
  });
  assert.equal(storedUser.email, `normalized.patient.${stamp}@example.com`);
});

test('registerUser rejects duplicate email case-insensitively', async () => {
  const stamp = Date.now();
  const result = await registerUser({
    fullName: 'Duplicate Patient',
    email: `duplicate.patient.${stamp}@example.com`,
    password: 'Str0ng!Pass2026',
    role: 'patient',
    gender: 'male',
  });

  createdUserIds.push(result.id);

  await assert.rejects(
    registerUser({
      fullName: 'Duplicate Patient Two',
      email: `DUPLICATE.PATIENT.${stamp}@EXAMPLE.COM`,
      password: 'Str0ng!Pass2026',
      role: 'patient',
      gender: 'female',
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, 'Email sudah terdaftar');
      return true;
    }
  );
});

test('verified doctor can login and receives verificationStatus', async () => {
  const doctor = await createDoctor('verified');
  const result = await loginUser(doctor.email, doctor.password);

  assert.equal(result.role, 'doctor');
  assert.equal(result.verificationStatus, 'verified');
  assert.equal(typeof result.token, 'string');
});

test('approved doctor can login for backward-compatible verification status', async () => {
  const doctor = await createDoctor('approved', 'active');
  const result = await loginUser(doctor.email, doctor.password);

  assert.equal(result.role, 'doctor');
  assert.equal(result.verificationStatus, 'approved');
  assert.equal(result.doctorProfile.status, 'approved');
  assert.equal(result.doctorProfile.practitionerStatus.status, 'approved');
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

test('inactive admin cannot login', async () => {
  const admin = await createNonDoctor('admin', 'inactive');

  await assert.rejects(
    loginUser(admin.email, admin.password),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun Anda tidak aktif. Silakan hubungi administrator.');
      return true;
    }
  );
});

test('inactive patient cannot login', async () => {
  const patient = await createNonDoctor('patient', 'inactive');

  await assert.rejects(
    loginUser(patient.email, patient.password),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun Anda tidak aktif. Silakan hubungi administrator.');
      return true;
    }
  );
});

test('inactive verified doctor cannot login', async () => {
  const doctor = await createDoctor('verified', 'inactive');

  await assert.rejects(
    loginUser(doctor.email, doctor.password),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun Anda tidak aktif. Silakan hubungi administrator.');
      return true;
    }
  );
});

test('invalid password does not reveal inactive account status', async () => {
  const patient = await createNonDoctor('patient', 'inactive');

  await assert.rejects(
    loginUser(patient.email, 'wrongpassword'),
    (error) => {
      assert.equal(error.status, undefined);
      assert.equal(error.message, 'Invalid email or password');
      return true;
    }
  );
});

test('failed login creates security warning system log when email is provided', async () => {
  const patient = await createNonDoctor('patient');

  await assert.rejects(
    loginUser(patient.email, 'wrongpassword', { ipAddress: '127.0.0.55' }),
    /Invalid email or password/
  );

  const log = await prisma.systemLog.findFirst({
    where: {
      title: 'Failed login attempt',
      severity: 'warning',
      category: 'security',
      metadata: { contains: patient.email },
    },
    orderBy: { createdAt: 'desc' },
  });

  assert.ok(log);
  assert.deepEqual(JSON.parse(log.metadata), {
    email: patient.email,
    ipAddress: '127.0.0.55',
  });
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
  assert.equal(resetRequest.resetUrl, emailService.buildPasswordResetUrl(resetRequest.resetToken));
  assert.match(resetRequest.resetUrl, new RegExp(`/auth/reset-password\\?token=${resetRequest.resetToken}$`));
  assert.equal(sentPasswordResetEmails.length, 1);
  assert.equal(sentPasswordResetEmails[0].to, patient.email);
  assert.equal(sentPasswordResetEmails[0].resetUrl, `http://localhost:5173/auth/reset-password?token=${resetRequest.resetToken}`);
  assert.ok(sentPasswordResetEmails[0].expiresAt instanceof Date);

  const userAfterRequest = await prisma.user.findUnique({
    where: { id: patient.id },
    select: { passwordResetToken: true },
  });
  assert.notEqual(userAfterRequest.passwordResetToken, resetRequest.resetToken);

  const resetResult = await resetPassword(resetRequest.resetToken, 'newStr0ng!Pass2026');
  assert.equal(resetResult.message, 'Password berhasil direset');

  await assert.rejects(
    resetPassword(resetRequest.resetToken, 'anotherStr0ng!Pass2026'),
    /Token reset password tidak valid atau sudah kadaluarsa/
  );

  await assert.rejects(loginUser(patient.email, patient.password));

  const loginResult = await loginUser(patient.email, 'newStr0ng!Pass2026');
  assert.equal(loginResult.role, 'patient');
  assert.equal(typeof loginResult.token, 'string');
});

test('reset password rejects the previous password without consuming token', async () => {
  const patient = await createNonDoctor('patient');
  const resetRequest = await requestPasswordReset(patient.email);

  await assert.rejects(
    resetPassword(resetRequest.resetToken, patient.password),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, 'Password baru harus berbeda dari password sebelumnya');
      return true;
    }
  );

  const tokenAfterRejectedReset = await prisma.user.findUnique({
    where: { id: patient.id },
    select: {
      passwordResetToken: true,
      passwordResetExpires: true,
    },
  });

  assert.equal(typeof tokenAfterRejectedReset.passwordResetToken, 'string');
  assert.ok(tokenAfterRejectedReset.passwordResetExpires instanceof Date);

  const resetResult = await resetPassword(resetRequest.resetToken, 'differentStr0ng!Pass2026');
  assert.equal(resetResult.message, 'Password berhasil direset');

  await assert.rejects(
    resetPassword(resetRequest.resetToken, 'anotherStr0ng!Pass2026'),
    /Token reset password tidak valid atau sudah kadaluarsa/
  );
});

test('forgot password uses generic response for unknown email', async () => {
  const result = await requestPasswordReset(`missing.${Date.now()}@example.com`);

  assert.equal(result.message, 'Jika email terdaftar, instruksi reset password akan dikirim.');
  assert.equal('resetToken' in result, false);
  assert.equal(sentPasswordResetEmails.length, 0);
});

test('forgot password returns generic success when email delivery fails', async () => {
  const patient = await createNonDoctor('patient');
  emailService.sendPasswordResetEmail = async () => {
    throw new Error('SMTP unavailable');
  };

  const result = await requestPasswordReset(patient.email);

  assert.equal(result.message, 'Jika email terdaftar, instruksi reset password akan dikirim.');
  assert.equal('resetToken' in result, false);
});

test('Google OAuth callback URL uses deployed backend domain from env', async () => {
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleCallbackUrl = process.env.GOOGLE_CALLBACK_URL;
  const originalBackendUrl = process.env.BACKEND_URL;

  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  delete process.env.GOOGLE_CALLBACK_URL;
  process.env.BACKEND_URL = 'https://api.example.com';

  try {
    const callbackUrl = getGoogleCallbackUrl();
    const authorizationUrl = new URL(getGoogleAuthorizationUrl());

    assert.equal(callbackUrl, 'https://api.example.com/api/auth/google/callback');
    assert.equal(
      authorizationUrl.searchParams.get('redirect_uri'),
      'https://api.example.com/api/auth/google/callback'
    );
  } finally {
    if (originalGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    }

    if (originalGoogleCallbackUrl === undefined) {
      delete process.env.GOOGLE_CALLBACK_URL;
    } else {
      process.env.GOOGLE_CALLBACK_URL = originalGoogleCallbackUrl;
    }

    if (originalBackendUrl === undefined) {
      delete process.env.BACKEND_URL;
    } else {
      process.env.BACKEND_URL = originalBackendUrl;
    }
  }
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

test('inactive patient cannot login with Google', async () => {
  const patient = await createNonDoctor('patient', 'inactive');

  await assert.rejects(
    loginWithGoogleProfile({
      email: patient.email,
      name: 'Inactive Google Patient',
      googleId: `google-${patient.id}`,
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun Anda tidak aktif. Silakan hubungi administrator.');
      return true;
    }
  );
});

test('inactive verified doctor cannot login with Google', async () => {
  const doctor = await createGoogleDoctor('verified', 'inactive');

  await assert.rejects(
    loginWithGoogleProfile({
      email: doctor.email,
      name: 'Inactive Google Doctor',
      googleId: doctor.googleId,
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'Akun Anda tidak aktif. Silakan hubungi administrator.');
      return true;
    }
  );
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
