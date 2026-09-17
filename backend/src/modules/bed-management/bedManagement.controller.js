const service = require('./bedManagement.service');
const audit = require('../../core/audit');
const { EVENTS, emit } = require('../../sockets/events');
const { asyncHandler } = require('../../core/errors');

const MODULE = 'bed-management';

const list = asyncHandler(async (req, res) => {
  res.json(await service.listBeds(req.valid.query));
});

const create = asyncHandler(async (req, res) => {
  const bed = await service.createBed(req.valid.body);
  await audit.record(req, { action: 'bed.create', module: MODULE, entity: 'bed', entityId: bed.id, details: { bedNumber: bed.bed_number, roomId: bed.room_id } });
  emit(EVENTS.BED_CHANGED, { bedId: bed.id }, 'bed.view');
  res.status(201).json(bed);
});

const updateStatus = asyncHandler(async (req, res) => {
  const { bed, previousStatus } = await service.updateStatus(
    req.user,
    req.valid.params.id,
    req.valid.body.status
  );

  await audit.record(req, {
    action: 'bed.update_status',
    module: MODULE,
    entity: 'bed',
    entityId: bed.id,
    details: { from: previousStatus, to: bed.status },
  });

  emit(EVENTS.BED_CHANGED, { bedId: bed.id, status: bed.status }, 'bed.view');
  res.json(bed);
});

module.exports = { list, create, updateStatus };
