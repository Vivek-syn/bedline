const express = require('express');
const controller = require('./patientRegistry.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules, idParam } = require('../../core/validate');

const router = express.Router();

const patientBody = {
  name: { rule: rules.string({ min: 2, max: 120 }), label: 'Full name' },
  age: { rule: rules.integer({ min: 0, max: 130 }), label: 'Age' },
  gender: { rule: rules.string({ max: 20 }), label: 'Gender' },
  contact: { rule: rules.string({ max: 30 }), label: 'Contact number' },
};

router.get(
  '/',
  requirePermission('patient.view'),
  validate({
    query: {
      status: { rule: rules.enumOf(['pending', 'admitted', 'discharged']), label: 'Status' },
      search: { rule: rules.string({ max: 80 }), label: 'Search' },
    },
  }),
  controller.list
);

router.get('/:id', requirePermission('patient.view'), validate(idParam()), controller.detail);

router.post(
  '/',
  requirePermission('patient.create'),
  validate({ body: { ...patientBody, name: { ...patientBody.name, required: true } } }),
  controller.create
);

router.patch(
  '/:id',
  requirePermission('patient.update'),
  validate({ ...idParam(), body: patientBody }),
  controller.update
);

module.exports = router;
