// Small helper so we don't repeat jwt.sign(...) with the same
// options everywhere. A JWT ("JSON Web Token") is just a signed,
// tamper-proof string that encodes some data (here: user id + role).
// The client stores it and sends it back on every request so the
// server knows who's asking without needing a database lookup.

const jwt = require('jsonwebtoken');
require('dotenv').config();

function signToken(payload) {
  // payload = { id: user.id, role: user.role }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
