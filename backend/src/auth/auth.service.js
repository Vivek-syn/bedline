// ============================================================
// IDENTITY SERVICE
//
// Sign in, refresh, sign out, change password. Nothing here
// creates accounts — that belongs to the user-management module,
// which requires a permission. Open self-registration was removed
// deliberately: the old /auth/register let anyone on the internet
// pick their own role, including admin.
// ============================================================

const crypto = require('crypto');
const db = require('../config/db');
const config = require('../config/env');
const passwords = require('../core/passwords');
const tokens = require('../core/tokens');
const accessControl = require('../core/accessControl');
const { Unauthorized, BadRequest, TooMany } = require('../core/errors');

/**
 * Verify an email/password pair.
 *
 * Every failure path returns the same message and takes roughly
 * the same time. Saying "no such account" for one email and
 * "wrong password" for another turns the login form into a tool
 * for discovering who works here — which, for a hospital, is
 * information worth protecting on its own.
 */
async function verifyCredentials(email, password) {
  const result = await db.query(
    `SELECT id, name, email, password_hash, is_active,
            failed_login_attempts, locked_until, token_version
       FROM users
      WHERE LOWER(email) = LOWER($1)`,
    [email]
  );

  const user = result.rows[0];

  if (!user) {
    await passwords.wasteTime();
    throw Unauthorized('Email or password is incorrect.');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
    throw TooMany(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const matches = await passwords.compare(password, user.password_hash);

  if (!matches) {
    // Count the failure and lock the account once the threshold is
    // hit. This is per-account, so an attacker spreading guesses
    // across a botnet still cannot get more than N tries at any
    // one person.
    const attempts = user.failed_login_attempts + 1;
    const shouldLock = attempts >= config.auth.maxFailedLogins;

    await db.query(
      `UPDATE users
          SET failed_login_attempts = $2,
              locked_until = CASE WHEN $3 THEN NOW() + ($4 || ' minutes')::interval ELSE locked_until END
        WHERE id = $1`,
      [user.id, shouldLock ? 0 : attempts, shouldLock, String(config.auth.lockoutMinutes)]
    );

    throw Unauthorized('Email or password is incorrect.');
  }

  if (!user.is_active) {
    // Checked after the password, so a deactivated account is
    // indistinguishable from a wrong password to anyone who does
    // not already know the right one.
    throw Unauthorized('Email or password is incorrect.');
  }

  await db.query(
    `UPDATE users
        SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
      WHERE id = $1`,
    [user.id]
  );

  return user;
}

/**
 * Create a session row and mint both tokens.
 * `familyId` groups a refresh token with all its descendants, so
 * detecting one stolen token lets us revoke the whole lineage.
 */
async function createSession(userId, { userAgent, ip, familyId = null }) {
  const refreshToken = tokens.generateRefreshToken();
  const csrfToken = tokens.generateCsrfToken();

  const session = await db.query(
    `INSERT INTO sessions (user_id, token_hash, family_id, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      userId,
      tokens.hashRefreshToken(refreshToken),
      familyId || crypto.randomUUID(),
      String(userAgent || '').slice(0, 500) || null,
      ip || null,
      tokens.refreshTokenExpiry(),
    ]
  );

  const sessionId = session.rows[0].id;
  const principal = await accessControl.getPrincipal(userId);

  const accessToken = tokens.signAccessToken({
    userId,
    sessionId,
    tokenVersion: principal.tokenVersion,
  });

  return { sessionId, accessToken, refreshToken, csrfToken, principal };
}

/**
 * Exchange a refresh token for a new pair, rotating it.
 *
 * The replay branch is the interesting one. A refresh token is
 * single-use: once rotated, its row keeps a `replaced_by`
 * pointer. If that already-used token is presented again, either
 * the legitimate client retried or somebody stole it — and we
 * cannot tell which. Revoking the entire family is the safe
 * response: the real user is asked to sign in again, and the
 * thief's copy is dead too.
 */
async function rotateSession(refreshToken, { userAgent, ip }) {
  const tokenHash = tokens.hashRefreshToken(refreshToken);

  return db.transaction(async (client) => {
    const found = await client.query(
      `SELECT s.id, s.user_id, s.family_id, s.revoked_at, s.replaced_by, s.expires_at,
              u.is_active, u.token_version
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
        FOR UPDATE OF s`,
      [tokenHash]
    );

    const session = found.rows[0];
    if (!session) throw Unauthorized('Your session is no longer valid.');

    if (session.revoked_at || session.replaced_by) {
      await client.query(
        `UPDATE sessions
            SET revoked_at = NOW(), revoked_reason = 'replay_detected'
          WHERE family_id = $1 AND revoked_at IS NULL`,
        [session.family_id]
      );
      throw Unauthorized('This session was reused and has been ended for safety. Please sign in again.');
    }

    if (new Date(session.expires_at) <= new Date()) {
      throw Unauthorized('Your session expired. Please sign in again.');
    }
    if (!session.is_active) {
      throw Unauthorized('This account is no longer active.');
    }

    const nextRefresh = tokens.generateRefreshToken();
    const nextCsrf = tokens.generateCsrfToken();

    const created = await client.query(
      `INSERT INTO sessions (user_id, token_hash, family_id, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        session.user_id,
        tokens.hashRefreshToken(nextRefresh),
        session.family_id,
        String(userAgent || '').slice(0, 500) || null,
        ip || null,
        tokens.refreshTokenExpiry(),
      ]
    );

    await client.query(
      `UPDATE sessions
          SET revoked_at = NOW(), revoked_reason = 'rotated', replaced_by = $2
        WHERE id = $1`,
      [session.id, created.rows[0].id]
    );

    const principal = await accessControl.getPrincipal(session.user_id);
    if (!principal) throw Unauthorized('This account is no longer active.');

    const accessToken = tokens.signAccessToken({
      userId: session.user_id,
      sessionId: created.rows[0].id,
      tokenVersion: principal.tokenVersion,
    });

    return {
      sessionId: created.rows[0].id,
      accessToken,
      refreshToken: nextRefresh,
      csrfToken: nextCsrf,
      principal,
    };
  });
}

