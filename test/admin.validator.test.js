const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateCreateUser,
  validateUpdateUser,
  validateUserStatus,
  validateUserRole,
  validateResetPassword,
  validateDoctorApproval,
  validateDoctorRejection,
  validateAdminSettings,
  validateAdminOperationsSettings,
  validateAdminPreferencesSettings,
  validateReportGeneration,
  validatePaginationParams,
} = require('../src/validators/admin.validator');

test('validateCreateUser accepts valid user payload', () => {
  const result = validateCreateUser({
    fullName: 'Dr Elena Aris',
    email: 'elena@example.com',
    role: 'doctor',
    gender: 'female',
    password: 'Str0ng!Pass2026',
    phoneNumber: '+62 812-3456-7890',
    birthDate: '1990-01-01',
  });

  assert.equal(result, null);
});

test('validateCreateUser returns expected errors for invalid payload', () => {
  const result = validateCreateUser({
    fullName: ' ',
    email: 'invalid-email',
    role: 'nurse',
    gender: 'other',
    password: '123',
    phoneNumber: '12',
    birthDate: 'not-a-date',
  });

  assert.deepEqual(result, {
    fullName: 'Full name is required',
    email: 'Email harus memiliki tepat satu simbol @',
    role: 'Role must be admin, doctor, or patient',
    gender: 'Gender must be male or female',
    password: [
      'Password minimal 6 karakter',
      'Password harus mengandung huruf kecil',
      'Password harus mengandung huruf besar',
      'Password harus mengandung simbol',
    ],
    phoneNumber: 'Invalid phone number format',
    birthDate: 'Invalid birth date',
  });
});

test('validateUpdateUser validates only provided fields', () => {
  assert.equal(validateUpdateUser({ fullName: 'Updated Name' }), null);
  assert.deepEqual(validateUpdateUser({
    fullName: '',
    email: 'bad',
    role: 'guest',
    gender: 'unknown',
  }), {
    fullName: 'Full name cannot be empty',
    email: 'Email harus memiliki tepat satu simbol @',
    role: 'Role must be admin, doctor, or patient',
    gender: 'Gender must be male or female',
  });
});

test('simple admin validators accept and reject expected values', () => {
  assert.equal(validateUserStatus('active'), null);
  assert.deepEqual(validateUserStatus('blocked'), { status: 'Invalid status' });

  assert.equal(validateUserRole('patient'), null);
  assert.deepEqual(validateUserRole('guest'), { role: 'Invalid role' });

  assert.equal(validateResetPassword({ newPassword: 'Str0ng!Pass2026' }), null);
  assert.deepEqual(validateResetPassword({ newPassword: '123' }), {
    newPassword: [
      'Password minimal 6 karakter',
      'Password harus mengandung huruf kecil',
      'Password harus mengandung huruf besar',
      'Password harus mengandung simbol',
    ],
  });

  assert.equal(validateDoctorApproval({ note: 'Approved after review' }), null);
  assert.deepEqual(validateDoctorApproval({ note: ' ' }), {
    note: 'Approval note is required',
  });

  assert.equal(validateDoctorRejection({ reason: 'Incomplete documents' }), null);
  assert.deepEqual(validateDoctorRejection({ reason: '' }), {
    reason: 'Rejection reason is required',
  });
});

test('validateAdminSettings rejects invalid notification booleans', () => {
  assert.equal(validateAdminSettings({
    emailNotifications: false,
    doctorApprovalAlerts: true,
    clinicRequestAlerts: true,
    systemAlerts: false,
    weeklyDigest: true,
  }), null);

  assert.deepEqual(validateAdminSettings({
    emailNotifications: 'no',
    doctorApprovalAlerts: 1,
    clinicRequestAlerts: 'yes',
    systemAlerts: 'false',
    weeklyDigest: 0,
  }), {
    emailNotifications: 'Must be boolean',
    doctorApprovalAlerts: 'Must be boolean',
    clinicRequestAlerts: 'Must be boolean',
    systemAlerts: 'Must be boolean',
    weeklyDigest: 'Must be boolean',
  });
});

test('validateAdminOperationsSettings rejects invalid values', () => {
  assert.equal(validateAdminOperationsSettings({
    defaultPageSize: 16,
    auditLogRetentionDays: 180,
    maintenanceMode: false,
    deleteConfirmationRequired: true,
  }), null);

  assert.deepEqual(validateAdminOperationsSettings({
    defaultPageSize: 10,
    auditLogRetentionDays: 45,
    maintenanceMode: 'no',
    deleteConfirmationRequired: 'yes',
  }), {
    defaultPageSize: 'defaultPageSize must be one of 8, 16, 24, or 32',
    auditLogRetentionDays: 'auditLogRetentionDays must be one of 30, 90, 180, or 365',
    maintenanceMode: 'Must be boolean',
    deleteConfirmationRequired: 'Must be boolean',
  });
});

test('validateAdminPreferencesSettings rejects unsupported options', () => {
  assert.equal(validateAdminPreferencesSettings({
    language: 'Bahasa Indonesia',
    timezone: 'Asia/Jakarta',
  }), null);

  assert.deepEqual(validateAdminPreferencesSettings({
    language: 'French',
    timezone: 'Asia/Bandung',
  }), {
    language: 'language must be English (US) or Bahasa Indonesia',
    timezone: 'timezone must be Asia/Jakarta, Asia/Makassar, Asia/Jayapura, or UTC',
  });
});

test('validateReportGeneration enforces dates, type, and format', () => {
  assert.equal(validateReportGeneration({
    startDate: '2026-05-01',
    endDate: '2026-05-16',
    reportType: 'system_overview',
    format: 'pdf',
  }), null);

  assert.deepEqual(validateReportGeneration({
    startDate: 'bad-date',
    endDate: '2026-04-30',
    reportType: 'unknown',
    format: 'json',
  }), {
    startDate: 'Valid start date is required',
    reportType: 'Invalid report type',
    format: 'Format must be pdf, csv, or xlsx',
  });

  assert.deepEqual(validateReportGeneration({
    startDate: '2026-05-16',
    endDate: '2026-05-01',
    reportType: 'user_stats',
  }), {
    endDate: 'End date must be after start date',
  });
});

test('validatePaginationParams enforces page and limit ranges', () => {
  assert.equal(validatePaginationParams(1, 10), null);
  assert.deepEqual(validatePaginationParams(0, 101), {
    page: 'Page must be a positive number',
    limit: 'Limit must be between 1 and 100',
  });
});
