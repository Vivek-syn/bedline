// ============================================================
// REQUIRE PERMISSION
//
// The authorisation gate on every protected route:
//
//   router.post('/assign',
//     requirePermission('admission.assign'),
//     controller.assign);
//
// The permission key is checked against the module registry the
// moment this file is loaded, so a typo stops the server at boot
// rather than producing a route that quietly denies everyone.
//
// Denials are audited. One 403 is usually a stale browser tab;
// twenty in a minute from one account is someone probing the API
// surface, and that pattern is only visible if denials are
// recorded as carefully as successes.
// ============================================================

const registry = require('../core/registry');
const accessControl = require('../core/accessControl');
const audit = require('../core/audit');
const { Forbidden, Unauthorized } = require('../core/errors');

function requirePermission(...permissionKeys) {
  permissionKeys.forEach((key) => registry.assertPermissionExists(key));

  return async (req, res, next) => {
    if (!req.user) return next(Unauthorized());

    // Several keys means "any of these is enough" — used where a
    // page serves both a reader and an editor.
    if (accessControl.hasAny(req.user, permissionKeys)) return next();

    await audit.record(req, {
      action: 'access.denied',
      module: registry.moduleKeyForPermission(permissionKeys[0]),
      outcome: 'denied',
      details: { required: permissionKeys, path: req.originalUrl, method: req.method },
    });

    // The message names the permission. That is intentional: the
    // people hitting this are staff, and "ask your admin for
    // billing.clear_dues" is actionable in a way that a bare
    // "Forbidden" is not. It reveals nothing an attacker could
    // not read from the role editor anyway.
    return next(Forbidden(`This action needs the "${permissionKeys.join('" or "')}" permission.`));
  };
}

module.exports = requirePermission;
