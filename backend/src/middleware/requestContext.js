// Gives every request an id and a trustworthy client IP before
// anything else runs. The id ties a user-visible error message to
// a server log line and an audit row; the IP feeds rate limiting
// and the audit trail.

const crypto = require('crypto');

function requestContext(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);

  // Express's req.ip already honours `trust proxy`, which server.js
  // configures for the real deployment. Falling back to the socket
  // address keeps this working when the app is run directly.
  // X-Forwarded-For is never read by hand here: behind no proxy it
  // is attacker-controlled, and trusting it would let anyone
  // sidestep per-IP throttling by rotating a header.
  req.clientIp = req.ip || req.socket?.remoteAddress || null;
  req.startedAt = Date.now();
  next();
}

module.exports = requestContext;
