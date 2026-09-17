const service = require('./admissions.service');
const audit = require('../../core/audit');
const { EVENTS, emit } = require('../../sockets/events');
const { asyncHandler } = require('../../core/errors');

const MODULE = 'admissions';

const listActive = asyncHandler(async (req, res) => res.json(await service.listActive()));

const listForPatient = asyncHandler(async (req, res) =>
  res.json(await service.listForPatient(req.valid.params.id)));

const assign = asyncHandler(async (req, res) => {
  const result = await service.assignBed(req.user, req.valid.body);

  await audit.record(req, {
    action: 'admission.assign',
    module: MODULE,
    entity: 'admission',
    entityId: result.admission.id,
    details: {
      patientId: result.admission.patient_id,
      bedId: result.admission.bed_id,
      assignedByRole: req.user.role.key,
    },
  });

  emit(EVENTS.ADMISSION_CHANGED, { admissionId: result.admission.id }, 'admission.view');
  emit(EVENTS.BED_CHANGED, { bedId: result.admission.bed_id }, 'bed.view');

  res.status(201).json({
    admission: result.admission,
    message: `${result.patientName} is now in bed ${result.bedNumber}.`,
  });
});

const discharge = asyncHandler(async (req, res) => {
  const result = await service.discharge(req.user, req.valid.params.id);

  // A discharge that skipped the billing gate is recorded with
  // that fact attached, since it is the kind of exception the
  // finance team will want to find later.
  await audit.record(req, {
    action: 'admission.discharge',
    module: MODULE,
    entity: 'admission',
    entityId: result.admission.id,
    details: { patientId: result.patientId, bypassedDues: result.bypassedDues },
  });

  emit(EVENTS.ADMISSION_CHANGED, { admissionId: result.admission.id }, 'admission.view');
  emit(EVENTS.BED_CHANGED, { bedId: result.bedId }, 'bed.view');

  res.json({
    admission: result.admission,
    message: result.bypassedDues
      ? `${result.patientName} discharged with dues outstanding. This has been recorded.`
      : `${result.patientName} discharged. The bed is free.`,
  });
});

module.exports = { listActive, listForPatient, assign, discharge };
