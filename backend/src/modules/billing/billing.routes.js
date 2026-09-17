const express = require('express');
const controller = require('./billing.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules, idParam } = require('../../core/validate');

const router = express.Router();

router.get(
  '/',
  requirePermission('billing.view'),
  validate({ query: { includeCleared: { rule: rules.boolean(), label: 'Include cleared' } } }),
  controller.list
);

router.patch(
  '/patient/:id/clear',
  requirePermission('billing.clear_dues'),
  validate(idParam()),
  controller.clear
);

// Reversing a clearance demands a reason. It undoes something
// someone else relied on, and an unexplained reversal is
// impossible to make sense of a week later.
router.patch(
  '/patient/:id/reopen',
  requirePermission('billing.reopen'),
  validate({
    ...idParam(),
    body: { reason: { rule: rules.string({ min: 3, max: 300 }), required: true, label: 'Reason' } },
  }),
  controller.reopen
);

module.exports = router;
