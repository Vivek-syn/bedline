// ============================================================
// AUTHENTICATION MIDDLEWARE
//
// "Middleware" in Express is just a function that runs BETWEEN
// the incoming request and your route handler. It gets 3 things:
//   req  -> the incoming request
//   res  -> the response you could send
//   next -> a function you call to say "I'm done, move on"
//
// This one checks: "Is there a valid login token attached to
// this request?" If yes, it attaches the user's info to `req.user`
// and calls next(). If no, it stops the request right here with
// a 401 error — the route handler never even runs.
// ============================================================

const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  // The frontend sends the token like this:
  //   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1]; // "Bearer <token>" -> take the token part

  try {
    const decoded = verifyToken(token); // throws if invalid/expired
    req.user = decoded; // e.g. { id: 3, role: 'doctor', iat: ..., exp: ... }
    next(); // continue to the next middleware / the route handler
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = authenticate;
