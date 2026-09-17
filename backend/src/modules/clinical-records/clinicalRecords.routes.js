const express = require('express');
const controller = require('./clinicalRecords.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules, idParam } = require('../../core/validate');

const router = express.Router();

router.get(
  '/patient/:id',
  requirePermission('record.view'),
  validate(idParam()),
  controller.getChart
);

router.post(
  '/patient/:id/entries',
  requirePermission('record.create'),
  validate({
    ...idParam(),
    body: { content: { rule: rules.string({ min: 1, max: 10000 }), required: true, label: 'Note' } },
  }),
  controller.addRecord
);

router.post(
  '/patient/:id/remarks',
  requirePermission('remark.create'),
  validate({
    ...idParam(),
    body: { remark: { rule: rules.string({ min: 1, max: 2000 }), required: true, label: 'Remark' } },
  }),
  controller.addRemark
);

module.exports = router;
