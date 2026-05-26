const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

const buildEventName = (consultationId) => `consultation:${consultationId}`;

const publishConsultationEvent = (consultationId, type, payload = {}) => {
  emitter.emit(buildEventName(consultationId), {
    type,
    consultationId,
    payload,
    emittedAt: new Date().toISOString()
  });
};

const subscribeToConsultationEvents = (consultationId, listener) => {
  const eventName = buildEventName(consultationId);
  emitter.on(eventName, listener);

  return () => {
    emitter.off(eventName, listener);
  };
};

module.exports = {
  publishConsultationEvent,
  subscribeToConsultationEvents
};
