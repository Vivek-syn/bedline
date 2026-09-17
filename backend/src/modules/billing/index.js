// MODULE: Billing — the dues gate in front of discharge.
//
// Small, but its own service on purpose: the front desk needs to
// clear a bill without also being able to read charts or move
// patients between beds.

module.exports = {
  key: 'billing',
  name: 'Billing',
  description: 'See who still owes, and clear dues so they can be discharged.',
  route: '/app/billing',
  icon: 'receipt',
  sortOrder: 60,
  basePath: '/billing',

  permissions: [
    { key: 'billing.view', name: 'View dues', description: 'See which patients have outstanding dues.' },
    { key: 'billing.clear_dues', name: 'Clear dues', description: 'Mark a patient\u2019s bill as settled.' },
    { key: 'billing.reopen', name: 'Reopen dues', description: 'Undo a clearance recorded by mistake.', dangerous: true },
  ],

  router: () => require('./billing.routes'),
};
