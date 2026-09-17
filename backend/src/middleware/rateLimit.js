// ============================================================
// RATE LIMITING
//
// A fixed-window counter held in process memory. Two limiters:
// a broad one on the whole API, and a much tighter one on the
// sign-in and refresh endpoints, which are where guessing
// attacks actually land.
//
// In-memory means per-process: several instances behind a load
// balancer each count separately, so the effective limit is
// N x the configured number. For a deployment of that shape the
// counter belongs in Redis. It is written against a small
// interface so swapping the store is a contained change.
//
// This sits alongside, not instead of, the per-account lockout in
// the auth service. Per-IP limits stop one host hammering many
// accounts; per-account lockout stops many hosts hammering one
// account. Neither covers the other's case.
// ============================================================

const { TooMany } = require('../core/errors');

function createLimiter({ windowMs, max, keyFn, message }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Expired entries would otherwise accumulate one per IP seen,
  // which is a slow memory leak on a public endpoint.
  const sweeper = setInterval(() => {
    const now = Date.now();
    hits.forEach((entry, key) => {
      if (entry.resetAt <= now) hits.delete(key);
    });
  }, windowMs).unref();

  function middleware(req, res, next) {
    const key = keyFn ? keyFn(req) : req.clientIp || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return next(TooMany(message || `Too many requests. Try again in ${retryAfter} seconds.`));
    }
    return next();
  }

  middleware.reset = (key) => hits.delete(key);
  middleware.stop = () => clearInterval(sweeper);
  return middleware;
}

module.exports = { createLimiter };
