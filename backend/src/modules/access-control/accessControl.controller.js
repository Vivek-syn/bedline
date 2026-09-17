const service = require('./accessControl.service');
const audit = require('../../core/audit');
const { asyncHandler } = require('../../core/errors');

const MODULE = 'access-control';

const catalogue = asyncHandler(async (req, res) => {
  res.json(await service.listCatalogue());
});

const list = asyncHandler(async (req, res) => {
  res.json(await service.listRoles());
});

const detail = asyncHandler(async (req, res) => {
  res.json(await service.getRole(req.valid.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { name, description, rank, permissionIds } = req.valid.body;
  const role = await service.createRole(req.user, {
    name,
    description,
    rank,
    permissionIds: permissionIds || [],
  });

  await audit.record(req, {
    action: 'role.create',
    module: MODULE,
    entity: 'role',
    entityId: role.id,
    details: { name: role.name, rank: role.rank, permissionIds: permissionIds || [] },
  });

  res.status(201).json(role);
});

const update = asyncHandler(async (req, res) => {
  const roleId = req.valid.params.id;
  const before = await service.getRole(roleId);

  const role = await service.updateRole(req.user, roleId, req.valid.body);

  // The before/after permission sets are recorded, not just the
  // new one. "Who took this away, and when" is the question asked
  // after an access incident, and a snapshot of the end state
  // cannot answer it.
  await audit.record(req, {
    action: 'role.update',
    module: MODULE,
    entity: 'role',
    entityId: roleId,
    details: {
      name: role.name,
      permissionsBefore: before.permission_ids,
      permissionsAfter: role.permission_ids,
    },
  });

  res.json(role);
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteRole(req.user, req.valid.params.id);
  await audit.record(req, {
    action: 'role.delete',
    module: MODULE,
    entity: 'role',
    entityId: result.id,
    details: { name: result.name },
  });
  res.json({ message: `Role "${result.name}" deleted.` });
});

module.exports = { catalogue, list, detail, create, update, remove };
