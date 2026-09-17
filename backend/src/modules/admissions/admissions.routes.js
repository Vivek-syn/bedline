const express = require('express');
const controller = require('./admissions.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules, idParam } = require('../../core/validate');

const router = express.Router();

router.get('/active', requirePermission('admission.view'), controller.listActive);

router.get(
  '/patient/:id',
  requirePermission('admission.view'),
  validate(idParam()),
  controller.listForPatient
);

router.post(
  '/assign',
  requirePermission('admission.assign'),
  validate({
    body: {
      patientId: { rule: rules.integer({ min: 1 }), required: true, label: 'Patient' },
      bedId: { rule: rules.integer({ min: 1 }), required: true, label: 'Bed' },
      doctorId: { rule: rules.integer({ min: 1 }), label: 'Attending doctor' },
    },
  }),
  controller.assign
);

// PATCH, not DELETE: the admission is not removed, it is closed.
// The row is the record that the stay happened.
router.patch(
  '/:id/discharge',
  requirePermission('admission.discharge'),
  validate(idParam()),
  controller.discharge
);

module.exports = router;
