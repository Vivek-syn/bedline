// This file creates ONE connection "pool" to PostgreSQL that the
// whole app shares. A pool keeps several open connections ready to
// go, instead of opening/closing a new connection for every query
// (which would be slow).

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// Quick sanity check when the server boots.
pool.connect()
  .then((client) => {
    console.log('✅ Connected to PostgreSQL');
    client.release(); // give the connection back to the pool
  })
  .catch((err) => {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
  });

// Every other file in the app will do:
//   const db = require('../config/db');
//   db.query('SELECT * FROM users WHERE id = $1', [id]);
module.exports = pool;
