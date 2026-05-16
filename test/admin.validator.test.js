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
  validateReportGeneration,
  validatePaginationParams,
} = require('../src/validators/admin.validator');

test('validateCreateUser accepts valid user payload', () => {
  const result = validateCreateUser({
    fullName: 'Dr Elena Aris',
    email: 'elena@example.com',
    role: 'doctor',
    gender: 'female',
    password: 'secret123',
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
    email: 'Valid email is required',
    role: 'Role must be admin, doctor, or patient',
    gender: 'Gender must be male or female',
    password: 'Password must be at least 6 characters',
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
    email: 'Valid email is required',
    role: 'Role must be admin, doctor, or patient',
    gender: 'Gender must be male or female',
  });
});

test('simple admin validators accept and reject expected values', () => {
  assert.equal(validateUserStatus('active'), null);
  assert.deepEqual(validateUserStatus('blocked'), { status: 'Invalid status' });

  assert.equal(validateUserRole('patient'), null);
  assert.deepEqual(validateUserRole('guest'), { role: 'Invalid role' });

  assert.equal(validateResetPassword({ newPassword: 'secret123' }), null);
  assert.deepEqual(validateResetPassword({ newPassword: '123' }), {
    newPassword: 'New password must be at least 6 characters',
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

test('validateAdminSettings rejects invalid booleans and visibility', () => {
  assert.equal(validateAdminSettings({
    twoFactorEnabled: true,
    emailNotifications: false,
    verificationAlerts: true,
    dataVisibility: 'shared_with_clinic',
  }), null);

  assert.deepEqual(validateAdminSettings({
    twoFactorEnabled: 'yes',
    emailNotifications: 'no',
    verificationAlerts: 1,
    dataVisibility: 'public',
  }), {
    twoFactorEnabled: 'Must be boolean',
    emailNotifications: 'Must be boolean',
    verificationAlerts: 'Must be boolean',
    dataVisibility: 'Invalid data visibility',
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
