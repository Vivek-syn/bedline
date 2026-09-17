const express = require('express');
const controller = require('./accessControl.controller');
const requirePermission = require('../../middleware/requirePermission');
const { validate, rules, idParam } = require('../../core/validate');

const router = express.Router();

// `rank` is capped well below the built-in administrator's so a
// newly created role can never be minted at the top of the ladder.
const roleBody = {
  name: { rule: rules.string({ min: 2, max: 60 }), label: 'Role name' },
  description: { rule: rules.string({ max: 400 }), label: 'Description' },
  rank: { rule: rules.integer({ min: 1, max: 90 }), label: 'Rank' },
  permissionIds: { rule: rules.integerArray(), label: 'Permissions' },
};

router.get('/catalogue', requirePermission('role.view'), controller.catalogue);
router.get('/', requirePermission('role.view'), controller.list);
router.get('/:id', requirePermission('role.view'), validate(idParam()), controller.detail);

router.post(
  '/',
  requirePermission('role.manage'),
  validate({
    body: {
      ...roleBody,
      name: { ...roleBody.name, required: true },
      rank: { ...roleBody.rank, required: true },
    },
  }),
  controller.create
);

router.patch(
  '/:id',
  requirePermission('role.manage'),
  validate({ ...idParam(), body: roleBody }),
  controller.update
);

router.delete('/:id', requirePermission('role.delete'), validate(idParam()), controller.remove);

module.exports = router;
