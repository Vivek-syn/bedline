// ============================================================
// ACCESS CONTROL SERVICE
//
// Role CRUD. The rules below are what stop this module from
// becoming a privilege-escalation tool, since anyone who can edit
// roles is one careless endpoint away from granting themselves
// everything.
//
//   1. NO GRANTING WHAT YOU DO NOT HOLD. An editor can only put
//      permissions into a role that they themselves already have.
//      Without this, a role with only `role.manage` could mint a
//      role holding every permission in the system and assign it
//      to itself — so a narrow grant would silently be a total
//      one.
//
//   2. NO EDITING ABOVE YOUR RANK. You cannot modify a role that
//      outranks yours, which stops a mid-tier editor from
//      quietly rewriting what "Administrator" means.
//
//   3. THE BUILT-IN ADMIN ROLE IS FROZEN. Its permissions cannot
//      be changed and it cannot be deleted. It is the recovery
//      path when someone mis-configures everything else.
//
//   4. NO ORPHANS. A role in use cannot be deleted; move the
//      accounts first. The database would reject it anyway
//      (ON DELETE RESTRICT), but a clear message beats a
//      constraint error.
// ============================================================

const db = require('../../config/db');
const registry = require('../../core/registry');
const accessControl = require('../../core/accessControl');
const { NotFound, Conflict, Forbidden, BadRequest } = require('../../core/errors');

/**
 * The full permission catalogue, grouped by module — this is what
 * the role editor renders as a checklist. It is read from the
 * database rather than the registry so the ids match the ones the
 * client will send back.
 */
async function listCatalogue() {
  const result = await db.query(
    `SELECT m.id   AS module_id,
            m.key  AS module_key,
            m.name AS module_name,
            m.description AS module_description,
            m.icon, m.sort_order,
            p.id, p.key, p.name, p.description, p.is_dangerous
       FROM modules m
       JOIN permissions p ON p.module_id = m.id
      WHERE m.is_active
      ORDER BY m.sort_order, m.name, p.key`
  );

  const modules = new Map();
  result.rows.forEach((row) => {
    if (!modules.has(row.module_key)) {
      modules.set(row.module_key, {
        id: row.module_id,
        key: row.module_key,
        name: row.module_name,
        description: row.module_description,
        icon: row.icon,
        permissions: [],
      });
    }
    modules.get(row.module_key).permissions.push({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      dangerous: row.is_dangerous,
    });
  });

  return [...modules.values()];
}

async function listRoles() {
  const result = await db.query(
    `SELECT r.id, r.key, r.name, r.description, r.rank,
            r.is_system, r.is_protected, r.created_at,
            creator.name AS created_by_name,
            COUNT(DISTINCT u.id)::int AS user_count,
            COALESCE(
              ARRAY_AGG(DISTINCT p.id) FILTER (WHERE p.id IS NOT NULL), '{}'
            ) AS permission_ids,
            COALESCE(
              ARRAY_AGG(DISTINCT p.key) FILTER (WHERE p.key IS NOT NULL), '{}'
            ) AS permission_keys
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id AND u.is_active
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       LEFT JOIN users creator ON creator.id = r.created_by
      GROUP BY r.id, creator.name
      ORDER BY r.rank DESC, r.name`
  );
  return result.rows;
}

/**
 * `client` matters when this is called from inside a transaction.
 * The pool would hand back a different connection, which cannot
 * see the uncommitted writes — so the caller would get the role
 * as it was *before* its own update. Passing the transaction's
 * client keeps the read consistent with the write.
 */
async function getRole(roleId, client = db) {
  const result = await client.query(
    `SELECT r.id, r.key, r.name, r.description, r.rank, r.is_system, r.is_protected,
            COALESCE(ARRAY_AGG(p.id) FILTER (WHERE p.id IS NOT NULL), '{}') AS permission_ids
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE r.id = $1
      GROUP BY r.id`,
    [roleId]
  );
  if (result.rows.length === 0) throw NotFound('That role does not exist.');
  return result.rows[0];
}

/**
 * Rule 1. Turn the requested permission ids into keys and check
 * the editor holds every one of them.
 */
