const service = require('./userManagement.service');
const audit = require('../../core/audit');
const { asyncHandler } = require('../../core/errors');

const MODULE = 'user-management';

const list = asyncHandler(async (req, res) => {
  const { search, roleId, includeInactive } = req.valid.query;
  res.json(await service.listUsers({ search, roleId, includeInactive: includeInactive || false }));
});

const create = asyncHandler(async (req, res) => {
  const { name, email, roleId, password, createPatientRecord } = req.valid.body;
  const result = await service.createUser(req.user, {
    name, email, roleId, password, createPatientRecord,
  });

  await audit.record(req, {
    action: 'user.create',
    module: MODULE,
    entity: 'user',
    entityId: result.user.id,
    details: { email, roleId, createPatientRecord: Boolean(createPatientRecord) },
  });

  res.status(201).json({
    user: result.user,
    temporaryPassword: result.temporaryPassword,
    message: result.temporaryPassword
      ? 'Account created. Copy the temporary password now — it is not shown again.'
      : 'Account created. They will be asked to choose a new password at first sign-in.',
  });
});

const update = asyncHandler(async (req, res) => {
  const { user, roleChanged } = await service.updateUser(req.user, req.valid.params.id, req.valid.body);

  await audit.record(req, {
    action: 'user.update',
    module: MODULE,
    entity: 'user',
    entityId: user.id,
    details: { changes: req.valid.body, roleChanged },
  });

  res.json({
    user,
    message: roleChanged
      ? 'Saved. Their role changed, so they have been signed out and will get the new permissions when they sign back in.'
      : 'Saved.',
  });
});

const setActive = asyncHandler(async (req, res) => {
  const { isActive } = req.valid.body;
  const result = await service.setActive(req.user, req.valid.params.id, isActive);

  await audit.record(req, {
    action: isActive ? 'user.reactivate' : 'user.deactivate',
    module: MODULE,
    entity: 'user',
    entityId: result.id,
    details: { name: result.name },
  });

  res.json({
    ...result,
    message: isActive ? `${result.name} can sign in again.` : `${result.name} has been signed out and deactivated.`,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await service.resetPassword(req.user, req.valid.params.id);

  // The generated password is never written to the audit trail —
  // only the fact that a reset happened.
  await audit.record(req, {
    action: 'user.reset_password',
    module: MODULE,
    entity: 'user',
    entityId: result.id,
    details: { name: result.name },
  });

  res.json({
    id: result.id,
    temporaryPassword: result.temporaryPassword,
    message: 'Copy this temporary password now — it is not shown again. They will choose their own at next sign-in.',
  });
});

module.exports = { list, create, update, setActive, resetPassword };
