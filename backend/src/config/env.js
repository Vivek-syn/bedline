// ============================================================
// ENVIRONMENT CONFIG
//
// Everything configurable is read here, once, and validated at
// boot. If a required secret is missing or obviously weak the
// process exits immediately with a readable message.
//
// Why fail at boot rather than at first use: a server that starts
// with JWT_SECRET undefined will happily sign tokens with the
// string "undefined" and keep serving traffic. Nobody notices
// until someone forges a token. Crashing on line one is loud,
// early, and impossible to ignore.
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const problems = [];

function required(name, { minLength = 0 } = {}) {
  const value = process.env[name];
  if (!value) {
    problems.push(`${name} is not set.`);
    return '';
  }
  if (minLength && value.length < minLength) {
    problems.push(`${name} must be at least ${minLength} characters (got ${value.length}).`);
  }
  return value;
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    problems.push(`${name} must be a number (got "${raw}").`);
    return fallback;
  }
  return parsed;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// A handful of placeholder secrets ship in .env.example. They are
// fine for a local demo and catastrophic in production, so in
// production they are treated as if the variable were missing.
const WEAK_SECRETS = new Set([
  'super_secret_change_this_in_production',
  'change_me',
  'secret',
  'changeme',
]);

const jwtSecret = required('JWT_SECRET', { minLength: isProduction ? 32 : 16 });
const refreshSecret = required('REFRESH_TOKEN_SECRET', { minLength: isProduction ? 32 : 16 });

if (isProduction) {
  if (WEAK_SECRETS.has(jwtSecret)) problems.push('JWT_SECRET is still the example value.');
  if (WEAK_SECRETS.has(refreshSecret)) problems.push('REFRESH_TOKEN_SECRET is still the example value.');
  if (jwtSecret && jwtSecret === refreshSecret) {
    problems.push('JWT_SECRET and REFRESH_TOKEN_SECRET must be different values.');
  }
}

const config = {
  nodeEnv: NODE_ENV,
  isProduction,
  port: int('PORT', 5001),

  db: {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: int('DB_PORT', 5432),
    database: process.env.DB_NAME || 'hospital_db',
    max: int('DB_POOL_MAX', 10),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },

  auth: {
    jwtSecret,
    refreshSecret,
    // Short-lived access tokens keep the blast radius of a stolen
    // token small; the refresh token does the long-lived work and
    // lives in an httpOnly cookie the page's JavaScript can't read.
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTokenDays: int('REFRESH_TOKEN_DAYS', 7),
    bcryptRounds: int('BCRYPT_ROUNDS', 12),
    maxFailedLogins: int('MAX_FAILED_LOGINS', 5),
    lockoutMinutes: int('LOCKOUT_MINUTES', 15),
    // How long a user's resolved permission set may be cached in
    // memory. Short, because revoking a permission should take
    // effect in seconds, not at next login.
    permissionCacheSeconds: int('PERMISSION_CACHE_SECONDS', 15),
  },

  cors: {
    // Explicit allow-list. `cors()` with no arguments reflects any
    // origin, which combined with credentialed cookies would let
    // any site on the internet make authenticated calls on a
    // signed-in user's behalf.
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  cookies: {
    refreshName: 'bedline_rt',
    csrfName: 'bedline_csrf',
    // `secure` requires HTTPS. Forcing it on in local development
    // would stop cookies working over http://localhost entirely.
    secure: isProduction,
    sameSite: 'strict',
  },

  rateLimit: {
    loginMaxPerWindow: int('RATE_LIMIT_LOGIN_MAX', 10),
    loginWindowMinutes: int('RATE_LIMIT_LOGIN_WINDOW_MIN', 15),
    apiMaxPerWindow: int('RATE_LIMIT_API_MAX', 300),
    apiWindowMinutes: int('RATE_LIMIT_API_WINDOW_MIN', 1),
  },
};

if (problems.length > 0) {
  console.error('\nConfiguration problems found. The server will not start:\n');
  problems.forEach((problem) => console.error(`  - ${problem}`));
  console.error('\nCopy backend/.env.example to backend/.env and fill in real values.');
  console.error('Generate a secret with:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
  process.exit(1);
}

module.exports = config;
