// ============================================================
// SELF-CHECK
//
//   npm run check
//
// Loads the module registry and every module router without
// touching the database. It catches the mistakes that would
// otherwise only show up as a mysterious 403 in production:
// a permission key guarding a route that no manifest declares,
// two modules fighting over the same mount path, a manifest that
// forgot its router.
//
// Fast enough to run in a pre-commit hook or CI step.
// ============================================================

process.env.JWT_SECRET = process.env.JWT_SECRET || 'check-only-secret-not-used-for-signing';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'check-only-refresh-secret-value';

const registry = require('../src/core/registry');

let failures = 0;

console.log('\nBedline module check\n');

registry.modules.forEach((module) => {
  const permissionCount = module.permissions.length;
  const dangerous = module.permissions.filter((permission) => permission.dangerous).length;

  try {
    // Loading the router runs every requirePermission() call in
    // it, which is where an unknown permission key throws.
    const router = module.router();
    if (typeof router !== 'function') throw new Error('router() did not return an Express router');

    console.log(
      `  ok   ${module.key.padEnd(18)} /api${module.basePath.padEnd(14)} ` +
      `${String(permissionCount).padStart(2)} permission${permissionCount === 1 ? ' ' : 's'}` +
      `${dangerous ? `  (${dangerous} dangerous)` : ''}`
    );
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${module.key.padEnd(18)} ${err.message}`);
  }
});

console.log(`\n  ${registry.modules.length} modules, ${registry.permissionKeys.size} permissions total`);

if (failures > 0) {
  console.error(`\n  ${failures} module(s) failed to load.\n`);
  process.exit(1);
}

console.log('\n  All modules loaded cleanly.\n');
