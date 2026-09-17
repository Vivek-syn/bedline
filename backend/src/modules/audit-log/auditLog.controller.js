const service = require('./auditLog.service');
const { asyncHandler } = require('../../core/errors');

const list = asyncHandler(async (req, res) => {
  const { userId, moduleKey, outcome, action, limit, before } = req.valid.query;
  res.json(await service.list({ userId, moduleKey, outcome, action, limit: limit || 50, before }));
});

module.exports = { list };
