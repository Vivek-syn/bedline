// ============================================================
// APP
//
// Builds the Express app: global middleware, the auth routes,
// then every registered module mounted from its manifest.
//
// The mounting loop is the payoff of the registry. There is no
// list of app.use() calls to keep in step with the modules
// folder, and every module route is behind `authenticate` by
// construction — a new module cannot accidentally ship public.
// ============================================================

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const registry = require('./core/registry');
const requestContext = require('./middleware/requestContext');
const authenticate = require('./middleware/authenticate');
const errorHandler = require('./middleware/errorHandler');
const { createLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./auth/auth.routes');
const { asyncHandler, NotFound } = require('./core/errors');

function createApp() {
  const app = express();

  // Behind a load balancer, req.ip must come from X-Forwarded-For
  // — but only when a proxy we control actually sets it. Trusting
  // one hop is right for a single reverse proxy; trusting every
  // hop would let a client spoof its own IP and evade rate limits.
  app.set('trust proxy', config.isProduction ? 1 : false);

  // Express advertises itself in a header by default, which tells
  // an attacker which CVE list to start from.
  app.disable('x-powered-by');

  app.use(requestContext);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // The API returns JSON only. Nothing it serves should
          // ever be allowed to execute a script, so if a response
          // is somehow rendered as HTML the payload is inert.
          scriptSrc: ["'none'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      // Send the origin but not the path to other sites, so a URL
      // containing a patient id never leaks in a Referer header.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  app.use(
    cors({
      // An allow-list, not a reflector. `credentials: true` with a
      // reflected origin would let any site make authenticated
      // requests using a signed-in user's cookies.
      origin(origin, callback) {
        if (!origin) return callback(null, true); // curl, server-to-server
        if (config.cors.origins.includes(origin)) return callback(null, true);
        return callback(new Error('This origin is not allowed to call the API.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      maxAge: 600,
    })
  );

  // A body limit, because the default is 100kb of JSON per request
  // and an unbounded one is a cheap way to exhaust memory.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ status: 'ok', requestId: req.id }));

  // A broad ceiling across the API. The sign-in endpoints carry
  // their own, much tighter limit on top of this.
  app.use(
    '/api',
    createLimiter({
      windowMs: config.rateLimit.apiWindowMinutes * 60 * 1000,
      max: config.rateLimit.apiMaxPerWindow,
    })
  );

  app.use('/api/auth', authRoutes);

  // Every module, mounted under /api from its own manifest and
  // authenticated before its router is reached. Authorisation is
  // then per-route inside the module, via requirePermission.
  registry.modules.forEach((module) => {
    app.use(`/api${module.basePath}`, authenticate, module.router());
  });

  // The module catalogue the launcher renders. It returns only
  // what the caller can reach, so no client ever learns the shape
  // of the parts of the system it has no business seeing.
  app.get(
    '/api/modules',
    authenticate,
    asyncHandler(async (req, res) => {
      const accessControl = require('./core/accessControl');
      res.json(accessControl.visibleModules(req.user));
    })
  );

  app.use((req, res, next) => next(NotFound(`No route for ${req.method} ${req.originalUrl}.`)));
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
