-- ============================================================
-- Bedline — PostgreSQL schema (v2, module/permission driven)
--
--   psql -U postgres -d hospital_db -f backend/src/db/schema.sql
--
-- WHAT CHANGED FROM v1
-- --------------------
-- v1 stored a user's role as a hard-coded string enum
-- ('admin','doctor',...) and scattered role names through every
-- route file. That meant a new role could not exist without a
-- code change and a redeploy.
--
-- v2 makes the authorisation model *data*:
--
--   modules      — one row per feature area of the product
--                  (bed management, admissions, billing, ...).
--                  Each has a stable integer id AND a stable
--                  string key, exactly like users have ids.
--   permissions  — the individual actions inside a module
--                  ('bed.assign', 'billing.clear_dues', ...).
--   roles        — named bundles, created at runtime by an admin.
--   role_permissions — the many-to-many join that defines what a
--                  role can actually do.
--
-- A user points at a role; a role points at permissions; a
-- permission points at a module. The UI shows a module tile only
-- when the signed-in user holds at least one permission belonging
-- to that module, and the API enforces the same thing per route.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS remarks CASCADE;
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS admissions CASCADE;
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS wards CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS modules CASCADE;

-- ------------------------------------------------------------
-- MODULES — the services the system is split into.
--
-- `key` is the stable identifier the backend code refers to
-- (e.g. 'admissions'); `id` is the surrogate key rows point at.
-- Never renumber or reuse an id — permissions and audit rows
-- reference it.
--
-- `route` is the frontend path the module's UI lives at, and
-- `sort_order`/`icon` drive the shared launcher page. Storing
-- presentation hints here means adding a module is one row plus
-- one folder, with no edit to the navigation component.
-- ------------------------------------------------------------
CREATE TABLE modules (
    id          SERIAL PRIMARY KEY,
    key         VARCHAR(60)  UNIQUE NOT NULL,
    name        VARCHAR(120) NOT NULL,
    description TEXT,
    route       VARCHAR(120) NOT NULL,
    icon        VARCHAR(40),
    sort_order  INTEGER NOT NULL DEFAULT 100,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- PERMISSIONS — a single action inside a module.
--
-- Keys read as '<module>.<verb>' so they are self-describing in
-- logs and in the role editor. `is_dangerous` flags the ones that
-- let a holder bypass another rule (override a senior's bed
-- decision, discharge past an unpaid bill, edit roles); the admin
-- UI marks these so nobody grants them by accident.
-- ------------------------------------------------------------
CREATE TABLE permissions (
    id           SERIAL PRIMARY KEY,
    module_id    INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    key          VARCHAR(80) UNIQUE NOT NULL,
    name         VARCHAR(120) NOT NULL,
    description  TEXT,
    is_dangerous BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_permissions_module ON permissions(module_id);

-- ------------------------------------------------------------
-- ROLES — created and edited at runtime by an admin.
--
-- `rank` preserves the original seniority rule: a bed assignment
-- stamped by a higher-ranked role cannot be undone by a lower one.
-- Keeping it numeric (rather than a hard-coded nurse<doctor<admin
-- list) means a new "Senior Nurse" role can slot in at rank 15
-- without touching application code.
--
-- `is_system` marks the roles the product ships with. They can be
-- re-permissioned but not deleted, so an admin cannot lock every-
-- one out by removing the role their own account depends on.
-- `is_protected` marks the built-in administrator role, whose
-- permissions are also frozen — it is the recovery path.
-- ------------------------------------------------------------
CREATE TABLE roles (
    id           SERIAL PRIMARY KEY,
    key          VARCHAR(60) UNIQUE NOT NULL,
    name         VARCHAR(120) NOT NULL,
    description  TEXT,
    rank         INTEGER NOT NULL DEFAULT 10,
    is_system    BOOLEAN NOT NULL DEFAULT FALSE,
    is_protected BOOLEAN NOT NULL DEFAULT FALSE,
    created_by   INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
    role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by    INTEGER,
    PRIMARY KEY (role_id, permission_id)
);

-- ------------------------------------------------------------
-- USERS
--
-- `token_version` is the kill switch. Every access token carries
-- the value it was minted with; bumping the column invalidates
-- every token that user is holding, everywhere, on the next
-- request. Deactivating an account, changing a password, or
-- moving someone to a different role all bump it.
--
-- `failed_login_attempts` / `locked_until` implement throttling
-- per account, on top of the per-IP rate limiter, so an attacker
-- spreading attempts across many IPs still hits a wall.
-- ------------------------------------------------------------
CREATE TABLE users (
    id                    SERIAL PRIMARY KEY,
    name                  VARCHAR(120) NOT NULL,
    email                 VARCHAR(160) UNIQUE NOT NULL,
    password_hash         TEXT NOT NULL,
    role_id               INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
    token_version         INTEGER NOT NULL DEFAULT 0,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    password_changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email is matched case-insensitively at login, so the uniqueness
-- guarantee has to be case-insensitive too — otherwise
-- 'Ava@x.com' and 'ava@x.com' become two accounts that both
-- answer to the same login.
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));
CREATE INDEX idx_users_role ON users(role_id);

ALTER TABLE roles
  ADD CONSTRAINT roles_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE role_permissions
  ADD CONSTRAINT role_permissions_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- SESSIONS — one row per active refresh token.
--
-- Only the SHA-256 of the refresh token is stored, so a database
-- leak does not hand an attacker usable sessions. Each refresh
-- rotates the token and stamps `replaced_by`, which is what makes
-- replay detectable: if a token that was already rotated comes
-- back, it was stolen, and the whole family is revoked.
-- ------------------------------------------------------------
CREATE TABLE sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      CHAR(64) UNIQUE NOT NULL,
    family_id       UUID NOT NULL,
    user_agent      TEXT,
    ip_address      INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  VARCHAR(60),
    replaced_by     INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user   ON sessions(user_id);
CREATE INDEX idx_sessions_family ON sessions(family_id);

-- ------------------------------------------------------------
-- PATIENTS
-- ------------------------------------------------------------
CREATE TABLE patients (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    name               VARCHAR(120) NOT NULL,
    age                INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 130)),
    gender             VARCHAR(20),
    contact            VARCHAR(30),
    admission_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (admission_status IN ('pending','admitted','discharged')),
    assigned_doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    dues_cleared       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_status ON patients(admission_status);

