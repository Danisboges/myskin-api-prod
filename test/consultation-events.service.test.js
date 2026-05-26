const test = require('node:test');
const assert = require('node:assert/strict');

const {
  publishConsultationEvent,
  subscribeToConsultationEvents,
} = require('../src/services/consultation-events.service');

test('consultation event bus publishes only to matching consultation subscribers', () => {
  const received = [];
  const unsubscribe = subscribeToConsultationEvents('consultation-1', (event) => {
    received.push(event);
  });

  publishConsultationEvent('consultation-2', 'message:new', { message: 'ignored' });
  publishConsultationEvent('consultation-1', 'message:new', { message: 'hello' });
  unsubscribe();
  publishConsultationEvent('consultation-1', 'message:new', { message: 'after unsubscribe' });

  assert.equal(received.length, 1);
  assert.equal(received[0].type, 'message:new');
  assert.equal(received[0].consultationId, 'consultation-1');
  assert.deepEqual(received[0].payload, { message: 'hello' });
});
