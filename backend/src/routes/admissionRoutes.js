const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const {
  assignBed,
  dischargePatient,
  getActiveAdmissions,
} = require('../controllers/admissionController');

// Doctors, nurses, AND admin can all assign a bed. The controller
// stamps who did it (assigned_by_role) so the supersede rule below
// has something to check later.
router.post('/assign', authenticate, authorize('doctor', 'nurse', 'admin'), assignBed);

// Doctors/nurses/admin can attempt to de-assign/discharge — but the
// controller itself enforces two extra rules on top of this role
// check: a nurse can't supersede a doctor/admin's assignment, and
// non-admins are blocked until reception clears the patient's dues.
router.patch('/:id/discharge', authenticate, authorize('doctor', 'nurse', 'admin'), dischargePatient);

// Staff can see the full "who's where" list.
router.get('/active', authenticate, authorize('doctor', 'nurse', 'admin', 'receptionist'), getActiveAdmissions);

module.exports = router;