async function assertMayGrant(actor, permissionIds, client = db) {
  if (permissionIds.length === 0) return [];

  const result = await client.query(
    'SELECT id, key, name FROM permissions WHERE id = ANY($1::int[])',
    [permissionIds]
  );

  if (result.rows.length !== permissionIds.length) {
    const found = new Set(result.rows.map((row) => row.id));
    const missing = permissionIds.filter((id) => !found.has(id));
    throw BadRequest(`Some permissions no longer exist (ids: ${missing.join(', ')}).`);
  }

  const notHeld = result.rows.filter((row) => !accessControl.has(actor, row.key));
  if (notHeld.length > 0) {
    throw Forbidden(
      `You can only grant permissions you hold yourself. Missing: ${notHeld.map((row) => row.name).join(', ')}.`
    );
  }

  return result.rows;
}

/** Rule 2. */
function assertMayEditRank(actor, roleRank) {
  if ((actor.role?.rank ?? 0) < roleRank) {
    throw Forbidden('You cannot edit a role that ranks above your own.');
  }
}

/**
 * Derive a stable key from the display name, since the key is
 * what code and audit rows refer to. Collisions get a numeric
 * suffix rather than an error — the admin named the role, and the
 * key is an implementation detail they should not have to think
 * about.
 */
async function deriveKey(name, client) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'role';

  let candidate = base;
  let suffix = 1;

  // eslint-disable-next-line no-await-in-loop
  while ((await client.query('SELECT 1 FROM roles WHERE key = $1', [candidate])).rows.length > 0) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

async function createRole(actor, { name, description, rank, permissionIds }) {
  // A role may not be created at or above the creator's own rank;
  // otherwise rule 2 could be sidestepped by making a peer role
  // and editing that instead.
  if (rank > (actor.role?.rank ?? 0)) {
    throw Forbidden(`You can only create roles ranked at or below your own (${actor.role.rank}).`);
  }

  return db.transaction(async (client) => {
    await assertMayGrant(actor, permissionIds, client);

    const existing = await client.query('SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1)', [name]);
    if (existing.rows.length > 0) throw Conflict(`A role named "${name}" already exists.`);

    const key = await deriveKey(name, client);

    const role = await client.query(
      `INSERT INTO roles (key, name, description, rank, is_system, is_protected, created_by)
       VALUES ($1, $2, $3, $4, FALSE, FALSE, $5)
       RETURNING id, key, name, description, rank`,
      [key, name, description || null, rank, actor.id]
    );

    if (permissionIds.length > 0) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id, granted_by)
         SELECT $1, UNNEST($2::int[]), $3`,
        [role.rows[0].id, permissionIds, actor.id]
      );
    }

    return role.rows[0];
  });
}

async function updateRole(actor, roleId, { name, description, rank, permissionIds }) {
  return db.transaction(async (client) => {
    const found = await client.query(
      'SELECT id, key, name, rank, is_system, is_protected FROM roles WHERE id = $1 FOR UPDATE',
      [roleId]
    );
    const role = found.rows[0];
    if (!role) throw NotFound('That role does not exist.');

    // Rule 3.
    if (role.is_protected) {
      throw Forbidden(`"${role.name}" is the built-in administrator role and cannot be edited. It is the way back in if a role change goes wrong.`);
    }

    assertMayEditRank(actor, role.rank);
    if (rank !== undefined && rank > (actor.role?.rank ?? 0)) {
      throw Forbidden(`You cannot rank a role above your own (${actor.role.rank}).`);
    }

    if (name && name.toLowerCase() !== role.name.toLowerCase()) {
      const clash = await client.query(
        'SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1) AND id <> $2',
        [name, roleId]
      );
      if (clash.rows.length > 0) throw Conflict(`A role named "${name}" already exists.`);
    }

    await client.query(
      `UPDATE roles
          SET name = COALESCE($2, name),
              description = COALESCE($3, description),
              rank = COALESCE($4, rank),
              updated_at = NOW()
        WHERE id = $1`,
      [roleId, name || null, description === undefined ? null : description, rank ?? null]
    );

    if (permissionIds) {
      await assertMayGrant(actor, permissionIds, client);

      // An editor who cannot see a permission must not strip it
      // by omission. The replacement set is therefore "what they
      // asked for" plus "anything already on the role that they
      // are not entitled to touch".
      const current = await client.query(
        `SELECT p.id, p.key FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = $1`,
        [roleId]
      );
      const untouchable = current.rows
        .filter((row) => !accessControl.has(actor, row.key))
        .map((row) => row.id);

      const nextIds = [...new Set([...permissionIds, ...untouchable])];

      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      if (nextIds.length > 0) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id, granted_by)
           SELECT $1, UNNEST($2::int[]), $3`,
          [roleId, nextIds, actor.id]
        );
      }
    }

    // Anyone currently signed in under this role has a stale
    // permission set cached. Clearing it makes the change land on
    // their very next request instead of when their token expires.
    accessControl.invalidateAll();

    return getRole(roleId, client);
  });
}

