const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { getBeds, updateBedStatus, createBed } = require('../controllers/bedController');

// Any logged-in role can view the bed map.
router.get('/', authenticate, getBeds);

// Nurse/admin can flip a bed's status — the controller itself
// blocks a nurse from touching a bed locked by a doctor's/admin's
// assignment (see bedController.updateBedStatus).
router.patch('/:id/status', authenticate, authorize('nurse', 'admin'), updateBedStatus);

// Admin-only: add a brand new bed to a room.
router.post('/', authenticate, authorize('admin'), createBed);

module.exports = router;
