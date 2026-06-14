const test = require('node:test');
const assert = require('node:assert/strict');

const doctorService = require('../src/services/doctor.service');
const doctorController = require('../src/controllers/doctor.controller');

const originalApproveCase = doctorService.approveCase;
const originalRejectCase = doctorService.rejectCase;
const originalLog = console.log;

const createRes = () => {
  const res = {
    statusCode: 200,
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

  return res;
};

test.afterEach(() => {
  doctorService.approveCase = originalApproveCase;
  doctorService.rejectCase = originalRejectCase;
  console.log = originalLog;
});

test('approveCase controller reads and trims physicianObservation from body', async () => {
  console.log = () => {};
  let capturedArgs = null;
  doctorService.approveCase = async (...args) => {
    capturedArgs = args;
    return {
      message: 'Case approved successfully',
      caseId: 'SCN-123',
      scanId: 'SCN-123',
      requestId: 'VER-123',
    };
  };

  const res = createRes();
  await doctorController.approveCase({
    params: { caseId: 'SCN-123' },
    body: {
      physicianObservation: '  asdsadsadsa  ',
      finalDiagnosis: '  Approved  ',
    },
    user: { id: 'doctor-user-id' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedArgs, [
    'SCN-123',
    'doctor-user-id',
    'asdsadsadsa',
    'Approved',
  ]);
});

test('rejectCase controller reads and trims physicianObservation from body', async () => {
  console.log = () => {};
  let capturedArgs = null;
  doctorService.rejectCase = async (...args) => {
    capturedArgs = args;
    return {
      message: 'Case rejected successfully',
      caseId: 'SCN-123',
      scanId: 'SCN-123',
      requestId: 'VER-123',
    };
  };

  const res = createRes();
  await doctorController.rejectCase({
    params: { caseId: 'VER-123' },
    body: {
      reason: '  False positive prediction  ',
      physicianObservation: '  No malignant features seen.  ',
      finalDiagnosis: '  Rejected  ',
    },
    user: { id: 'doctor-user-id' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedArgs, [
    'VER-123',
    'doctor-user-id',
    'False positive prediction',
    'No malignant features seen.',
    'Rejected',
  ]);
});

test('approveCase controller returns 400 only when physicianObservation is empty', async () => {
  console.log = () => {};
  doctorService.approveCase = async () => {
    throw new Error('service should not be called');
  };

  const res = createRes();
  await doctorController.approveCase({
    params: { caseId: 'SCN-123' },
    body: {
      physicianObservation: '   ',
      finalDiagnosis: 'Approved',
    },
    user: { id: 'doctor-user-id' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Physician observation is required/);
});

test('rejectCase controller returns 400 only when physicianObservation is empty', async () => {
  console.log = () => {};
  doctorService.rejectCase = async () => {
    throw new Error('service should not be called');
  };

  const res = createRes();
  await doctorController.rejectCase({
    params: { caseId: 'SCN-123' },
    body: {
      reason: 'False positive prediction',
      physicianObservation: '   ',
      finalDiagnosis: 'Rejected',
    },
    user: { id: 'doctor-user-id' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Physician observation is required/);
});