async function deleteRole(actor, roleId) {
  return db.transaction(async (client) => {
    const found = await client.query(
      'SELECT id, name, rank, is_system, is_protected FROM roles WHERE id = $1 FOR UPDATE',
      [roleId]
    );
    const role = found.rows[0];
    if (!role) throw NotFound('That role does not exist.');

    if (role.is_system) {
      throw Forbidden(`"${role.name}" ships with Bedline and cannot be deleted. You can change what it grants instead.`);
    }
    assertMayEditRank(actor, role.rank);

    if (role.id === actor.role.id) {
      throw Conflict('You cannot delete the role your own account uses.');
    }

    // Rule 4.
    const inUse = await client.query(
      'SELECT COUNT(*)::int AS count FROM users WHERE role_id = $1',
      [roleId]
    );
    if (inUse.rows[0].count > 0) {
      throw Conflict(
        `${inUse.rows[0].count} account${inUse.rows[0].count === 1 ? '' : 's'} still use "${role.name}". Move them to another role first.`
      );
    }

    await client.query('DELETE FROM roles WHERE id = $1', [roleId]);
    accessControl.invalidateAll();

    return { id: roleId, name: role.name };
  });
}

/**
 * Sync the code-side module and permission definitions into the
 * database. Runs at boot, and is what makes "add a folder, get a
 * module" true.
 *
 * Permissions that disappear from the code are marked rather than
 * deleted: dropping them would silently revoke access, and a
 * renamed permission key is far more often a typo than a
 * deliberate removal.
 */
async function syncRegistry() {
  return db.transaction(async (client) => {
    const summary = { modules: 0, permissions: 0, stale: [] };

    // eslint-disable-next-line no-restricted-syntax
    for (const module of registry.modules) {
      // eslint-disable-next-line no-await-in-loop
      const moduleRow = await client.query(
        `INSERT INTO modules (key, name, description, route, icon, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (key) DO UPDATE
           SET name = EXCLUDED.name,
               description = EXCLUDED.description,
               route = EXCLUDED.route,
               icon = EXCLUDED.icon,
               sort_order = EXCLUDED.sort_order,
               is_active = TRUE
         RETURNING id`,
        [module.key, module.name, module.description, module.route, module.icon, module.sortOrder]
      );
      summary.modules += 1;

      // eslint-disable-next-line no-restricted-syntax
      for (const permission of module.permissions) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO permissions (module_id, key, name, description, is_dangerous)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (key) DO UPDATE
             SET module_id = EXCLUDED.module_id,
                 name = EXCLUDED.name,
                 description = EXCLUDED.description,
                 is_dangerous = EXCLUDED.is_dangerous`,
          [moduleRow.rows[0].id, permission.key, permission.name, permission.description, permission.dangerous]
        );
        summary.permissions += 1;
      }
    }

    const known = [...registry.permissionKeys];
    const orphaned = await client.query(
      'SELECT key FROM permissions WHERE NOT (key = ANY($1::text[]))',
      [known]
    );
    summary.stale = orphaned.rows.map((row) => row.key);

    const moduleKeys = registry.modules.map((module) => module.key);
    await client.query(
      'UPDATE modules SET is_active = FALSE WHERE NOT (key = ANY($1::text[]))',
      [moduleKeys]
    );

    accessControl.invalidateAll();
    return summary;
  });
}

module.exports = {
  listCatalogue,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  syncRegistry,
};
