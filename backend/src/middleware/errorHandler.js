// ============================================================
// ERROR HANDLER
//
// The last middleware. Everything a route throws lands here.
//
// The split is between errors we raised on purpose (AppError —
// the message was written for the user) and everything else (a
// bug, a driver error, a failed constraint). The first kind is
// passed through; the second is logged in full and reported as a
// bare 500 with the request id, because driver messages carry
// table names, column names and sometimes the offending values.
// ============================================================

const { AppError } = require('../core/errors');
const config = require('../config/env');

// Postgres error codes worth translating into something a person
// can act on, rather than letting them surface as a 500.
const PG_CODES = {
  '23505': { status: 409, message: 'That record already exists.' },       // unique_violation
  '23503': { status: 409, message: 'That change conflicts with related records.' }, // foreign_key_violation
  '23514': { status: 400, message: 'That value is outside the allowed range.' },    // check_violation
  '22P02': { status: 400, message: 'One of the values was the wrong type.' },       // invalid_text_representation
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.code || 'error', message: err.message, requestId: req.id };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  const translated = PG_CODES[err.code];
  if (translated) {
    console.warn(`[${req.id}] database constraint ${err.code}: ${err.message}`);
    return res.status(translated.status).json({
      error: 'conflict',
      message: translated.message,
      requestId: req.id,
    });
  }

  // Body-parser rejecting malformed JSON is a client mistake, not
  // a server fault, and it should not page anyone at 3am.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_request', message: 'The request body was not valid JSON.', requestId: req.id });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'payload_too_large', message: 'That request was too large.', requestId: req.id });
  }

  console.error(`[${req.id}] Unhandled error on ${req.method} ${req.originalUrl}:`, err);

  res.status(500).json({
    error: 'server_error',
    message: 'Something went wrong on our end. Quote the request id if you report this.',
    requestId: req.id,
    // Only outside production, and only the message — never a
    // stack trace over the wire.
    ...(config.isProduction ? {} : { debug: err.message }),
  });
}

module.exports = errorHandler;
