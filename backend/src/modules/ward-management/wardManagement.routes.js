const express = require('express');
const controller = require('./wardManagement.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules, idParam } = require('../../core/validate');

const router = express.Router();

router.get('/', requirePermission('ward.view'), controller.listWards);
router.get('/:id/rooms', requirePermission('ward.view'), validate(idParam()), controller.listRooms);

router.post(
  '/',
  requirePermission('ward.manage'),
  validate({
    body: {
      name: { rule: rules.string({ min: 2, max: 80 }), required: true, label: 'Ward name' },
      floor: { rule: rules.integer({ min: -5, max: 200 }), label: 'Floor' },
      type: { rule: rules.string({ max: 40 }), label: 'Type' },
    },
  }),
  controller.createWard
);

router.post(
  '/:id/rooms',
  requirePermission('ward.manage'),
  validate({
    ...idParam(),
    body: {
      roomNumber: { rule: rules.string({ min: 1, max: 20 }), required: true, label: 'Room number' },
      capacity: { rule: rules.integer({ min: 1, max: 40 }), default: 1, label: 'Capacity' },
    },
  }),
  controller.createRoom
);

module.exports = router;
