# Bedline

Hospital bed and admission management. Express + PostgreSQL API, React frontend.

Authorisation is **data, not code**. Features are split into self-contained modules, each declaring its own permissions; an administrator composes those permissions into roles at runtime and assigns roles to accounts. Adding a role needs no deploy, and adding a module needs one folder.

---

## Quick start

Requires Node 18+ and PostgreSQL 13+.

```bash
# 1. Configure
cd backend
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # REFRESH_TOKEN_SECRET
#   paste both into .env, then set DB_* to match your database

# 2. Create the database
createdb hospital_db

# 3. Build schema, sync modules, seed roles and demo data
npm install
npm run db:setup          # prints a generated admin password ONCE — copy it

# 4. Run the API
npm run dev               # http://localhost:5001
```

```bash
# 5. Run the frontend, in a second terminal
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Sign in with the email and password `db:setup` printed. You will be asked to
choose your own password immediately.

There is **no public sign-up**. Accounts are created by someone holding
`user.create`, which is how a role called "admin" stops being something a
stranger can select for themselves.

### Scripts

| Command | Where | Does |
|---|---|---|
| `npm run dev` | backend | API with reload |
| `npm start` | backend | API, production mode |
| `npm run db:setup` | backend | Create schema if absent, sync modules, seed |
| `npm run db:reset` | backend | **Drops every table**, then the above |
| `npm run check` | backend | Validate all module manifests, no database needed |
| `npm run dev` | frontend | Vite dev server |
| `npm run build` | frontend | Production bundle into `dist/` |

`npm run check` is the one to wire into CI. It loads every module router and
fails if a route guards a permission no manifest declares.

---

## How authorisation works

Four tables carry the whole model:

```
modules ──< permissions ──< role_permissions >── roles ──< users
```

- **modules** — one row per feature area, with a stable `id` and `key`, plus the
  frontend route and icon the launcher uses.
- **permissions** — a single action inside a module, keyed `noun.verb`
  (`bed.view`, `billing.clear_dues`). `is_dangerous` flags the ones that let a
  holder bypass a rule someone else relies on.
- **roles** — named bundles, created at runtime. `rank` encodes seniority.
- **role_permissions** — the join that decides what a role can do.

A user points at one role; the role points at permissions; each permission
belongs to a module. The UI shows a module tile when the user holds at least one
of its permissions, and the API checks the specific permission on every route.

### Permissions are never in the token

The access token carries only `{ sub, sid, ver }` — user, session, token
version. Permissions are resolved from the database on each request, behind a
15-second in-process cache that is explicitly cleared whenever a role is edited.

This is the central design decision. If permissions were baked into the JWT,
revoking one would do nothing until the token expired: an administrator who
removed access in a hurry would watch the person keep it for another 15 minutes.
Resolving per-request means a change in the role editor lands on the victim's
very next request. Verified against a live database — an unexpired token was
refused immediately after its role lost the permission.

### Seniority

The original system hard-coded `nurse < doctor < admin`. That is now a numeric
`rank` on each role. A bed decision can only be undone by an equal or higher
rank, or by someone holding the explicit override permission. A "Senior Nurse"
role at rank 35 slots between nurse (20) and doctor (50) with no code change.

### Guards against privilege escalation

Anyone who can edit roles is one careless endpoint away from granting themselves
everything, so:

1. **You cannot grant a permission you do not hold.** Otherwise a role with only
   `role.manage` could mint a role holding everything and assign it to itself.
2. **You cannot edit or create a role ranked above your own.**
3. **You cannot assign a role above your own rank**, including to yourself, and
   you cannot change your own role at all.
4. **The built-in Administrator role is frozen** — not editable, not deletable.
   It is the way back in when a role change goes wrong.
5. **The last active administrator cannot be deactivated or demoted.**
6. **Permissions you cannot see are not stripped by omission.** Editing a role
   preserves grants you are not entitled to touch.

All six were exercised against a running server; each returns a 403 or 409 with
a message naming the specific reason.

---

## Adding a module

Create `backend/src/modules/<key>/index.js`:

```js
module.exports = {
  key: 'pharmacy',                  // must equal the folder name
  name: 'Pharmacy',
  description: 'Dispense and track medication.',
  route: '/app/pharmacy',           // frontend path
  icon: 'clipboard',
  sortOrder: 70,
  basePath: '/pharmacy',            // mounts at /api/pharmacy

  permissions: [
    { key: 'pharmacy.view',     name: 'View prescriptions' },
    { key: 'pharmacy.dispense', name: 'Dispense medication', dangerous: true },
  ],

  router: () => require('./pharmacy.routes'),
};
```

Add `pharmacy.service.js`, `pharmacy.controller.js` and `pharmacy.routes.js`
beside it, guard each route with `requirePermission('pharmacy.view')`, and
restart. The registry discovers the folder, `syncRegistry()` writes the module
and its permissions into the database, the router mounts automatically behind
`authenticate`, and the new permissions appear as a group in the role editor.

The only frontend work is a page component and one `<Route>` in `App.jsx`. The
sidebar and launcher pick the module up on their own, because they render
whatever `/api/auth/me` returns.

The registry validates manifests at boot and **refuses to start** on a duplicate
permission key, a clashing `basePath`, a folder/key mismatch, or a missing
router — mistakes that would otherwise surface as a route nobody can ever reach.

---

## Security

| Concern | Approach |
|---|---|
| Password storage | bcrypt, cost 12, configurable |
| Password policy | 12 char minimum, common-password list, rejects name/email reuse |
| Session tokens | 15-min access token (memory) + 7-day refresh token (httpOnly cookie) |
| Refresh rotation | Single-use; replaying a rotated token revokes the whole family |
| Revocation | `token_version` column invalidates every token a user holds |
| Brute force | Per-IP+email rate limit **and** per-account lockout after 5 failures |
| User enumeration | Identical message and timing for wrong password vs unknown email |
| CSRF | SameSite=strict plus a double-submit cookie/header pair on refresh |
| XSS token theft | Access token in a module variable, never `localStorage` |
| CORS | Explicit origin allow-list; never reflects arbitrary origins |
| Mass assignment | Schema validation strips unknown fields before handlers see them |
| SQL injection | Parameterised queries throughout |
| Race conditions | `FOR UPDATE` row locks plus unique partial indexes |
| Error leakage | Driver messages and stack traces never sent to clients |
| Audit trail | Every mutation **and every denial**, append-only, with redaction |
| Realtime leakage | Socket events addressed to permission rooms, ids only |

Two of these are deliberately simple and should be upgraded before production
at scale:

- The **rate limiter** and the **permission cache** are per-process. Behind
  several instances the effective limit is N× the configured number, and cache
  staleness is per-box. Both belong in Redis.
- The **password policy** checks a small built-in list. Production should check
  a breach corpus via the Have I Been Pwned k-anonymity API.

---

## Project layout

```
backend/
  server.js                  boot: verify DB, sync registry, listen
  scripts/
    setup-db.js              schema + seed roles + first admin
    check.js                 validate manifests without a database
  src/
    app.js                   Express assembly, mounts modules from the registry
    config/
      env.js                 validated config, exits on weak secrets
      db.js                  pool + transaction helper
    core/
      registry.js            module discovery and validation
      accessControl.js       permission resolution, cache, seniority
      tokens.js              access/refresh token minting
      passwords.js           hashing and strength policy
      validate.js            schema validation middleware
      audit.js               audit writer with redaction
      errors.js              typed errors + asyncHandler
    middleware/
      requestContext.js      request id and client IP
      authenticate.js        verify token, load live principal
      requirePermission.js   the authorisation gate
      csrf.js                double-submit check
      rateLimit.js           fixed-window limiter
      errorHandler.js        central error translation
    auth/                    sign in, refresh, logout, change password
    modules/<key>/           index.js + service + controller + routes
    sockets/                 permission-scoped realtime
    db/schema.sql            tables, constraints, indexes