async function revokeSession(sessionId, reason = 'signed_out') {
  await db.query(
    `UPDATE sessions SET revoked_at = NOW(), revoked_reason = $2
      WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId, reason]
  );
}

async function revokeAllSessions(userId, reason = 'signed_out_everywhere') {
  await db.query(
    `UPDATE sessions SET revoked_at = NOW(), revoked_reason = $2
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason]
  );
}

/**
 * Change your own password. Requires the current one, so someone
 * who walks up to an unlocked screen cannot lock the real owner
 * out of their account.
 */
async function changeOwnPassword(userId, currentPassword, newPassword) {
  const result = await db.query(
    'SELECT id, name, email, password_hash FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) throw Unauthorized();

  const matches = await passwords.compare(currentPassword, user.password_hash);
  if (!matches) throw BadRequest('Your current password is incorrect.', {
    currentPassword: ['Your current password is incorrect.'],
  });

  if (currentPassword === newPassword) {
    throw BadRequest('Choose a password you have not used here before.', {
      newPassword: ['This is the password you are already using.'],
    });
  }

  passwords.assertStrong(newPassword, { name: user.name, email: user.email });

  const passwordHash = await passwords.hash(newPassword);

  await db.transaction(async (client) => {
    // Bumping token_version invalidates every access token this
    // user holds anywhere. Combined with revoking their sessions,
    // a password change actually signs out the other devices —
    // which is the whole point of changing it after a scare.
    await client.query(
      `UPDATE users
          SET password_hash = $2,
              password_changed_at = NOW(),
              must_change_password = FALSE,
              token_version = token_version + 1
        WHERE id = $1`,
      [userId, passwordHash]
    );
    await client.query(
      `UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'password_changed'
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  });

  accessControl.invalidateUser(userId);
}

async function listSessions(userId) {
  const result = await db.query(
    `SELECT id, user_agent, ip_address, created_at, expires_at
       FROM sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  verifyCredentials,
  createSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  changeOwnPassword,
  listSessions,
};
