const service = require('./patientRegistry.service');
const audit = require('../../core/audit');
const { EVENTS, emit } = require('../../sockets/events');
const { asyncHandler } = require('../../core/errors');

const MODULE = 'patient-registry';

const list = asyncHandler(async (req, res) => res.json(await service.listPatients(req.valid.query)));

const detail = asyncHandler(async (req, res) => res.json(await service.getPatient(req.valid.params.id)));

const create = asyncHandler(async (req, res) => {
  const patient = await service.createPatient(req.user, req.valid.body);
  // The name is not written to the audit details: the row already
  // points at the patient id, and repeating identifying details
  // into a log that more people can read than the record itself
  // spreads them further than necessary.
  await audit.record(req, { action: 'patient.create', module: MODULE, entity: 'patient', entityId: patient.id });
  emit(EVENTS.PATIENT_CHANGED, { patientId: patient.id }, 'patient.view');
  res.status(201).json(patient);
});

const update = asyncHandler(async (req, res) => {
  const patient = await service.updatePatient(req.valid.params.id, req.valid.body);
  await audit.record(req, {
    action: 'patient.update',
    module: MODULE,
    entity: 'patient',
    entityId: patient.id,
    details: { fields: Object.keys(req.valid.body) },
  });
  emit(EVENTS.PATIENT_CHANGED, { patientId: patient.id }, 'patient.view');
  res.json(patient);
});

module.exports = { list, detail, create, update };
