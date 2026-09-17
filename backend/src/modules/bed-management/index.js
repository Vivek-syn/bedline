// MODULE: Bed management — the beds themselves and their status.
//
// Assigning a patient to a bed is a different service
// (admissions): it involves the patient, the doctor and the
// billing gate. This module is only about beds existing and what
// state they are in.

module.exports = {
  key: 'bed-management',
  name: 'Beds',
  description: 'See every bed and what state it is in, add beds to rooms, and mark beds out of service.',
  route: '/app/beds',
  icon: 'bed',
  sortOrder: 20,
  basePath: '/beds',

  permissions: [
    { key: 'bed.view', name: 'View beds', description: 'See the bed map and each bed\u2019s status.' },
    { key: 'bed.create', name: 'Add beds', description: 'Add a new bed to an existing room.' },
    { key: 'bed.update_status', name: 'Change bed status', description: 'Mark a bed vacant, reserved, or under maintenance.' },
    {
      key: 'bed.override_assignment',
      name: 'Override another role\u2019s bed decision',
      description: 'Change a bed whose current admission was arranged by a more senior role.',
      dangerous: true,
    },
  ],

  router: () => require('./bedManagement.routes'),
};
