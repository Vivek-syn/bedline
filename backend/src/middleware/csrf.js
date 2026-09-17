// ============================================================
// CSRF — double-submit cookie
//
// The refresh token rides in an httpOnly cookie, and browsers
// attach cookies to cross-site requests automatically. Without a
// second factor, any page on the internet could POST to
// /api/auth/refresh in a signed-in user's browser and receive a
// fresh access token.
//
// So refresh also requires a value that a cross-origin page
// cannot read: a random token set in a readable (non-httpOnly)
// cookie, which our own JavaScript echoes back in a header. The
// same-origin policy stops another site reading that cookie, and
// the CORS allow-list stops it reading the response.
//
// SameSite=strict on the refresh cookie already blocks most of
// this. This is the belt to that pair of braces — SameSite is
// handled inconsistently by older browsers and does not cover
// every same-site-but-untrusted case.
// ============================================================

const config = require('../config/env');
const { safeEqual } = require('../core/tokens');
const { Forbidden } = require('../core/errors');

function requireCsrfToken(req, res, next) {
  const cookieToken = req.cookies?.[config.cookies.csrfName];
  const headerToken = req.get('X-CSRF-Token');

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(Forbidden('Your session could not be verified. Sign in again.'));
  }
  return next();
}

module.exports = requireCsrfToken;
