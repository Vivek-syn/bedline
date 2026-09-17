// MODULE: Ward management — the physical layout of the hospital.
// Wards contain rooms, rooms contain beds. Everything else in the
// system hangs off this hierarchy, so it is its own service.

module.exports = {
  key: 'ward-management',
  name: 'Wards and rooms',
  description: 'Lay out the hospital: wards, the rooms inside them, and how many beds each room holds.',
  route: '/app/wards',
  icon: 'layout',
  sortOrder: 40,
  basePath: '/wards',

  permissions: [
    { key: 'ward.view', name: 'View layout', description: 'Browse wards and rooms.' },
    { key: 'ward.manage', name: 'Edit layout', description: 'Add or change wards and rooms.' },
  ],

  router: () => require('./wardManagement.routes'),
};
