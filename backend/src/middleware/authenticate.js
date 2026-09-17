// ============================================================
// AUTHENTICATE
//
// Verifies the access token, then loads the live user record and
// their current permissions. Four things have to hold, and any
// one failing means 401:
//
//   1. the signature and expiry are valid
//   2. the account still exists and is active
//   3. the token's version matches the account's — this is how a
//      password change, a role change or a forced sign-out kills
//      tokens that are otherwise still within their 15 minutes
//   4. the session behind the token has not been revoked
//
// Checks 2-4 are the reason the token is not trusted on its own.
// A signed token proves only that we issued it at some point in
// the past, never that it is still supposed to work.
// ============================================================

const db = require('../config/db');
const { verifyAccessToken } = require('../core/tokens');
const accessControl = require('../core/accessControl');
const { Unauthorized } = require('../core/errors');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw Unauthorized('Sign in to continue.');
    }

    const token = header.slice(7).trim();
    if (!token) throw Unauthorized('Sign in to continue.');

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch (err) {
      // The distinction matters to the client: an expired token
      // means "silently refresh and retry", anything else means
      // "send the user back to the sign-in page".
      const expired = err.name === 'TokenExpiredError';
      throw Unauthorized(expired ? 'Your session expired.' : 'Your session is no longer valid.');
    }

    const userId = Number.parseInt(claims.sub, 10);
    if (!Number.isInteger(userId)) throw Unauthorized();

    const principal = await accessControl.getPrincipal(userId);
    if (!principal) throw Unauthorized('This account is no longer active.');

    if (principal.tokenVersion !== claims.ver) {
      throw Unauthorized('Your access changed. Please sign in again.');
    }

    const session = await db.query(
      `SELECT id FROM sessions
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
      [claims.sid, userId]
    );
    if (session.rows.length === 0) {
      throw Unauthorized('This session was signed out.');
    }

    req.user = principal;
    req.sessionId = claims.sid;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;
