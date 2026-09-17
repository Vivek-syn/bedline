// ============================================================
// DATABASE SETUP
//
//   npm run db:setup          create schema + seed demo data
//   npm run db:setup -- --reset   drop everything first
//
// Creates the tables, syncs the module registry, seeds the five
// starting roles with sensible permission sets, and creates the
// first administrator.
//
// The admin password is generated and printed once. It is not
// hard-coded, and there is no default: a seeded well-known
// password is the single most reliable way a demo system becomes
// a compromised production system.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/config/db');
const passwords = require('../src/core/passwords');
const accessControlService = require('../src/modules/access-control/accessControl.service');

const reset = process.argv.includes('--reset');

/**
 * The roles Bedline ships with, described by which permissions
 * they hold. This mirrors the behaviour of the original
 * hard-coded roles, so an existing deployment behaves the same
 * way after the upgrade — the difference is that an admin can now
 * change any of it from the UI.
 *
 * `rank` drives the seniority rule on bed decisions:
 * a nurse (20) cannot undo a doctor's (50) assignment.
 */
const SEED_ROLES = [
  {
    key: 'administrator',
    name: 'Administrator',
    description: 'Full access, including roles and accounts. Cannot be deleted or edited.',
    rank: 100,
    isSystem: true,
    isProtected: true,
    permissions: '*',
  },
  {
    key: 'doctor',
    name: 'Doctor',
    description: 'Admits and discharges patients, and writes to charts.',
    rank: 50,
    isSystem: true,
    permissions: [
      'patient.view', 'patient.update',
      'bed.view',
      'ward.view',
      'admission.view', 'admission.assign', 'admission.discharge',
      'admission.override_assignment',
      'record.view', 'record.create', 'remark.create',
      'billing.view',
    ],
  },
  {
    key: 'nurse',
    name: 'Nurse',
    description: 'Manages bed status and assists with admissions. Cannot undo a doctor\u2019s decision.',
    rank: 20,
    isSystem: true,
    permissions: [
      'patient.view',
      'bed.view', 'bed.update_status',
      'ward.view',
      'admission.view', 'admission.assign', 'admission.discharge',
      'record.view', 'remark.create',
    ],
  },
  {
    key: 'receptionist',
    name: 'Receptionist',
    description: 'Registers arrivals and clears bills. No access to clinical records.',
    rank: 20,
    isSystem: true,
    permissions: [
      'patient.view', 'patient.create', 'patient.update',
      'bed.view',
      'ward.view',
      'admission.view',
      'billing.view', 'billing.clear_dues',
    ],
  },
  {
    key: 'patient',
    name: 'Patient',
    description: 'Can see their own stay and nothing else.',
    rank: 1,
    isSystem: true,
    permissions: ['portal.view_own'],
  },
];

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
  await db.query(sql);
  console.log('  schema     created');
}

async function tablesExist() {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users','roles','permissions','modules')`
  );
  return result.rows[0].count === 4;
}

