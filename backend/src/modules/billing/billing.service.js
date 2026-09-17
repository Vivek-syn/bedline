const db = require('../../config/db');
const { NotFound, Conflict } = require('../../core/errors');

async function listOutstanding({ includeCleared }) {
  const where = includeCleared ? '' : 'WHERE NOT p.dues_cleared';
  const result = await db.query(
    `SELECT p.id, p.name, p.admission_status, p.dues_cleared,
            b.bed_number, w.name AS ward_name, a.admitted_at
       FROM patients p
       LEFT JOIN admissions a ON a.patient_id = p.id AND a.status = 'active'
       LEFT JOIN beds b ON b.id = a.bed_id
       LEFT JOIN rooms r ON r.id = b.room_id
       LEFT JOIN wards w ON w.id = r.ward_id
       ${where}
       ORDER BY p.dues_cleared, a.admitted_at NULLS LAST
       LIMIT 500`
  );
  return result.rows;
}

async function setDuesCleared(patientId, cleared) {
  const found = await db.query(
    'SELECT id, name, dues_cleared FROM patients WHERE id = $1',
    [patientId]
  );
  const patient = found.rows[0];
  if (!patient) throw NotFound('That patient is not on the register.');

  if (patient.dues_cleared === cleared) {
    throw Conflict(cleared ? 'Their dues are already cleared.' : 'Their dues are already outstanding.');
  }

  const result = await db.query(
    'UPDATE patients SET dues_cleared = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
    [patientId, cleared]
  );
  return result.rows[0];
}

module.exports = { listOutstanding, setDuesCleared };
