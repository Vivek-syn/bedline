// Mirrors backend/src/utils/permissions.js. IMPORTANT: this is
// only used to decide what to SHOW (e.g. graying out a button
// so a nurse isn't confused by a 403). The real enforcement
// always happens on the server — never trust this file alone.

const RANK = { nurse: 1, doctor: 2, admin: 3 };

export function canSupersede(actorRole, ownerRole) {
  return (RANK[actorRole] ?? 0) >= (RANK[ownerRole] ?? 0);
}
