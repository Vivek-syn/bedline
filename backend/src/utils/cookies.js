// Central place for how auth cookies are set and cleared, so the
// flags cannot drift apart between the login, refresh and logout
// paths — a `secure` flag missing from just one of them is
// exactly the kind of bug that never shows up in testing.

const config = require('../config/env');

function setAuthCookies(res, { refreshToken, csrfToken }) {
  const maxAge = config.auth.refreshTokenDays * 24 * 60 * 60 * 1000;

  res.cookie(config.cookies.refreshName, refreshToken, {
    httpOnly: true,                 // JavaScript cannot read it, so XSS cannot steal it
    secure: config.cookies.secure,  // HTTPS only in production
    sameSite: config.cookies.sameSite,
    maxAge,
    path: '/api/auth',              // sent only to the endpoints that need it
  });

  // Deliberately readable: the frontend has to echo this back in
  // a header. It is not a secret on its own — it is only useful
  // in combination with the httpOnly cookie above.
  res.cookie(config.cookies.csrfName, csrfToken, {
    httpOnly: false,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    maxAge,
    path: '/',
  });
}

function clearAuthCookies(res) {
  res.clearCookie(config.cookies.refreshName, { path: '/api/auth' });
  res.clearCookie(config.cookies.csrfName, { path: '/' });
}

module.exports = { setAuthCookies, clearAuthCookies };
