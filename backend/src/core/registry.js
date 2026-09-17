// ============================================================
// MODULE REGISTRY
//
// Every feature area of Bedline lives in its own folder under
// src/modules/<key>/ and exports a manifest from index.js. This
// file discovers those folders at boot, validates the manifests,
// and exposes the result to the rest of the app.
//
// Why a registry instead of a list of app.use() lines in
// server.js: the manifest is the single description of a module.
// Its permissions, its mount path, its place in the launcher and
// its database row all come from that one object, so adding a
// module means adding a folder — there is no second place to
// remember to update, and no way for the route table and the
// permission table to drift apart.
//
// The validation here is deliberately strict and fatal. A typo
// in a permission key would otherwise become a route nobody can
// ever access, discovered in production by a confused user.
// ============================================================

const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '..', 'modules');

const KEY_PATTERN = /^[a-z][a-z0-9-]*$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

function fail(message) {
  throw new Error(`Module registry: ${message}`);
}

function validateManifest(manifest, folder) {
  if (!manifest || typeof manifest !== 'object') {
    fail(`modules/${folder}/index.js did not export an object.`);
  }

  const { key, name, route, basePath, permissions, router } = manifest;

  if (!KEY_PATTERN.test(key || '')) {
    fail(`modules/${folder} has key "${key}"; expected lower-case words separated by hyphens.`);
  }
  if (key !== folder) {
    fail(`modules/${folder} declares key "${key}". The folder name and the key must match.`);
  }
  if (!name) fail(`module "${key}" is missing a display name.`);
  if (!route || !route.startsWith('/')) fail(`module "${key}" needs a frontend route starting with "/".`);
  if (!basePath || !basePath.startsWith('/')) fail(`module "${key}" needs an API basePath starting with "/".`);
  if (typeof router !== 'function') fail(`module "${key}" must export router() returning an Express router.`);
  if (!Array.isArray(permissions) || permissions.length === 0) {
    fail(`module "${key}" must declare at least one permission.`);
  }

  permissions.forEach((permission) => {
    if (!PERMISSION_PATTERN.test(permission.key || '')) {
      fail(`module "${key}" has permission key "${permission.key}"; expected the form "noun.verb".`);
    }
    if (!permission.name) fail(`permission "${permission.key}" is missing a display name.`);
  });

  return manifest;
}

function loadModules() {
  const folders = fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const modules = [];
  const seenPermissions = new Map();
  const seenBasePaths = new Map();

  folders.forEach((folder) => {
    const manifestPath = path.join(MODULES_DIR, folder, 'index.js');
    if (!fs.existsSync(manifestPath)) {
      fail(`modules/${folder} has no index.js manifest.`);
    }

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const manifest = validateManifest(require(manifestPath), folder);

    // Two modules claiming the same permission key would make the
    // access-control UI ambiguous about which module a checkbox
    // belongs to, so it is rejected rather than silently merged.
    manifest.permissions.forEach((permission) => {
      const owner = seenPermissions.get(permission.key);
      if (owner) fail(`permission "${permission.key}" is declared by both "${owner}" and "${manifest.key}".`);
      seenPermissions.set(permission.key, manifest.key);
    });

    const pathOwner = seenBasePaths.get(manifest.basePath);
    if (pathOwner) fail(`API basePath "${manifest.basePath}" is used by both "${pathOwner}" and "${manifest.key}".`);
    seenBasePaths.set(manifest.basePath, manifest.key);

    modules.push({
      key: manifest.key,
      name: manifest.name,
      description: manifest.description || '',
      route: manifest.route,
      icon: manifest.icon || 'square',
      sortOrder: manifest.sortOrder ?? 100,
      basePath: manifest.basePath,
      permissions: manifest.permissions.map((permission) => ({
        key: permission.key,
        name: permission.name,
        description: permission.description || '',
        dangerous: Boolean(permission.dangerous),
      })),
      router: manifest.router,
    });
  });

  modules.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return modules;
}

const modules = loadModules();
const permissionKeys = new Set(
  modules.flatMap((module) => module.permissions.map((permission) => permission.key))
);

/**
 * Throw if a permission key was never declared by any module.
 * requirePermission() calls this the moment a route file is
 * loaded, so a mistyped key stops the server at boot instead of
 * silently guarding a route that then denies everyone forever.
 */
function assertPermissionExists(key) {
  if (!permissionKeys.has(key)) {
    const known = [...permissionKeys].sort().join(', ');
    throw new Error(
      `Unknown permission "${key}". Declare it in its module's manifest first.\nKnown permissions: ${known}`
    );
  }
  return key;
}

function getModule(key) {
  return modules.find((module) => module.key === key) || null;
}

/** The module a given permission belongs to. Used by the audit log. */
function moduleKeyForPermission(permissionKey) {
  const owner = modules.find((module) =>
    module.permissions.some((permission) => permission.key === permissionKey)
  );
  return owner ? owner.key : null;
}

module.exports = {
  modules,
  permissionKeys,
  assertPermissionExists,
  getModule,
  moduleKeyForPermission,
};
