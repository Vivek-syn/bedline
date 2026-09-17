// ============================================================
// MODULE: User management
//
// Creating and maintaining staff and patient accounts. This is
// the only way an account comes into existence — open
// self-registration was removed, because a public endpoint that
// accepts a role name is a public endpoint that hands out admin.
// ============================================================

module.exports = {
  key: 'user-management',
  name: 'People and accounts',
  description: 'Add staff and patient logins, move someone to a different role, and deactivate accounts.',
  route: '/app/users',
  icon: 'users',
  sortOrder: 95,
  basePath: '/users',

  permissions: [
    { key: 'user.view', name: 'View accounts', description: 'See who has an account and which role they hold.' },
    { key: 'user.create', name: 'Create accounts', description: 'Add a new staff or patient login.', dangerous: true },
    { key: 'user.update', name: 'Edit accounts', description: 'Change a name, email, or role.', dangerous: true },
    { key: 'user.deactivate', name: 'Deactivate accounts', description: 'Switch an account off and end its sessions.' },
    { key: 'user.reset_password', name: 'Reset passwords', description: 'Issue a temporary password for someone locked out.', dangerous: true },
  ],

  router: () => require('./userManagement.routes'),
};
