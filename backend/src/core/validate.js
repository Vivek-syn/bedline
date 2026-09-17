// ============================================================
// INPUT VALIDATION
//
// A small schema checker used as Express middleware. Every route
// that accepts input declares a schema; the handler downstream
// then works with `req.valid`, which contains only the fields the
// schema named, coerced to the right types.
//
// Two properties matter more than the convenience:
//
//   1. Handlers never touch req.body directly, so a client cannot
//      smuggle an extra field (role_id, is_active, dues_cleared)
//      into an object that gets spread into an UPDATE. That is
//      mass assignment, and stripping unknown keys is what stops
//      it.
//   2. Everything is length-bounded. Unbounded strings reach the
//      database as multi-megabyte values and become a cheap way
//      to fill the disk.
// ============================================================

const { ValidationError } = require('./errors');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const rules = {
  string({ min = 0, max = 255, pattern = null, trim = true, lower = false } = {}) {
    return (value, field) => {
      if (typeof value !== 'string') throw new Error(`${field} must be text.`);
      let next = trim ? value.trim() : value;
      if (lower) next = next.toLowerCase();
      if (next.length < min) throw new Error(`${field} must be at least ${min} characters.`);
      if (next.length > max) throw new Error(`${field} must be ${max} characters or fewer.`);
      if (pattern && !pattern.test(next)) throw new Error(`${field} is not in the expected format.`);
      return next;
    };
  },

  // Passwords are never trimmed: a trailing space the user typed
  // on purpose is part of the secret, and trimming it at
  // registration but not at login would lock them out.
  password() {
    return (value, field) => {
      if (typeof value !== 'string') throw new Error(`${field} must be text.`);
      if (value.length === 0) throw new Error(`${field} is required.`);
      return value;
    };
  },

  email() {
    return (value, field) => {
      const next = String(value || '').trim().toLowerCase();
      if (!EMAIL_PATTERN.test(next)) throw new Error(`${field} must be a valid email address.`);
      if (next.length > 160) throw new Error(`${field} is too long.`);
      return next;
    };
  },

  integer({ min = -2147483648, max = 2147483647 } = {}) {
    return (value, field) => {
      const next = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
      if (!Number.isInteger(next)) throw new Error(`${field} must be a whole number.`);
      if (next < min) throw new Error(`${field} must be ${min} or more.`);
      if (next > max) throw new Error(`${field} must be ${max} or less.`);
      return next;
    };
  },

  boolean() {
    return (value, field) => {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new Error(`${field} must be true or false.`);
    };
  },

  enumOf(allowed) {
    return (value, field) => {
      const next = String(value);
      if (!allowed.includes(next)) {
        throw new Error(`${field} must be one of: ${allowed.join(', ')}.`);
      }
      return next;
    };
  },

  /** An array of unique integers — used for permission id lists. */
  integerArray({ max = 500 } = {}) {
    return (value, field) => {
      if (!Array.isArray(value)) throw new Error(`${field} must be a list.`);
      if (value.length > max) throw new Error(`${field} may contain at most ${max} entries.`);
      const parsed = value.map((entry) => {
        const num = typeof entry === 'number' ? entry : Number.parseInt(String(entry), 10);
        if (!Number.isInteger(num) || num < 1) throw new Error(`${field} must contain positive whole numbers.`);
        return num;
      });
      return [...new Set(parsed)];
    };
  },
};

/**
 * Build middleware from a schema.
 *
 *   validate({ body: { email: { rule: rules.email(), required: true } } })
 *
 * `source` is 'body', 'params' or 'query'. Results land on
 * req.valid.<source>.
 */
function validate(schema) {
  return (req, res, next) => {
    const fieldErrors = {};
    req.valid = { body: {}, params: {}, query: {} };

    Object.entries(schema).forEach(([source, fields]) => {
      const input = req[source] || {};

      Object.entries(fields).forEach(([field, spec]) => {
        const raw = input[field];
        const missing = raw === undefined || raw === null || raw === '';

        if (missing) {
          if (spec.required) {
            fieldErrors[field] = [`${spec.label || field} is required.`];
          } else if (spec.default !== undefined) {
            req.valid[source][field] = spec.default;
          }
          return;
        }

        try {
          req.valid[source][field] = spec.rule(raw, spec.label || field);
        } catch (err) {
          fieldErrors[field] = [err.message];
        }
      });
    });

    if (Object.keys(fieldErrors).length > 0) {
      return next(new ValidationError(fieldErrors));
    }
    return next();
  };
}

/** Shorthand for the very common `/:id` numeric path parameter. */
const idParam = (name = 'id') => ({
  params: { [name]: { rule: rules.integer({ min: 1 }), required: true, label: name } },
});

module.exports = { validate, rules, idParam };
