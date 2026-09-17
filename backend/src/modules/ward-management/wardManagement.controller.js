const service = require('./wardManagement.service');
const audit = require('../../core/audit');
const { asyncHandler } = require('../../core/errors');

const MODULE = 'ward-management';

const listWards = asyncHandler(async (req, res) => res.json(await service.listWards()));

const listRooms = asyncHandler(async (req, res) =>
  res.json(await service.listRooms(req.valid.params.id)));

const createWard = asyncHandler(async (req, res) => {
  const ward = await service.createWard(req.valid.body);
  await audit.record(req, { action: 'ward.create', module: MODULE, entity: 'ward', entityId: ward.id, details: { name: ward.name } });
  res.status(201).json(ward);
});

const createRoom = asyncHandler(async (req, res) => {
  const room = await service.createRoom(req.valid.params.id, req.valid.body);
  await audit.record(req, { action: 'room.create', module: MODULE, entity: 'room', entityId: room.id, details: { wardId: req.valid.params.id, roomNumber: room.room_number } });
  res.status(201).json(room);
});

module.exports = { listWards, listRooms, createWard, createRoom };
