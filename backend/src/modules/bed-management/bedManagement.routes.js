const express = require('express');
const controller = require('./bedManagement.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules, idParam } = require('../../core/validate');
const { STATUSES } = require('./bedManagement.service');

const router = express.Router();

router.get(
  '/',
  requirePermission('bed.view'),
  validate({
    query: {
      status: { rule: rules.enumOf(STATUSES), label: 'Status' },
      wardId: { rule: rules.integer({ min: 1 }), label: 'Ward' },
    },
  }),
  controller.list
);

router.post(
  '/',
  requirePermission('bed.create'),
  validate({
    body: {
      roomId: { rule: rules.integer({ min: 1 }), required: true, label: 'Room' },
      bedNumber: { rule: rules.string({ min: 1, max: 20 }), required: true, label: 'Bed number' },
    },
  }),
  controller.create
);

router.patch(
  '/:id/status',
  requirePermission('bed.update_status'),
  validate({
    ...idParam(),
    body: { status: { rule: rules.enumOf(STATUSES), required: true, label: 'Status' } },
  }),
  controller.updateStatus
);

module.exports = router;
