// ============================================================
// SERVER ENTRYPOINT
//
//   npm run dev     development, with reload
//   npm start       production
//
// Boot order matters here. The database must answer before the
// registry sync can run, and the sync must finish before the
// first request arrives — otherwise a route could guard a
// permission that has no row yet and deny everybody.
// ============================================================

const http = require('http');
const config = require('./src/config/env');
const db = require('./src/config/db');
const createApp = require('./src/app');
const registry = require('./src/core/registry');
const accessControlService = require('./src/modules/access-control/accessControl.service');
const sockets = require('./src/sockets/socket');

async function start() {
  console.log(`\nBedline API — ${config.nodeEnv}`);

  try {
    await db.verifyConnection();
    console.log('  database   connected');
  } catch (err) {
    console.error(`  database   FAILED: ${err.message}`);
    console.error('\nCheck DB_HOST/DB_PORT/DB_NAME in backend/.env and that PostgreSQL is running.\n');
    process.exit(1);
  }

  // Push the code-side module and permission definitions into the
  // database. Idempotent, so it runs on every boot and a new
  // module is live the moment the server restarts.
  try {
    const summary = await accessControlService.syncRegistry();
    console.log(`  modules    ${summary.modules} registered, ${summary.permissions} permissions`);
    if (summary.stale.length > 0) {
      // Not deleted automatically: a permission vanishing from the
      // code is more often a rename in progress than a deliberate
      // removal, and dropping it would revoke access silently.
      console.warn(`  warning    ${summary.stale.length} permission(s) in the database are no longer declared in code: ${summary.stale.join(', ')}`);
    }
  } catch (err) {
    console.error(`  modules    FAILED: ${err.message}`);
    console.error('\nHas the schema been created? Run:  npm run db:setup\n');
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);
  sockets.initialize(server);

  server.listen(config.port, () => {
    console.log(`  listening  http://localhost:${config.port}`);
    console.log(`  mounted    ${registry.modules.map((module) => `/api${module.basePath}`).join('  ')}\n`);
  });

  // Finish in-flight requests before exiting, so a deploy does not
  // cut a discharge off halfway through its transaction.
  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(async () => {
      await db.pool.end();
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Shutdown timed out; forcing exit.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // A rejected promise nobody caught has left the process in a
  // state we cannot reason about. Log it loudly rather than
  // letting Node continue in an unknown condition.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });
}

start();
