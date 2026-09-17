const express = require('express');
const controller = require('./patientPortal.controller');
const requirePermission = require('../../middleware/requirePermission');

const router = express.Router();

// No :id parameters anywhere in this router, by design.
router.get('/', requirePermission('portal.view_own'), controller.stay);
router.get('/remarks', requirePermission('portal.view_own'), controller.remarks);

module.exports = router;
