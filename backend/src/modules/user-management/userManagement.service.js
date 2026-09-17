// ============================================================
// USER MANAGEMENT SERVICE
//
// The guards here mirror the ones in access-control, because
// "assign someone a role" is another way of saying "grant
// permissions" and needs the same limits:
//
//   1. NO ASSIGNING A ROLE YOU COULD NOT CREATE. You cannot put
//      anyone (including yourself) into a role that outranks your
//      own. Otherwise `user.update` alone would be a one-request
//      path to administrator.
//
//   2. NO LOCKING YOURSELF OUT, AND NO LOCKING EVERYONE OUT. You
//      cannot deactivate or demote your own account, and the last
//      active holder of the protected admin role is immovable —
//      a system nobody can administer is unrecoverable without
//      database access.
//
//   3. ROLE CHANGES TAKE EFFECT IMMEDIATELY. Moving someone to a
//      different role bumps their token version and drops their
//      sessions, so their old permissions stop working at once
//      rather than lingering for the life of their token.
// ============================================================

const crypto = require('crypto');
const db = require('../../config/db');
const passwords = require('../../core/passwords');
const accessControl = require('../../core/accessControl');
const { NotFound, Conflict, Forbidden, BadRequest } = require('../../core/errors');

/**
 * A readable one-time password for an admin to hand over in
 * person. Built from crypto.randomBytes rather than Math.random,
 * which is not a cryptographic source and produces guessable
 * output from a known seed.
 */
function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(20);
  const body = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  return `${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10, 15)}-${body.slice(15, 20)}`;
}

async function assertRoleAssignable(actor, roleId, client = db) {
  const result = await client.query(
    'SELECT id, name, rank, is_protected FROM roles WHERE id = $1',
    [roleId]
  );
  const role = result.rows[0];
  if (!role) throw BadRequest('That role does not exist.', { roleId: ['Pick a role from the list.'] });

  // Rule 1.
  if (role.rank > (actor.role?.rank ?? 0)) {
    throw Forbidden(`You cannot assign "${role.name}" — it ranks above your own role.`);
  }
  if (role.is_protected && !actor.role.isProtected) {
    throw Forbidden(`Only an existing administrator can assign "${role.name}".`);
  }
  return role;
}

async function listUsers({ search, roleId, includeInactive }) {
  const conditions = [];
  const params = [];

  if (!includeInactive) conditions.push('u.is_active');

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (roleId) {
    params.push(roleId);
    conditions.push(`u.role_id = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.must_change_password,
            u.last_login_at, u.created_at, u.locked_until,
            r.id AS role_id, r.name AS role_name, r.key AS role_key, r.rank AS role_rank
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY u.is_active DESC, u.name
       LIMIT 500`,
    params
  );
  return result.rows;
}

async function createUser(actor, { name, email, roleId, password, createPatientRecord }) {
  return db.transaction(async (client) => {
    await assertRoleAssignable(actor, roleId, client);

    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      throw Conflict('An account with that email already exists.');
    }

    // An admin-chosen password is a shared secret between two
    // people, so the account is flagged to force a change at first
    // sign-in. A generated one is shown to the admin exactly once.
    const temporaryPassword = password || generateTemporaryPassword();
    passwords.assertStrong(temporaryPassword, { name, email });
    const passwordHash = await passwords.hash(temporaryPassword);

    const user = await client.query(
      `INSERT INTO users (name, email, password_hash, role_id, must_change_password, created_by)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       RETURNING id, name, email, role_id, is_active, created_at`,
      [name, email, passwordHash, roleId, actor.id]
    );

    if (createPatientRecord) {
      await client.query(
        'INSERT INTO patients (user_id, name, created_by) VALUES ($1, $2, $3)',
        [user.rows[0].id, name, actor.id]
      );
    }

    return {
      user: user.rows[0],
      // Returned only when we generated it. If the admin supplied
      // the password they already know it, and echoing it back
      // would put it in a response body for no reason.
      temporaryPassword: password ? null : temporaryPassword,
    };
  });
}