-- ------------------------------------------------------------
-- WARDS -> ROOMS -> BEDS
-- ------------------------------------------------------------
CREATE TABLE wards (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(80) NOT NULL,
    floor INTEGER,
    type  VARCHAR(40)
);

CREATE TABLE rooms (
    id          SERIAL PRIMARY KEY,
    ward_id     INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    capacity    INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
    UNIQUE (ward_id, room_number)
);

CREATE TABLE beds (
    id         SERIAL PRIMARY KEY,
    room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number VARCHAR(20) NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'vacant'
                 CHECK (status IN ('vacant','occupied','reserved','maintenance')),
    UNIQUE (room_id, bed_number)
);

-- ------------------------------------------------------------
-- ADMISSIONS
--
-- `assigned_by_role_id` records which ROLE made the assignment,
-- not a role name string. The seniority check compares that
-- role's current rank against the actor's, so if an admin later
-- re-ranks a role the rule follows automatically.
-- ------------------------------------------------------------
CREATE TABLE admissions (
    id                  SERIAL PRIMARY KEY,
    patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    bed_id              INTEGER NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
    doctor_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    admitted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discharged_at       TIMESTAMPTZ,
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','discharged'))
);

-- A bed can hold at most one active admission, and a patient can
-- hold at most one at a time. Enforced in the database, not just
-- in the service layer: two simultaneous assign requests would
-- otherwise both pass an application-level check and double-book
-- the bed.
CREATE UNIQUE INDEX idx_admissions_one_active_bed
  ON admissions(bed_id) WHERE status = 'active';
CREATE UNIQUE INDEX idx_admissions_one_active_patient
  ON admissions(patient_id) WHERE status = 'active';

-- ------------------------------------------------------------
-- CLINICAL RECORDS
-- ------------------------------------------------------------
CREATE TABLE medical_records (
    id         SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE remarks (
    id         SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    remark     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX idx_remarks_patient ON remarks(patient_id);

-- ------------------------------------------------------------
-- AUDIT LOGS
--
-- Append-only by convention: nothing in the application issues an
-- UPDATE or DELETE against this table. `details` is JSONB so each
-- module can record whatever context matters without a schema
-- change, and failed/denied attempts are recorded alongside
-- successful ones — a run of denials is the signal worth seeing.
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(60),
    module_key VARCHAR(60),
    action     VARCHAR(80) NOT NULL,
    entity     VARCHAR(40),
    entity_id  INTEGER,
    outcome    VARCHAR(20) NOT NULL DEFAULT 'success'
                 CHECK (outcome IN ('success','denied','failure')),
    details    JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_user    ON audit_logs(user_id);
CREATE INDEX idx_audit_module  ON audit_logs(module_key);

COMMIT;
