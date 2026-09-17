const express = require('express');
const controller = require('./userManagement.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules, idParam } = require('../../core/validate');

const router = express.Router();

router.get(
  '/',
  requirePermission('user.view'),
  validate({
    query: {
      search: { rule: rules.string({ max: 80 }), label: 'Search' },
      roleId: { rule: rules.integer({ min: 1 }), label: 'Role' },
      includeInactive: { rule: rules.boolean(), label: 'Include inactive' },
    },
  }),
  controller.list
);

router.post(
  '/',
  requirePermission('user.create'),
  validate({
    body: {
      name: { rule: rules.string({ min: 2, max: 120 }), required: true, label: 'Full name' },
      email: { rule: rules.email(), required: true, label: 'Email' },
      roleId: { rule: rules.integer({ min: 1 }), required: true, label: 'Role' },
      // Optional: leave it out and the server generates one.
      password: { rule: rules.password(), label: 'Password' },
      createPatientRecord: { rule: rules.boolean(), label: 'Create patient record' },
    },
  }),
  controller.create
);

router.patch(
  '/:id',
  requirePermission('user.update'),
  validate({
    ...idParam(),
    body: {
      name: { rule: rules.string({ min: 2, max: 120 }), label: 'Full name' },
      email: { rule: rules.email(), label: 'Email' },
      roleId: { rule: rules.integer({ min: 1 }), label: 'Role' },
    },
  }),
  controller.update
);

router.patch(
  '/:id/active',
  requirePermission('user.deactivate'),
  validate({
    ...idParam(),
    body: { isActive: { rule: rules.boolean(), required: true, label: 'Active' } },
  }),
  controller.setActive
);

router.post(
  '/:id/reset-password',
  requirePermission('user.reset_password'),
  validate(idParam()),
  controller.resetPassword
);

module.exports = router;