async function seedRoles() {
  const permissionRows = await db.query('SELECT id, key FROM permissions');
  const permissionIdByKey = new Map(permissionRows.rows.map((row) => [row.key, row.id]));

  // eslint-disable-next-line no-restricted-syntax
  for (const role of SEED_ROLES) {
    // eslint-disable-next-line no-await-in-loop
    const inserted = await db.query(
      `INSERT INTO roles (key, name, description, rank, is_system, is_protected)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             is_system = EXCLUDED.is_system,
             is_protected = EXCLUDED.is_protected
       RETURNING id`,
      [role.key, role.name, role.description, role.rank, role.isSystem, Boolean(role.isProtected)]
    );
    const roleId = inserted.rows[0].id;

    const keys = role.permissions === '*'
      ? [...permissionIdByKey.keys()]
      : role.permissions;

    const missing = keys.filter((key) => !permissionIdByKey.has(key));
    if (missing.length > 0) {
      throw new Error(`Seed role "${role.key}" references unknown permissions: ${missing.join(', ')}`);
    }

    const ids = keys.map((key) => permissionIdByKey.get(key));

    // Grants are added, never removed. Re-running setup on a live
    // database must not quietly undo an admin's customisations to
    // a shipped role.
    // eslint-disable-next-line no-await-in-loop
    await db.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, UNNEST($2::int[])
       ON CONFLICT DO NOTHING`,
      [roleId, ids]
    );
  }

  console.log(`  roles      ${SEED_ROLES.length} seeded`);
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(24);
  const body = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  return `${body.slice(0, 6)}-${body.slice(6, 12)}-${body.slice(12, 18)}-${body.slice(18, 24)}`;
}

async function seedAdministrator() {
  const existing = await db.query(
    `SELECT u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.is_protected LIMIT 1`
  );
  if (existing.rows.length > 0) {
    console.log(`  admin      already exists (${existing.rows[0].email})`);
    return null;
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@hospital.local';
  const password = process.env.SEED_ADMIN_PASSWORD || generatePassword();
  const passwordHash = await passwords.hash(password);

  const role = await db.query('SELECT id FROM roles WHERE is_protected LIMIT 1');

  await db.query(
    `INSERT INTO users (name, email, password_hash, role_id, must_change_password)
     VALUES ($1, $2, $3, $4, TRUE)`,
    ['System Administrator', email, passwordHash, role.rows[0].id]
  );

  return { email, password, generated: !process.env.SEED_ADMIN_PASSWORD };
}

async function seedDemoData() {
  const existing = await db.query('SELECT COUNT(*)::int AS count FROM wards');
  if (existing.rows[0].count > 0) {
    console.log('  demo data  skipped (wards already present)');
    return;
  }

  await db.transaction(async (client) => {
    const wards = await client.query(
      `INSERT INTO wards (name, floor, type) VALUES
         ('General Ward A', 1, 'General'),
         ('Intensive Care', 2, 'ICU'),
         ('Maternity', 3, 'Maternity')
       RETURNING id`
    );
    const [generalId, icuId, maternityId] = wards.rows.map((row) => row.id);

    const rooms = await client.query(
      `INSERT INTO rooms (ward_id, room_number, capacity) VALUES
         ($1,'101',2), ($1,'102',2), ($2,'201',1), ($2,'202',1), ($3,'301',2)
       RETURNING id`,
      [generalId, icuId, maternityId]
    );
    const roomIds = rooms.rows.map((row) => row.id);

    await client.query(
      `INSERT INTO beds (room_id, bed_number) VALUES
         ($1,'101-A'), ($1,'101-B'),
         ($2,'102-A'), ($2,'102-B'),
         ($3,'201-A'),
         ($4,'202-A'),
         ($5,'301-A'), ($5,'301-B')`,
      roomIds
    );

    await client.query(
      `INSERT INTO patients (name, age, gender, contact) VALUES
         ('Anita Rao', 34, 'Female', '9000000001'),
         ('Joseph Mathew', 67, 'Male', '9000000002'),
         ('Priya Nair', 28, 'Female', '9000000003')`
    );
  });

  console.log('  demo data  3 wards, 5 rooms, 8 beds, 3 patients');
}

async function main() {
  console.log('\nBedline database setup\n');

  if (reset) {
    console.log('  reset      dropping existing tables');
    await runSchema();
  } else if (await tablesExist()) {
    console.log('  schema     already present (use --reset to rebuild)');
  } else {
    await runSchema();
  }

  const summary = await accessControlService.syncRegistry();
  console.log(`  registry   ${summary.modules} modules, ${summary.permissions} permissions`);

  await seedRoles();
  const admin = await seedAdministrator();
  await seedDemoData();

  if (admin) {
    console.log('\n  ─────────────────────────────────────────────');
    console.log('  Administrator account created');
    console.log(`    email     ${admin.email}`);
    console.log(`    password  ${admin.password}`);
    if (admin.generated) {
      console.log('\n  This password is shown once and is not stored anywhere');
      console.log('  in readable form. Copy it now. You will be asked to');
      console.log('  change it the first time you sign in.');
    }
    console.log('  ─────────────────────────────────────────────\n');
  }

  console.log('Done. Start the API with: npm run dev\n');
  await db.pool.end();
}

main().catch(async (err) => {
  console.error('\nSetup failed:', err.message);
  console.error(err.stack);
  await db.pool.end();
  process.exit(1);
});
