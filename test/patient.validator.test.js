const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateScanUpload,
  validateScanAnalyze,
  validateScanShare,
  validateProfileUpdate,
  validateProfilePhotoUpdate,
  validateSettingsUpdate,
  validateVerificationRequest,
  validateNotificationRead,
  validatePaginationParams,
} = require('../src/validators/patient.validator');

function createRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function runMiddleware(middleware, req) {
  const res = createRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { res, nextCalled };
}

test('validateScanUpload accepts valid scan upload', () => {
  const { nextCalled, res } = runMiddleware(validateScanUpload, {
    body: { complaint: 'New mole on left arm', bodySite: 'arm' },
    file: { mimetype: 'image/jpeg', size: 1024 },
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('validateScanUpload rejects missing file and short complaint', () => {
  let result = runMiddleware(validateScanUpload, {
    body: { complaint: 'Valid complaint' },
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.res.body.message, 'Image file is required');

  result = runMiddleware(validateScanUpload, {
    body: { complaint: 'bad     mole' },
    file: { mimetype: 'image/png', size: 1024 },
  });
  assert.equal(result.res.body.message, 'Complaint must be at least 10 characters');
});

test('scan route validators reject missing ids', () => {
  assert.equal(runMiddleware(validateScanAnalyze, {
    params: { scanId: '' },
  }).res.body.message, 'Valid scanId is required');

  assert.equal(runMiddleware(validateScanShare, {
    params: { scanId: 'scan-1' },
    body: { doctorUserId: '' },
  }).res.body.message, 'Valid doctorUserId is required');
});

test('profile validators enforce payload rules', () => {
  assert.equal(runMiddleware(validateProfileUpdate, {
    body: { email: 'bad-email' },
  }).res.body.message, 'Invalid email format');

  assert.equal(runMiddleware(validateProfilePhotoUpdate, {
    file: { mimetype: 'image/gif', size: 1024 },
  }).res.body.message, 'Only JPEG, PNG, and WebP images are allowed');
});

test('settings and request validators reject invalid payloads', () => {
  assert.equal(runMiddleware(validateSettingsUpdate, {
    body: { language: 'French' },
  }).res.body.message, 'language must be English (US) or Bahasa Indonesia');

  assert.equal(runMiddleware(validateVerificationRequest, {
    body: { message: 'bad' },
  }).res.body.message, 'Message must be at least 5 characters');

  const initialMessageReq = { body: { initialMessage: 'Valid initial message' } };
  assert.equal(runMiddleware(validateVerificationRequest, initialMessageReq).nextCalled, true);
  assert.equal(initialMessageReq.body.message, 'Valid initial message');

  assert.equal(runMiddleware(validateNotificationRead, {
    params: { notificationId: '' },
  }).res.body.message, 'Valid notificationId is required');
});

test('validatePaginationParams normalizes valid query params', () => {
  const req = {
    query: { page: '2', limit: '5', sortBy: 'createdAt', order: 'ASC' },
  };
  const { nextCalled, res } = runMiddleware(validatePaginationParams, req);

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
  assert.deepEqual(req.pagination, {
    page: 2,
    limit: 5,
    skip: 5,
    sortBy: 'createdAt',
    order: 'asc',
  });
});

test('validatePaginationParams rejects invalid limit', () => {
  const { res, nextCalled } = runMiddleware(validatePaginationParams, {
    query: { page: '1', limit: '101', order: 'desc' },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Limit must be between 1 and 100');
});
