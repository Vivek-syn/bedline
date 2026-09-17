// One shared connection pool for the whole process.

const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  user: config.db.user,
  password: config.db.password,
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  max: config.db.max,
  ssl: config.db.ssl,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// An idle client erroring out (network blip, database restart)
// emits on the pool. Without a listener Node treats it as an
// unhandled 'error' event and kills the process.
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

/**
 * Run a statement. Always pass values as the second argument so
 * pg parameterises them — string-concatenating user input into
 * SQL is how injection happens.
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run several statements inside one transaction. The callback
 * receives a dedicated client; returning normally commits,
 * throwing rolls back, and the client is always released.
 *
 * Wrapping this in a helper rather than repeating BEGIN/COMMIT/
 * ROLLBACK in every service removes the most common version of
 * that bug: an early `return` between BEGIN and COMMIT that
 * leaks the client and leaves the transaction open.
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

async function verifyConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction, verifyConnection };
