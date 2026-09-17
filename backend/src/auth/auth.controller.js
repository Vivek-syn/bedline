const service = require('./auth.service');
const accessControl = require('../core/accessControl');
const audit = require('../core/audit');
const config = require('../config/env');
const { setAuthCookies, clearAuthCookies } = require('../utils/cookies');
const { asyncHandler, Unauthorized } = require('../core/errors');

/** The shape every auth response returns, so the client has one thing to parse. */
function principalPayload(principal) {
  return {
    user: {
      id: principal.id,
      name: principal.name,
      email: principal.email,
      mustChangePassword: principal.mustChangePassword,
    },
    role: principal.role,
    permissions: [...principal.permissions],
    modules: accessControl.visibleModules(principal),
  };
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.valid.body;

  let user;
  try {
    user = await service.verifyCredentials(email, password);
  } catch (err) {
    // Logged without the password, and with the attempted email so
    // a pattern of attempts against one account is visible later.
    await audit.record(req, {
      action: 'auth.login',
      module: 'identity',
      outcome: 'failure',
      details: { email, reason: err.message },
    });
    throw err;
  }

  const session = await service.createSession(user.id, {
    userAgent: req.get('user-agent'),
    ip: req.clientIp,
  });

  setAuthCookies(res, session);

  req.user = session.principal;
  await audit.record(req, {
    action: 'auth.login',
    module: 'identity',
    entity: 'session',
    entityId: session.sessionId,
  });

  res.json({ accessToken: session.accessToken, ...principalPayload(session.principal) });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[config.cookies.refreshName];
  if (!refreshToken) throw Unauthorized('Your session is no longer valid.');

  const session = await service.rotateSession(refreshToken, {
    userAgent: req.get('user-agent'),
    ip: req.clientIp,
  });

  setAuthCookies(res, session);
  res.json({ accessToken: session.accessToken, ...principalPayload(session.principal) });
});

const logout = asyncHandler(async (req, res) => {
  if (req.sessionId) await service.revokeSession(req.sessionId);
  await audit.record(req, { action: 'auth.logout', module: 'identity', entity: 'session', entityId: req.sessionId });
  clearAuthCookies(res);
  res.json({ message: 'Signed out.' });
});

const logoutEverywhere = asyncHandler(async (req, res) => {
  await service.revokeAllSessions(req.user.id);
  await audit.record(req, { action: 'auth.logout_all', module: 'identity' });
  clearAuthCookies(res);
  res.json({ message: 'Signed out on every device.' });
});

/**
 * The call the frontend makes on every page load. It returns the
 * user together with the modules they can see, which is what the
 * shared launcher renders — one endpoint, one source of truth,
 * no role names hard-coded in the client.
 */
const me = asyncHandler(async (req, res) => {
  res.json(principalPayload(req.user));
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.valid.body;
  await service.changeOwnPassword(req.user.id, currentPassword, newPassword);
  await audit.record(req, { action: 'auth.password_changed', module: 'identity', entity: 'user', entityId: req.user.id });
  clearAuthCookies(res);
  res.json({ message: 'Password changed. Sign in again with your new password.' });
});

const sessions = asyncHandler(async (req, res) => {
  const rows = await service.listSessions(req.user.id);
  res.json(rows.map((row) => ({ ...row, current: row.id === req.sessionId })));
});

module.exports = { login, refresh, logout, logoutEverywhere, me, changePassword, sessions };
