const service = require('./clinicalRecords.service');
const audit = require('../../core/audit');
const { asyncHandler } = require('../../core/errors');

const MODULE = 'clinical-records';

const getChart = asyncHandler(async (req, res) => {
  const patientId = req.valid.params.id;
  const chart = await service.getChart(patientId);

  // Reads are audited here, unlike elsewhere. For clinical notes,
  // "who looked at this chart" is exactly the question asked after
  // a privacy complaint, and it cannot be answered retroactively.
  await audit.record(req, {
    action: 'record.view',
    module: MODULE,
    entity: 'patient',
    entityId: patientId,
  });

  res.json(chart);
});

const addRecord = asyncHandler(async (req, res) => {
  const patientId = req.valid.params.id;
  const record = await service.addRecord(req.user, patientId, req.valid.body.content);

  // The note's text stays out of the audit row — it lives in
  // medical_records, and copying it into a log with a wider
  // readership would defeat the point of guarding the chart.
  await audit.record(req, {
    action: 'record.create',
    module: MODULE,
    entity: 'medical_record',
    entityId: record.id,
    details: { patientId, length: req.valid.body.content.length },
  });

  res.status(201).json(record);
});

const addRemark = asyncHandler(async (req, res) => {
  const patientId = req.valid.params.id;
  const remark = await service.addRemark(req.user, patientId, req.valid.body.remark);

  await audit.record(req, {
    action: 'remark.create',
    module: MODULE,
    entity: 'remark',
    entityId: remark.id,
    details: { patientId },
  });

  res.status(201).json(remark);
});

module.exports = { getChart, addRecord, addRemark };
