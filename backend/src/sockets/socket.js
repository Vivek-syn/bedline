// ============================================================
// REALTIME
//
// The socket layer authenticates the same way the REST API does
// and then joins each connection to one room per permission the
// user holds. Broadcasts are addressed to a permission room
// rather than to everyone.
//
// That matters: `io.emit()` sends to every connected client, so
// the previous version pushed admission events to patients'
// browsers too. Even a bare id is a leak if the recipient was
// never meant to know the event happened.
// ============================================================

const { Server } = require('socket.io');
const config = require('../config/env');
const { verifyAccessToken } = require('../core/tokens');
const accessControl = require('../core/accessControl');
const db = require('../config/db');

let io = null;

async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Sign in to continue.'));

    const claims = verifyAccessToken(token);
    const userId = Number.parseInt(claims.sub, 10);

    const principal = await accessControl.getPrincipal(userId);
    if (!principal) return next(new Error('This account is no longer active.'));
    if (principal.tokenVersion !== claims.ver) return next(new Error('Your access changed. Sign in again.'));

    // The same session check the HTTP path makes. A socket that
    // skipped it would survive a sign-out and keep receiving
    // events on a revoked session for as long as it stayed open.
    const session = await db.query(
      `SELECT id FROM sessions
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
      [claims.sid, userId]
    );
    if (session.rows.length === 0) return next(new Error('This session was signed out.'));

    socket.principal = principal;
    socket.sessionId = claims.sid;
    return next();
  } catch (err) {
    return next(new Error('Your session is no longer valid.'));
  }
}

function initialize(server) {
  io = new Server(server, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Long-lived sockets outlive a 15-minute access token, so the
    // client reconnects with a fresh one rather than the server
    // trusting the original indefinitely.
    pingTimeout: 30_000,
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    socket.principal.permissions.forEach((permission) => socket.join(`perm:${permission}`));
    socket.join(`user:${socket.principal.id}`);
    socket.emit('ready', { userId: socket.principal.id, role: socket.principal.role.key });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initialize, getIO };
