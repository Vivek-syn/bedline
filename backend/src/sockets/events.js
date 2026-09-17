const { getIO } = require('./socket');

const EVENTS = {
  BED_CHANGED: 'bed:changed',
  ADMISSION_CHANGED: 'admission:changed',
  PATIENT_CHANGED: 'patient:changed',
};

/**
 * Broadcast to everyone holding `permission`.
 *
 * Payloads carry ids, not records. A client that receives one
 * refetches through the API, where the permission check runs
 * again — so the socket never becomes a side channel that hands
 * out data the REST layer would have refused.
 */
function emit(event, payload, permission) {
  const io = getIO();
  if (!io) return;

  if (permission) io.to(`perm:${permission}`).emit(event, payload);
  else io.emit(event, payload);
}

module.exports = { EVENTS, emit };
