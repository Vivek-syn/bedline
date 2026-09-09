const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// These two are PUBLIC — no authenticate middleware needed,
// because you obviously can't be logged in before you log in.
router.post('/register', register);
router.post('/login', login);

module.exports = router;
