const express = require('express');
const controller = require('./auth.controller');
const authenticate = require('../middleware/authenticate');
const requireCsrfToken = require('../middleware/csrf');
const { validate, rules } = require('../core/validate');
const { createLimiter } = require('../middleware/rateLimit');
const config = require('../config/env');

const router = express.Router();

// Tight limit on the endpoints worth guessing against. Keyed on
// IP *and* the submitted email, so one attacker cannot exhaust a
// shared office IP's budget for everyone else in the building
// while grinding through one account.
const authLimiter = createLimiter({
  windowMs: config.rateLimit.loginWindowMinutes * 60 * 1000,
  max: config.rateLimit.loginMaxPerWindow,
  keyFn: (req) => `${req.clientIp}|${String(req.body?.email || '').toLowerCase()}`,
  message: 'Too many sign-in attempts. Wait a few minutes and try again.',
});

const loginSchema = validate({
  body: {
    email: { rule: rules.email(), required: true, label: 'Email' },
    password: { rule: rules.password(), required: true, label: 'Password' },
  },
});

const changePasswordSchema = validate({
  body: {
    currentPassword: { rule: rules.password(), required: true, label: 'Current password' },
    newPassword: { rule: rules.password(), required: true, label: 'New password' },
  },
});

router.post('/login', authLimiter, loginSchema, controller.login);

// Refresh needs the CSRF header as well as the cookie — see
// middleware/csrf.js for why the cookie alone is not enough.
router.post('/refresh', authLimiter, requireCsrfToken, controller.refresh);

router.post('/logout', authenticate, controller.logout);
router.post('/logout-all', authenticate, controller.logoutEverywhere);
router.get('/me', authenticate, controller.me);
router.get('/sessions', authenticate, controller.sessions);
router.post('/change-password', authenticate, changePasswordSchema, controller.changePassword);

module.exports = router;
