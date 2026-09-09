const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { getWards, getRoomsByWard, createWard, createRoom } = require('../controllers/wardController');

router.get('/', authenticate, getWards);
router.get('/:id/rooms', authenticate, getRoomsByWard);

// Admin-only: build out the physical hospital layout.
router.post('/', authenticate, authorize('admin'), createWard);
router.post('/:id/rooms', authenticate, authorize('admin'), createRoom);

module.exports = router;
