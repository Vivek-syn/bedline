const db = require('../../config/db');
const { NotFound } = require('../../core/errors');

async function listPatients({ status, search }) {
  const conditions = [];
  const params = [];

  if (status) { params.push(status); conditions.push(`p.admission_status = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`p.name ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT p.id, p.name, p.age, p.gender, p.contact,
            p.admission_status, p.dues_cleared, p.created_at,
            doctor.name AS doctor_name,
            b.bed_number, r.room_number, w.name AS ward_name
       FROM patients p
       LEFT JOIN users doctor ON doctor.id = p.assigned_doctor_id
       LEFT JOIN admissions a ON a.patient_id = p.id AND a.status = 'active'
       LEFT JOIN beds b ON b.id = a.bed_id
       LEFT JOIN rooms r ON r.id = b.room_id
       LEFT JOIN wards w ON w.id = r.ward_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT 500`,
    params
  );
  return result.rows;
}

async function getPatient(patientId) {
  const result = await db.query(
    `SELECT p.*, doctor.name AS doctor_name
       FROM patients p
       LEFT JOIN users doctor ON doctor.id = p.assigned_doctor_id
      WHERE p.id = $1`,
    [patientId]
  );
  if (result.rows.length === 0) throw NotFound('That patient is not on the register.');
  return result.rows[0];
}

async function createPatient(actor, { name, age, gender, contact }) {
  const result = await db.query(
    `INSERT INTO patients (name, age, gender, contact, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, age ?? null, gender || null, contact || null, actor.id]
  );
  return result.rows[0];
}

async function updatePatient(patientId, { name, age, gender, contact }) {
  const result = await db.query(
    `UPDATE patients
        SET name = COALESCE($2, name),
            age = COALESCE($3, age),
            gender = COALESCE($4, gender),
            contact = COALESCE($5, contact),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [patientId, name || null, age ?? null, gender || null, contact || null]
  );
  if (result.rows.length === 0) throw NotFound('That patient is not on the register.');
  return result.rows[0];
}

module.exports = { listPatients, getPatient, createPatient, updatePatient };
