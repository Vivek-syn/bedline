// MODULE: Clinical records — diagnoses, treatment plans, remarks.
//
// The most sensitive data in the system, and the reason read and
// write are separate permissions: plenty of people need to read a
// chart, far fewer should be adding to it.

module.exports = {
  key: 'clinical-records',
  name: 'Clinical records',
  description: 'Read a patient\u2019s chart, and add notes and remarks to it.',
  route: '/app/records',
  icon: 'file-text',
  sortOrder: 50,
  basePath: '/records',

  permissions: [
    { key: 'record.view', name: 'Read charts', description: 'Read medical records and remarks.' },
    { key: 'record.create', name: 'Write to charts', description: 'Add a medical record entry.' },
    { key: 'remark.create', name: 'Add remarks', description: 'Leave a short note on a patient\u2019s chart.' },
  ],

  router: () => require('./clinicalRecords.routes'),
};
