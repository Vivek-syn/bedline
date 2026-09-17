const service = require('./billing.service');
const audit = require('../../core/audit');
const { EVENTS, emit } = require('../../sockets/events');
const { asyncHandler } = require('../../core/errors');

const MODULE = 'billing';

const list = asyncHandler(async (req, res) =>
  res.json(await service.listOutstanding({ includeCleared: req.valid.query.includeCleared || false })));

const clear = asyncHandler(async (req, res) => {
  const patient = await service.setDuesCleared(req.valid.params.id, true);
  await audit.record(req, { action: 'billing.clear_dues', module: MODULE, entity: 'patient', entityId: patient.id });
  emit(EVENTS.PATIENT_CHANGED, { patientId: patient.id }, 'billing.view');
  res.json({ patient, message: `${patient.name} can now be discharged.` });
});

const reopen = asyncHandler(async (req, res) => {
  const patient = await service.setDuesCleared(req.valid.params.id, false);
  await audit.record(req, {
    action: 'billing.reopen',
    module: MODULE,
    entity: 'patient',
    entityId: patient.id,
    details: { reason: req.valid.body.reason },
  });
  emit(EVENTS.PATIENT_CHANGED, { patientId: patient.id }, 'billing.view');
  res.json({ patient, message: `Dues reopened for ${patient.name}.` });
});

module.exports = { list, clear, reopen };
