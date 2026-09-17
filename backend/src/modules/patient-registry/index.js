// MODULE: Patient registry — who the patients are.
//
// Separate from admissions (where they are) and clinical records
// (what is wrong with them), because the front desk needs the
// first without the other two.

module.exports = {
  key: 'patient-registry',
  name: 'Patients',
  description: 'Register arrivals and keep the patient list up to date.',
  route: '/app/patients',
  icon: 'clipboard',
  sortOrder: 10,
  basePath: '/patients',

  permissions: [
    { key: 'patient.view', name: 'View patients', description: 'See the patient list and their details.' },
    { key: 'patient.create', name: 'Register patients', description: 'Add someone new to the register.' },
    { key: 'patient.update', name: 'Edit patient details', description: 'Correct a name, age, or contact number.' },
  ],

  router: () => require('./patientRegistry.routes'),
};
