// A catch-all error handler. In Express, an error-handling
// middleware is recognized by having FOUR parameters (err, req, res, next)
// instead of three. If any route calls next(err), or throws inside
// an async handler wrapped properly, it lands here instead of
// crashing the whole server.

function errorHandler(err, req, res, next) {
  console.error('🔥 Error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong on the server.',
  });
}

module.exports = errorHandler;
