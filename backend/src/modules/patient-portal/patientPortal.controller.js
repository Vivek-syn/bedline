const service = require('./patientPortal.service');
const { asyncHandler } = require('../../core/errors');

const stay = asyncHandler(async (req, res) => res.json(await service.getOwnStay(req.user.id)));
const remarks = asyncHandler(async (req, res) => res.json(await service.getOwnRemarks(req.user.id)));

module.exports = { stay, remarks };
