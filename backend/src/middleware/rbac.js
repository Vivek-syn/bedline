// ============================================================
// ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
//
// This runs AFTER `authenticate` (so req.user already exists).
// It's a "middleware factory" — a function that RETURNS a
// middleware, so we can customize which roles are allowed per
// route:
//
//   router.post('/assign', authenticate, authorize('doctor','admin'), assignBed);
//
// If the logged-in user's role isn't in the allowed list, we
// stop the request with a 403 ("Forbidden" — you're logged in,
// but you're not allowed to do THIS particular thing).
// ============================================================

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = authorize;
