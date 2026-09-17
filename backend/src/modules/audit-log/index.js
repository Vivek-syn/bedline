// MODULE: Audit log — the record of who did what.
//
// Read-only by design. There is no endpoint to edit or delete a
// row, because a trail that can be edited by the people it
// watches is not a trail.

module.exports = {
  key: 'audit-log',
  name: 'Activity log',
  description: 'Every action taken in Bedline, including the ones that were refused.',
  route: '/app/activity',
  icon: 'list',
  sortOrder: 99,
  basePath: '/activity',

  permissions: [
    { key: 'audit.view', name: 'View the activity log', description: 'Read the record of actions taken.', dangerous: true },
  ],

  router: () => require('./auditLog.routes'),
};
