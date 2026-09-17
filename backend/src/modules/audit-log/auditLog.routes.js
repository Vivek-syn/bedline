const express = require('express');
const controller = require('./auditLog.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules } = require('../../core/validate');

const router = express.Router();

router.get(
  '/',
  requirePermission('audit.view'),
  validate({
    query: {
      userId: { rule: rules.integer({ min: 1 }), label: 'User' },
      moduleKey: { rule: rules.string({ max: 60 }), label: 'Module' },
      outcome: { rule: rules.enumOf(['success', 'denied', 'failure']), label: 'Outcome' },
      action: { rule: rules.string({ max: 60 }), label: 'Action' },
      // Capped so one request cannot pull the whole table.
      limit: { rule: rules.integer({ min: 1, max: 200 }), default: 50, label: 'Limit' },
      before: { rule: rules.integer({ min: 1 }), label: 'Before' },
    },
  }),
  controller.list
);

module.exports = router;
