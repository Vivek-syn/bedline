// ============================================================
// MODULE: Access control
//
// The role editor. An admin builds a role here by ticking the
// permissions it should hold, and every other module's behaviour
// follows from those ticks.
//
// This module guards itself: `role.manage` is the permission that
// lets someone edit permissions, so granting it hands over the
// keys to the whole system. It is flagged dangerous so the UI can
// say so before anyone ticks it.
// ============================================================

module.exports = {
  key: 'access-control',
  name: 'Roles and permissions',
  description: 'Create roles, choose what each one can reach, and see who holds them.',
  route: '/app/roles',
  icon: 'shield',
  sortOrder: 90,
  basePath: '/roles',

  permissions: [
    {
      key: 'role.view',
      name: 'View roles',
      description: 'See the list of roles and the permissions each one holds.',
    },
    {
      key: 'role.manage',
      name: 'Create and edit roles',
      description: 'Add roles, rename them, and change which permissions they grant.',
      dangerous: true,
    },
    {
      key: 'role.delete',
      name: 'Delete roles',
      description: 'Remove a role that no account is using.',
      dangerous: true,
    },
  ],

  router: () => require('./accessControl.routes'),
};
