const db = require('../../config/db');
const { NotFound } = require('../../core/errors');

async function assertPatientExists(patientId) {
  const result = await db.query('SELECT id FROM patients WHERE id = $1', [patientId]);
  if (result.rows.length === 0) throw NotFound('That patient is not on the register.');
}

async function getChart(patientId) {
  await assertPatientExists(patientId);

  const [records, remarks] = await Promise.all([
    db.query(
      `SELECT mr.id, mr.content, mr.created_at, u.name AS author_name
         FROM medical_records mr
         LEFT JOIN users u ON u.id = mr.author_id
        WHERE mr.patient_id = $1
        ORDER BY mr.created_at DESC
        LIMIT 200`,
      [patientId]
    ),
    db.query(
      `SELECT r.id, r.remark, r.created_at, u.name AS author_name
         FROM remarks r
         LEFT JOIN users u ON u.id = r.author_id
        WHERE r.patient_id = $1
        ORDER BY r.created_at DESC
        LIMIT 200`,
      [patientId]
    ),
  ]);

  return { records: records.rows, remarks: remarks.rows };
}

async function addRecord(actor, patientId, content) {
  await assertPatientExists(patientId);
  const result = await db.query(
    `INSERT INTO medical_records (patient_id, author_id, content)
     VALUES ($1, $2, $3) RETURNING id, content, created_at`,
    [patientId, actor.id, content]
  );
  return { ...result.rows[0], author_name: actor.name };
}

async function addRemark(actor, patientId, remark) {
  await assertPatientExists(patientId);
  const result = await db.query(
    `INSERT INTO remarks (patient_id, author_id, remark)
     VALUES ($1, $2, $3) RETURNING id, remark, created_at`,
    [patientId, actor.id, remark]
  );
  return { ...result.rows[0], author_name: actor.name };
}

module.exports = { getChart, addRecord, addRemark };
