const db = require('../../config/db');

async function list({ userId, moduleKey, outcome, action, limit, before }) {
  const conditions = [];
  const params = [];

  if (userId)    { params.push(userId);    conditions.push(`a.user_id = $${params.length}`); }
  if (moduleKey) { params.push(moduleKey); conditions.push(`a.module_key = $${params.length}`); }
  if (outcome)   { params.push(outcome);   conditions.push(`a.outcome = $${params.length}`); }
  if (action)    { params.push(`${action}%`); conditions.push(`a.action LIKE $${params.length}`); }

  // Keyset pagination on the primary key. OFFSET would get slower
  // the further back you page, and this table only grows.
  if (before)    { params.push(before);    conditions.push(`a.id < $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const result = await db.query(
    `SELECT a.id, a.action, a.module_key, a.entity, a.entity_id,
            a.outcome, a.details, a.ip_address, a.created_at,
            a.actor_role, u.name AS user_name, u.email AS user_email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.id DESC
       LIMIT $${params.length}`,
    params
  );

  return {
    entries: result.rows,
    nextBefore: result.rows.length === limit ? result.rows[result.rows.length - 1].id : null,
  };
}

module.exports = { list };
