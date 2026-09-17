// ============================================================
// TOKENS
//
// Two tokens with different jobs:
//
//   ACCESS  — short-lived (15 min), sent as a Bearer header,
//             held in memory by the browser tab.
//   REFRESH — long-lived (7 days), sent as an httpOnly cookie,
//             exchanged for a new access token and rotated on
//             every use.
//
// The access token carries only identity: user id, session id,
// and the token version. It deliberately does NOT carry the
// user's permissions.
//
// That is the most important decision in this file. If
// permissions were baked into the token, revoking someone's
// access would do nothing until their token expired — they would
// keep their old rights for up to 15 more minutes, and an admin
// who just removed a permission in a hurry would have no way to
// make it stick. Instead permissions are resolved from the
// database on each request (behind a few-second cache), so a
// change in the role editor takes effect almost immediately.
// ============================================================

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const ISSUER = 'bedline';
const AUDIENCE = 'bedline-api';

function signAccessToken({ userId, sessionId, tokenVersion }) {
  return jwt.sign(
    { sid: sessionId, ver: tokenVersion },
    config.auth.jwtSecret,
    {
      subject: String(userId),
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: config.auth.accessTokenTtl,
      algorithm: 'HS256',
    }
  );
}

function verifyAccessToken(token) {
  // Pinning `algorithms` closes the "alg: none" and
  // HS256/RS256-confusion classes of attack, where a forged
  // header persuades the library to skip or change verification.
  return jwt.verify(token, config.auth.jwtSecret, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
  });
}

/**
 * Refresh tokens are opaque random strings, not JWTs — there is
 * nothing to read in them, and the server checks them against a
 * row in `sessions`. That row is what makes logout, rotation and
 * theft detection possible; a self-contained JWT could not be
 * revoked before expiry.
 */
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Only the hash is stored. A read-only leak of the sessions
 * table then yields nothing an attacker can present as a token.
 * SHA-256 (not bcrypt) is right here: the input is 48 random
 * bytes, so there is no dictionary to slow down, and refresh
 * happens often enough that speed matters.
 */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateCsrfToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Compare two secrets without leaking their contents through how
 * long the comparison takes. `===` returns as soon as it finds a
 * differing character, which over many attempts reveals a prefix.
 */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function refreshTokenExpiry() {
  const expires = new Date();
  expires.setDate(expires.getDate() + config.auth.refreshTokenDays);
  return expires;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateCsrfToken,
  safeEqual,
  refreshTokenExpiry,
};
