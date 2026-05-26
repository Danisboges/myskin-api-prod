const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateConsultationListFilters,
  validatePrescription,
  validateSendMessage,
} = require('../src/validators/consultation.validator');

test('validateConsultationListFilters normalizes doctor message filters', () => {
  const result = validateConsultationListFilters({
    page: '2',
    limit: '25',
    search: ' sarah ',
    status: 'open',
    startDate: '2026-05-01',
    endDate: '2026-05-26',
  });

  assert.equal(result.page, 2);
  assert.equal(result.limit, 25);
  assert.equal(result.search, 'sarah');
  assert.equal(result.status, 'OPEN');
  assert.ok(result.startDate instanceof Date);
  assert.ok(result.endDate instanceof Date);
});

test('validateConsultationListFilters rejects invalid status and date ranges', () => {
  assert.throws(
    () => validateConsultationListFilters({ status: 'pending' }),
    /status must be OPEN or CLOSED/
  );

  assert.throws(
    () => validateConsultationListFilters({
      startDate: '2026-05-26',
      endDate: '2026-05-01',
    }),
    /startDate cannot be after endDate/
  );
});

test('validateSendMessage permits attachment-only messages', () => {
  const result = validateSendMessage({}, { hasAttachments: true });

  assert.equal(result.message, '');
});

test('validatePrescription accepts valid payload and rejects missing medication', () => {
  const result = validatePrescription({
    medicationName: 'Hydrocortisone cream',
    dosage: '1%',
    frequency: '2x daily',
    duration: '7 days',
    notes: 'Apply thin layer.',
  });

  assert.equal(result.medicationName, 'Hydrocortisone cream');
  assert.equal(result.frequency, '2x daily');

  assert.throws(
    () => validatePrescription({ dosage: '1%' }),
    /medicationName is required/
  );
});
