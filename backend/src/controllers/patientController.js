const db = require('../config/db');

// GET /api/patients
// Doctors/Nurses/Admin see the full patient list.
async function getAllPatients(req, res, next) {
  try {
    const result = await db.query(`
      SELECT patients.*, doctors.name AS doctor_name
      FROM patients
      LEFT JOIN users doctors ON patients.assigned_doctor_id = doctors.id
      ORDER BY patients.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/patients
// Receptionist registers a new patient (creates the "patients" row only —
// the login account is created separately via /auth/register if the
// patient needs portal access).
async function createPatient(req, res, next) {
  try {
    const { name, age, gender, contact } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required.' });

    const result = await db.query(
      `INSERT INTO patients (name, age, gender, contact)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, age, gender, contact]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/patients/me
// THIS is the endpoint the Patient Portal calls. It deliberately
// does NOT take an :id from the URL — it always looks up the
// patient record belonging to the CURRENTLY LOGGED IN user
// (req.user.id, set by the auth middleware). This is what stops
// one patient from ever being able to view another patient's
// room by just changing a number in the URL.
async function getMyStatus(req, res, next) {
  try {
    const result = await db.query(
      `SELECT
         patients.id, patients.name, patients.admission_status,
         doctors.name AS doctor_name,
         beds.bed_number, rooms.room_number, wards.name AS ward_name,
         admissions.admitted_at
       FROM patients
       LEFT JOIN users doctors ON patients.assigned_doctor_id = doctors.id
       LEFT JOIN admissions ON admissions.patient_id = patients.id AND admissions.status = 'active'
       LEFT JOIN beds ON admissions.bed_id = beds.id
       LEFT JOIN rooms ON beds.room_id = rooms.id
       LEFT JOIN wards ON rooms.ward_id = wards.id
       WHERE patients.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No patient record linked to this account.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/patients/:id/clear-dues
// Receptionist (or admin) confirms a patient has settled their
// bill. This flips the flag that dischargePatient() checks
// before letting a doctor or nurse discharge them.
async function clearDues(req, res, next) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE patients SET dues_cleared = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patient not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllPatients, createPatient, getMyStatus, clearDues };
