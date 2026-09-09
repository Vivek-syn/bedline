const db = require('../config/db');
const { canSupersede } = require('../utils/permissions');

// POST /api/admissions/assign
// Body: { patientId, bedId, doctorId }
// Doctors, nurses, and admin can all call this (route-level check).
// The important new bit: we stamp WHO made this assignment via
// `assigned_by_role`. That stamp is what the de-assign/status
// endpoints below check before letting a nurse touch this bed again.
async function assignBed(req, res, next) {
  const client = await db.connect();
  try {
    const { patientId, bedId, doctorId } = req.body;

    if (!patientId || !bedId) {
      return res.status(400).json({ message: 'patientId and bedId are required.' });
    }

    await client.query('BEGIN');

    const bedCheck = await client.query('SELECT status FROM beds WHERE id = $1', [bedId]);
    if (bedCheck.rows.length === 0) {
      throw { status: 404, message: 'Bed not found.' };
    }
    if (bedCheck.rows[0].status !== 'vacant') {
      throw { status: 409, message: 'That bed is not vacant.' };
    }

    const admission = await client.query(
      `INSERT INTO admissions (patient_id, bed_id, doctor_id, assigned_by_role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [patientId, bedId, doctorId || req.user.id, req.user.role]
    );

    await client.query(`UPDATE beds SET status = 'occupied' WHERE id = $1`, [bedId]);

    await client.query(
      `UPDATE patients SET admission_status = 'admitted', assigned_doctor_id = $1 WHERE id = $2`,
      [doctorId || req.user.id, patientId]
    );

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id)
       VALUES ($1, $2, 'admission', $3)`,
      [req.user.id, `assigned bed as ${req.user.role}`, admission.rows[0].id]
    );

    await client.query('COMMIT');
    res.status(201).json(admission.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  } finally {
    client.release();
  }
}

// PATCH /api/admissions/:id/discharge
// This is the "de-assign" action: it frees the bed and closes the
// admission. Two gates apply, in order:
//
//   1. SUPERSEDE CHECK — a nurse cannot de-assign a bed that a
//      doctor or admin assigned. (Doctors/admin can always
//      de-assign, regardless of who assigned it.)
//
//   2. DUES CHECK — unless you're admin, the patient's
//      `dues_cleared` flag must be true. Reception flips that
//      flag via PATCH /api/patients/:id/clear-dues.
async function dischargePatient(req, res, next) {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const actorRole = req.user.role;

    await client.query('BEGIN');

    // Look up the admission WITH the patient's dues status, before
    // touching anything, so we can enforce both gates first.
    const lookup = await client.query(
      `SELECT admissions.*, patients.dues_cleared
       FROM admissions
       JOIN patients ON admissions.patient_id = patients.id
       WHERE admissions.id = $1 AND admissions.status = 'active'`,
      [id]
    );

    if (lookup.rows.length === 0) {
      throw { status: 404, message: 'Active admission not found.' };
    }

    const { bed_id, patient_id, assigned_by_role, dues_cleared } = lookup.rows[0];

    // --- Gate 1: supersede check ---
    if (!canSupersede(actorRole, assigned_by_role)) {
      throw {
        status: 403,
        message: `A ${actorRole} cannot supersede a bed assignment made by a ${assigned_by_role}.`,
      };
    }

    // --- Gate 2: dues check (admin bypasses everything) ---
    if (actorRole !== 'admin' && !dues_cleared) {
      throw {
        status: 409,
        message: 'This patient cannot be discharged until reception clears outstanding dues.',
      };
    }

    const admission = await client.query(
      `UPDATE admissions
       SET status = 'discharged', discharged_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query(`UPDATE beds SET status = 'vacant' WHERE id = $1`, [bed_id]);
    await client.query(`UPDATE patients SET admission_status = 'discharged' WHERE id = $1`, [patient_id]);

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id)
       VALUES ($1, $2, 'admission', $3)`,
      [req.user.id, `de-assigned/discharged as ${actorRole}`, id]
    );

    await client.query('COMMIT');
    res.json(admission.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  } finally {
    client.release();
  }
}

// GET /api/admissions/active
// A list view for doctors/nurses/admin/reception: who is
// currently admitted, where, and who assigned them — this last
// bit is what the frontend uses to show a "locked by doctor"
// indicator so a nurse knows not to bother trying.
async function getActiveAdmissions(req, res, next) {
  try {
    const result = await db.query(`
      SELECT admissions.id, admissions.admitted_at, admissions.assigned_by_role,
             patients.name AS patient_name, patients.id AS patient_id,
             patients.dues_cleared,
             beds.bed_number, beds.id AS bed_id,
             rooms.room_number, wards.name AS ward_name,
             doctors.name AS doctor_name
      FROM admissions
      JOIN patients ON admissions.patient_id = patients.id
      JOIN beds ON admissions.bed_id = beds.id
      JOIN rooms ON beds.room_id = rooms.id
      JOIN wards ON rooms.ward_id = wards.id
      LEFT JOIN users doctors ON admissions.doctor_id = doctors.id
      WHERE admissions.status = 'active'
      ORDER BY admissions.admitted_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { assignBed, dischargePatient, getActiveAdmissions };
