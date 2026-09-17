const db = require('../../config/db');
const { NotFound } = require('../../core/errors');

/**
 * Look up the patient record belonging to a user id.
 *
 * There is deliberately no "get patient by id" here and no :id in
 * the route. The identifier comes from the verified token, never
 * from the URL, so changing a number in the address bar cannot
 * surface somebody else's ward and doctor. That was true of the
 * original /patients/me endpoint and is worth keeping explicit.
 */
async function getOwnStay(userId) {
  const result = await db.query(
    `SELECT p.id, p.name, p.admission_status, p.dues_cleared,
            doctor.name AS doctor_name,
            b.bed_number, r.room_number, w.name AS ward_name,
            a.admitted_at
       FROM patients p
       LEFT JOIN users doctor ON doctor.id = p.assigned_doctor_id
       LEFT JOIN admissions a ON a.patient_id = p.id AND a.status = 'active'
       LEFT JOIN beds b ON b.id = a.bed_id
       LEFT JOIN rooms r ON r.id = b.room_id
       LEFT JOIN wards w ON w.id = r.ward_id
      WHERE p.user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw NotFound('There is no patient record linked to this account yet. The front desk can link one.');
  }
  return result.rows[0];
}

/**
 * Remarks only — not the full chart. A patient seeing raw
 * clinical notes without a clinician to explain them is a
 * decision for the hospital, not a default, so the portal shows
 * the short notes meant for them and nothing else.
 */
async function getOwnRemarks(userId) {
  const result = await db.query(
    `SELECT rm.id, rm.remark, rm.created_at, u.name AS author_name
       FROM remarks rm
       JOIN patients p ON p.id = rm.patient_id
       LEFT JOIN users u ON u.id = rm.author_id
      WHERE p.user_id = $1
      ORDER BY rm.created_at DESC
      LIMIT 50`,
    [userId]
  );
  return result.rows;
}

module.exports = { getOwnStay, getOwnRemarks };