async function updateUser(actor, userId, { name, email, roleId }) {
  return db.transaction(async (client) => {
    const found = await client.query(
      `SELECT u.id, u.name, u.email, u.role_id, r.rank AS role_rank, r.is_protected
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 FOR UPDATE OF u`,
      [userId]
    );
    const target = found.rows[0];
    if (!target) throw NotFound('That account does not exist.');

    // You cannot edit someone who outranks you, for the same
    // reason you cannot edit a role above your rank.
    if (target.role_rank > (actor.role?.rank ?? 0)) {
      throw Forbidden('You cannot edit an account that holds a more senior role than yours.');
    }

    // Rule 2: no self-promotion, and no accidental self-demotion
    // that would leave you unable to undo it.
    if (target.id === actor.id && roleId && roleId !== target.role_id) {
      throw Forbidden('You cannot change your own role. Ask another administrator.');
    }

    if (roleId && roleId !== target.role_id) {
      await assertRoleAssignable(actor, roleId, client);
      if (target.is_protected) {
        await assertNotLastAdministrator(client, target.id);
      }
    }

    if (email && email.toLowerCase() !== target.email.toLowerCase()) {
      const clash = await client.query(
        'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2',
        [email, userId]
      );
      if (clash.rows.length > 0) throw Conflict('Another account already uses that email.');
    }

    const roleChanged = Boolean(roleId && roleId !== target.role_id);

    const updated = await client.query(
      `UPDATE users
          SET name = COALESCE($2, name),
              email = COALESCE($3, email),
              role_id = COALESCE($4, role_id),
              updated_at = NOW(),
              -- Rule 3: a role change invalidates every token this
              -- user is holding, so the new permissions (and only
              -- the new ones) apply from the next request.
              token_version = token_version + CASE WHEN $5 THEN 1 ELSE 0 END
        WHERE id = $1
        RETURNING id, name, email, role_id, is_active`,
      [userId, name || null, email || null, roleId || null, roleChanged]
    );

    if (roleChanged) {
      await client.query(
        `UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'role_changed'
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );
    }

    accessControl.invalidateUser(userId);
    return { user: updated.rows[0], roleChanged };
  });
}

/**
 * Rule 2, second half. Counts the active accounts holding the
 * protected administrator role and refuses to let the count reach
 * zero.
 */
async function assertNotLastAdministrator(client, excludingUserId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.is_protected AND u.is_active AND u.id <> $1`,
    [excludingUserId]
  );
  if (result.rows[0].count === 0) {
    throw Conflict('This is the last active administrator. Promote someone else first, or nobody will be able to administer Bedline.');
  }
}

async function setActive(actor, userId, isActive) {
  return db.transaction(async (client) => {
    const found = await client.query(
      `SELECT u.id, u.name, u.is_active, r.rank AS role_rank, r.is_protected
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 FOR UPDATE OF u`,
      [userId]
    );
    const target = found.rows[0];
    if (!target) throw NotFound('That account does not exist.');

    if (target.id === actor.id) {
      throw Conflict('You cannot deactivate your own account.');
    }
    if (target.role_rank > (actor.role?.rank ?? 0)) {
      throw Forbidden('You cannot deactivate an account that holds a more senior role than yours.');
    }
    if (!isActive && target.is_protected) {
      await assertNotLastAdministrator(client, userId);
    }

    await client.query(
      `UPDATE users
          SET is_active = $2, updated_at = NOW(), token_version = token_version + 1
        WHERE id = $1`,
      [userId, isActive]
    );

    if (!isActive) {
      await client.query(
        `UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'deactivated'
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );
    }

    accessControl.invalidateUser(userId);
    return { id: userId, name: target.name, isActive };
  });
}

/**
 * Issue a temporary password. The admin never learns the old one
 * (it is only stored as a hash), and the account is forced to
 * change this one at next sign-in.
 */
async function resetPassword(actor, userId) {
  return db.transaction(async (client) => {
    const found = await client.query(
      `SELECT u.id, u.name, u.email, r.rank AS role_rank
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 FOR UPDATE OF u`,
      [userId]
    );
    const target = found.rows[0];
    if (!target) throw NotFound('That account does not exist.');

    if (target.role_rank > (actor.role?.rank ?? 0)) {
      throw Forbidden('You cannot reset the password of a more senior account.');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await passwords.hash(temporaryPassword);

    await client.query(
      `UPDATE users
          SET password_hash = $2,
              must_change_password = TRUE,
              password_changed_at = NOW(),
              failed_login_attempts = 0,
              locked_until = NULL,
              token_version = token_version + 1
        WHERE id = $1`,
      [userId, passwordHash]
    );

    await client.query(
      `UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'password_reset'
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    accessControl.invalidateUser(userId);
    return { id: userId, name: target.name, temporaryPassword };
  });
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  setActive,
  resetPassword,
  generateTemporaryPassword,
};
