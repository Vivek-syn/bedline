const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { getAllPatients, createPatient, getMyStatus, clearDues } = require('../controllers/patientController');
const { addMedicalRecord, getMedicalRecords } = require('../controllers/medicalRecordController');
const { addRemark, getRemarks } = require('../controllers/remarkController');

// '/me' must come before any '/:id'-style route so Express
// doesn't try to match "me" as an id.
router.get('/me', authenticate, authorize('patient'), getMyStatus);

router.get('/', authenticate, authorize('doctor', 'nurse', 'admin', 'receptionist'), getAllPatients);
router.post('/', authenticate, authorize('receptionist', 'admin'), createPatient);

// Reception (or admin) clears a patient's bill before discharge is possible.
router.patch('/:id/clear-dues', authenticate, authorize('receptionist', 'admin'), clearDues);

// Medical records: only doctor/admin can WRITE; doctor/nurse/admin can READ.
router.post('/:patientId/medical-records', authenticate, authorize('doctor', 'admin'), addMedicalRecord);
router.get('/:patientId/medical-records', authenticate, authorize('doctor', 'nurse', 'admin'), getMedicalRecords);

// Remarks: same write/read split as medical records.
router.post('/:patientId/remarks', authenticate, authorize('doctor', 'admin'), addRemark);
router.get('/:patientId/remarks', authenticate, authorize('doctor', 'nurse', 'admin'), getRemarks);

module.exports = router;