frontend/
  src/
    App.jsx                  routes, each wrapped in its permission
    main.jsx                 entry
    index.css                design tokens and all styles
    lib/
      api.js                 fetch wrapper, token handling, auto-refresh
      realtime.js            shared socket
      useModuleData.js       load + reload-on-event hook
    auth/
      AuthContext.jsx        session, permissions, can()
      RequirePermission.jsx  route guard
      SignIn.jsx
    app/
      Shell.jsx              topbar + permission-driven sidebar
      Launcher.jsx           the common landing page
    components/              Icon, shared UI pieces
    modules/                 one page per backend module
```

---

## Shipped modules

| Module | API | Permissions |
|---|---|---|
| Patient portal | `/api/my-stay` | 1 |
| Patient registry | `/api/patients` | 3 |
| Bed management | `/api/beds` | 4 |
| Admissions | `/api/admissions` | 5 |
| Ward management | `/api/wards` | 2 |
| Clinical records | `/api/records` | 3 |
| Billing | `/api/billing` | 3 |
| Access control | `/api/roles` | 3 |
| User management | `/api/users` | 5 |
| Activity log | `/api/activity` | 1 |

Seeded roles — Administrator (rank 100, all permissions, protected), Doctor (50),
Nurse (20), Receptionist (20), Patient (1) — reproduce the original system's
behaviour. Every one except Administrator can be re-permissioned from the UI.

---

## Upgrading from v1

The schema changed shape (`users.role` string → `users.role_id` foreign key), so
there is no in-place migration script. On a throwaway database run
`npm run db:reset`. On a database with real data you will need to write a
migration that creates the new tables, inserts the five seed roles, and maps each
existing `users.role` string to the matching `role_id` before dropping the old
column.

Two behaviour changes worth knowing:

- `POST /api/auth/register` is **gone**. It let anyone choose their own role.
  Accounts now come from `POST /api/users`, behind `user.create`.
- Every existing user must set a new password. v1 password hashes are still
  valid bcrypt and carry over, but new accounts are created with
  `must_change_password`.
