// MODULE: Patient portal — a patient's view of their own stay.
//
// The one module whose queries are scoped to the signed-in
// account rather than to a permission alone. Holding
// `portal.view_own` lets you see YOUR record; it never lets you
// see anybody else's.

module.exports = {
  key: 'patient-portal',
  name: 'My stay',
  description: 'Where you are, who is looking after you, and whether anything is outstanding.',
  route: '/app/my-stay',
  icon: 'heart',
  sortOrder: 5,
  basePath: '/my-stay',

  permissions: [
    { key: 'portal.view_own', name: 'View your own stay', description: 'See your own admission status and ward.' },
  ],

  router: () => require('./patientPortal.routes'),
};
