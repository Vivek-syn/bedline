// ============================================================
// API CLIENT
//
// One fetch wrapper for the whole app. It handles three things
// the rest of the code should not have to think about:
//
//   1. The access token lives in memory, not localStorage. A
//      token in localStorage is readable by any script on the
//      page, so one XSS bug hands an attacker a working session.
//      Keeping it in a module variable means it dies with the tab
//      — and the httpOnly refresh cookie silently restores the
//      session on reload, so nobody notices the difference.
//
//   2. A 401 from an expired token triggers one refresh and one
//      retry, transparently. Concurrent 401s share a single
//      refresh promise rather than each firing their own, which
//      would rotate the token several times and trip the replay
//      detector.
//
//   3. Errors arrive as a typed ApiError carrying the server's
//      message and field errors, so forms can show them inline.
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

let accessToken = null;
let refreshPromise = null;
let onSessionLost = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** The shell registers a callback so a dead session redirects to sign-in. */
export function setSessionLostHandler(handler) {
  onSessionLost = handler;
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Something went wrong.');
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error || null;
    // Field-level messages from the validator, keyed by field name.
    this.details = body?.details || null;
    this.requestId = body?.requestId || null;
  }
}

function readCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)bedline_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function refreshSession() {
  // Everyone who hits a 401 at the same moment awaits this one
  // promise instead of starting their own refresh.
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': readCsrfToken() },
    })
      .then(async (response) => {
        if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => ({})));
        const data = await response.json();
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(method, path, body, { retry = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401 && retry) {
    try {
      await refreshSession();
      // One retry only. If the refreshed token is also rejected,
      // the session is genuinely gone and looping would just
      // hammer the endpoint.
      return await request(method, path, body, { retry: false });
    } catch {
      accessToken = null;
      onSessionLost();
      throw new ApiError(401, payload);
    }
  }

  if (!response.ok) throw new ApiError(response.status, payload);
  return payload;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body ?? {}),
  delete: (path) => request('DELETE', path),

  /** Sign in. The refresh + CSRF cookies are set by the server. */
  async login(email, password) {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, payload);
    accessToken = payload.accessToken;
    return payload;
  },

  /** Restore a session on page load using the httpOnly cookie. */
  restore: refreshSession,

  async logout() {
    try {
      await request('POST', '/auth/logout', {});
    } finally {
      accessToken = null;
    }
  },
};

export { BASE_URL };
