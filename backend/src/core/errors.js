// ============================================================
// ERRORS
//
// Services throw AppError; the central error handler turns it
// into a response. Anything else that reaches the handler is
// treated as an unexpected bug: logged in full, reported to the
// client as a generic 500.
//
// The split matters. `ValidationError` tells the user what to
// fix. An unexpected TypeError must never be echoed back — stack
// traces and driver messages leak table names, file paths and
// query shapes that are useful only to an attacker.
// ============================================================

class AppError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.expected = true;          // safe to show the message to the caller
    this.code = options.code || null;
    this.details = options.details || null;
  }
}

const BadRequest   = (message, details) => new AppError(400, message, { code: 'bad_request', details });
const Unauthorized = (message = 'Sign in to continue.') => new AppError(401, message, { code: 'unauthorized' });
const Forbidden    = (message = 'You do not have access to this action.') => new AppError(403, message, { code: 'forbidden' });
const NotFound     = (message = 'Not found.') => new AppError(404, message, { code: 'not_found' });
const Conflict     = (message) => new AppError(409, message, { code: 'conflict' });
const TooMany      = (message = 'Too many requests. Try again shortly.') => new AppError(429, message, { code: 'rate_limited' });

class ValidationError extends AppError {
  constructor(fieldErrors) {
    super(400, 'Some fields need attention.', { code: 'validation_failed', details: fieldErrors });
    this.name = 'ValidationError';
  }
}

/**
 * Wrap an async route handler so a rejected promise reaches
 * Express's error pipeline. Without this, an `await` that throws
 * inside a handler produces an unhandled rejection and the
 * request hangs until the client times out.
 */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = {
  AppError,
  ValidationError,
  BadRequest,
  Unauthorized,
  Forbidden,
  NotFound,
  Conflict,
  TooMany,
  asyncHandler,
};
