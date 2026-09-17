// MODULE: Admissions — the link between a patient and a bed.
//
// The two override permissions here are the ones that let a
// holder step past a rule another role relies on, so both are
// flagged dangerous and neither is granted by default.

module.exports = {
  key: 'admissions',
  name: 'Admissions',
  description: 'Put patients into beds, and discharge them when they leave.',
  route: '/app/admissions',
  icon: 'arrow-right',
  sortOrder: 30,
  basePath: '/admissions',

  permissions: [
    { key: 'admission.view', name: 'View admissions', description: 'See who is currently admitted and where.' },
    { key: 'admission.assign', name: 'Assign a bed', description: 'Admit a patient into a vacant bed.' },
    { key: 'admission.discharge', name: 'Discharge', description: 'End an admission and free the bed.' },
    {
      key: 'admission.override_assignment',
      name: 'Override a senior role\u2019s admission',
      description: 'End an admission arranged by a role that ranks above yours.',
      dangerous: true,
    },
    {
      key: 'admission.discharge_unpaid',
      name: 'Discharge before dues are cleared',
      description: 'Skip the billing check when discharging.',
      dangerous: true,
    },
  ],

  router: () => require('./admissions.routes'),
};
