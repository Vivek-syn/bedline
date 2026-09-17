// ============================================================
// PASSWORDS
//
// Hashing plus a policy check. The policy is deliberately about
// length and obviousness rather than the classic "one uppercase,
// one digit, one symbol" rule, which pushes people toward
// Password1! and nothing better.
// ============================================================

const bcrypt = require('bcrypt');
const config = require('../config/env');
const { BadRequest } = require('./errors');

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

// The handful of passwords that actually get tried first in a
// real attack. A full breach-corpus check (k-anonymity against
// Have I Been Pwned) is the production answer; this is the
// offline stand-in.
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', '123456', '12345678',
  '123456789', 'qwerty', 'qwerty123', 'letmein', 'welcome', 'welcome123',
  'admin', 'admin123', 'administrator', 'iloveyou', 'monkey', 'dragon',
  'abc123', 'football', 'baseball', 'hospital', 'hospital123', 'bedline',
  'bedline123', 'changeme', 'secret', 'test1234', 'password!23',
]);

/**
 * Returns a list of problems; empty means acceptable.
 * Returning all failures at once lets the UI show them together
 * instead of making someone fix one rule per submission.
 */
function checkStrength(password, { name = '', email = '' } = {}) {
  const problems = [];
  const value = String(password || '');

  if (value.length < MIN_LENGTH) {
    problems.push(`Use at least ${MIN_LENGTH} characters.`);
  }
  // bcrypt silently ignores bytes past 72, so a 200-character
  // password is no stronger than its first 72 — and accepting
  // unbounded input invites slow-hash denial of service.
  if (value.length > MAX_LENGTH) {
    problems.push(`Keep it under ${MAX_LENGTH} characters.`);
  }
  if (COMMON.has(value.toLowerCase())) {
    problems.push('This is one of the most commonly guessed passwords.');
  }
  if (/^(.)\1+$/.test(value)) {
    problems.push('Repeating a single character does not make a password.');
  }
  if (new Set(value).size < 5) {
    problems.push('Use a wider mix of characters.');
  }

  // Someone's own name or email local-part is the first thing an
  // attacker who knows them will try.
  const localPart = String(email).split('@')[0];
  [name, localPart].forEach((personal) => {
    const trimmed = String(personal || '').trim().toLowerCase();
    if (trimmed.length >= 4 && value.toLowerCase().includes(trimmed)) {
      problems.push('Do not include your own name or email in your password.');
    }
  });

  return [...new Set(problems)];
}

function assertStrong(password, context) {
  const problems = checkStrength(password, context);
  if (problems.length > 0) {
    throw BadRequest('That password is not strong enough.', { password: problems });
  }
}

function hash(password) {
  return bcrypt.hash(password, config.auth.bcryptRounds);
}

function compare(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

/**
 * A bcrypt comparison against a throwaway hash, used when the
 * email does not exist. Without it, a missing account answers in
 * ~1ms and a real one in ~250ms, which is enough to enumerate
 * every valid address in the system.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7hHxbvLU7BM1tPDrqMSEfJC4DKVVJ4W';
function wasteTime() {
  return bcrypt.compare('not-the-real-password', DUMMY_HASH);
}

module.exports = { checkStrength, assertStrong, hash, compare, wasteTime, MIN_LENGTH };
