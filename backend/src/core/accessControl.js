// ============================================================
// ACCESS CONTROL — resolution
//
// Answers one question, for every request: what is this user
// allowed to do right now?
//
// The answer comes from the database (user -> role ->
// role_permissions -> permissions), not from the token. A short
// in-memory cache keeps that from becoming a join on every
// request, and the cache is explicitly busted whenever a role is
// edited, so an admin who removes a permission sees it take
// effect within seconds rather than at the victim's next login.
//
// The cache is per-process. With several server instances behind
// a load balancer each keeps its own copy, which is why the TTL
// is seconds rather than minutes — that TTL is the worst-case
// staleness across the fleet. A shared Redis invalidation channel
// is the next step if this ever runs on more than one box.
// ============================================================

const db = require('../config/db');
const config = require('../config/env');
const registry = require('./registry');

const cache = new Map(); // userId -> { expiresAt, principal }
const TTL_MS = config.auth.permissionCacheSeconds * 1000;

/**
 * Load a user together with their role and full permission set.
 * Returns null when the account is missing or deactivated —
 * callers treat that the same as "not signed in".
 */
async function loadPrincipal(userId) {
  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.token_version,
            u.must_change_password,
            r.id   AS role_id,
            r.key  AS role_key,
            r.name AS role_name,
            r.rank AS role_rank,
            r.is_protected AS role_is_protected,
            COALESCE(
              ARRAY_AGG(p.key ORDER BY p.key) FILTER (WHERE p.key IS NOT NULL),
              '{}'
            ) AS permissions
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = $1
      GROUP BY u.id, r.id`,
    [userId]
  );

  const row = result.rows[0];
  if (!row || !row.is_active) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    tokenVersion: row.token_version,
    mustChangePassword: row.must_change_password,
    role: {
      id: row.role_id,
      key: row.role_key,
      name: row.role_name,
      rank: row.role_rank,
      isProtected: row.role_is_protected,
    },
    permissions: new Set(row.permissions),
  };
}

async function getPrincipal(userId) {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.principal;

  const principal = await loadPrincipal(userId);
  cache.set(userId, { expiresAt: Date.now() + TTL_MS, principal });
  return principal;
}

/** Drop one user's cached permissions (role change, deactivation). */
function invalidateUser(userId) {
  cache.delete(userId);
}

/**
 * Drop everyone's. Called after any edit to a role or its
 * permissions, since a single role edit can change what dozens
 * of signed-in users are allowed to do and we do not track the
 * reverse mapping in memory.
 */
function invalidateAll() {
  cache.clear();
}

function has(principal, permissionKey) {
  return Boolean(principal && principal.permissions.has(permissionKey));
}

function hasAny(principal, permissionKeys) {
  return permissionKeys.some((key) => has(principal, key));
}

/**
 * The modules a principal should see in the launcher: any module
 * where they hold at least one of its permissions.
 *
 * This is presentation only. The API guards every route on its
 * own; hiding a tile is a courtesy to the user, never a security
 * boundary, because anyone can type the URL.
 */
function visibleModules(principal) {
  return registry.modules
    .filter((module) => module.permissions.some((permission) => has(principal, permission.key)))
    .map((module) => ({
      key: module.key,
      name: module.name,
      description: module.description,
      route: module.route,
      icon: module.icon,
      sortOrder: module.sortOrder,
      permissions: module.permissions
        .filter((permission) => has(principal, permission.key))
        .map((permission) => permission.key),
    }));
}

/**
 * Seniority check, replacing the old hard-coded
 * nurse < doctor < admin ladder.
 *
 * A user may undo a bed decision made by another role when they
 * hold the explicit override permission, or when their own role
 * ranks at least as high as the role that made it. Ranks are
 * editable per role, so a new "Senior Nurse" slots in between the
 * existing rungs without a code change.
 */
function canSupersede(principal, ownerRank, overridePermission) {
  if (has(principal, overridePermission)) return true;
  if (ownerRank === null || ownerRank === undefined) return true;
  return (principal?.role?.rank ?? 0) >= ownerRank;
}

module.exports = {
  loadPrincipal,
  getPrincipal,
  invalidateUser,
  invalidateAll,
  has,
  hasAny,
  visibleModules,
  canSupersede,
};
