// ============================================================
// AUDIT LOG
//
// One call site for "record that something happened". Every
// state-changing action in every module writes here, and so do
// denied attempts — a sequence of denials is usually more
// interesting than the successes around it.
//
// Two rules this file enforces on behalf of its callers:
//
//   1. Writing an audit row must never break the request. If the
//      insert fails we log to stderr and move on, because failing
//      a completed discharge because its log line did not save
//      would be the worse outcome.
//   2. Nothing sensitive goes into `details`. The redaction pass
//      below drops password-ish and token-ish keys, so a careless
//      `details: req.body` cannot put a plaintext password into a
//      table that support staff can read.
// ============================================================

const db = require('../config/db');

const SENSITIVE_KEY = /pass|secret|token|hash|authorization|cookie|csrf/i;

function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => redact(entry, depth + 1));

  if (typeof value === 'object') {
    const output = {};
    Object.entries(value).forEach(([key, entry]) => {
      output[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(entry, depth + 1);
    });
    return output;
  }

  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

/**
 * @param {object} req      the request, for actor/ip/user-agent
 * @param {object} entry
 * @param {string} entry.action     e.g. 'admission.assign'
 * @param {string} [entry.module]   module key
 * @param {string} [entry.entity]   'bed' | 'admission' | ...
 * @param {number} [entry.entityId]
 * @param {'success'|'denied'|'failure'} [entry.outcome]
 * @param {object} [entry.details]
 * @param {object} [client] optional transaction client, so the
 *        log row commits or rolls back with the change it
 *        describes rather than recording an action that was
 *        later undone.
 */
async function record(req, entry, client = null) {
  const runner = client || db;
  try {
    await runner.query(
      `INSERT INTO audit_logs
         (user_id, actor_role, module_key, action, entity, entity_id,
          outcome, details, ip_address, user_agent, request_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        req.user?.id || null,
        req.user?.role?.key || null,
        entry.module || null,
        entry.action,
        entry.entity || null,
        entry.entityId || null,
        entry.outcome || 'success',
        JSON.stringify(redact(entry.details || {})),
        req.clientIp || null,
        String(req.get?.('user-agent') || '').slice(0, 500) || null,
        req.id || null,
      ]
    );
  } catch (err) {
    console.error(`Audit write failed for "${entry.action}":`, err.message);
  }
}

module.exports = { record, redact };
