// ============================================================
// ADMISSIONS SERVICE
//
// Putting a patient in a bed, and taking them out again. This is
// where the two business rules from the original system live, now
// expressed as permissions rather than hard-coded role names:
//
//   SENIORITY GATE — you cannot undo a bed decision made by a
//   more senior role. Previously that was a fixed
//   nurse < doctor < admin ladder. Now it compares role ranks,
//   and `admission.override_assignment` bypasses it, so a new
//   role slots into the hierarchy without a code change.
//
//   BILLING GATE — a patient is not discharged until the front
//   desk marks their dues cleared. `admission.discharge_unpaid`
//   bypasses it, for the cases where clinical need outruns
//   paperwork.
//
// Both gates are checked inside the same transaction that does
// the work, against rows locked FOR UPDATE. Checking first and
// writing after, outside a transaction, is a race: two requests
// both read "vacant" and both proceed.
// ============================================================

const db = require('../../config/db');
const accessControl = require('../../core/accessControl');
const { NotFound, Conflict, Forbidden } = require('../../core/errors');

async function listActive() {
  const result = await db.query(
    `SELECT a.id, a.admitted_at,
            p.id AS patient_id, p.name AS patient_name, p.dues_cleared,
            b.id AS bed_id, b.bed_number,
            r.room_number, w.name AS ward_name,
            doctor.name AS doctor_name,
            assigner.name AS assigned_by_name,
            owner.name AS assigned_by_role_name,
            owner.rank AS assigned_by_role_rank
       FROM admissions a
       JOIN patients p ON p.id = a.patient_id
       JOIN beds b ON b.id = a.bed_id
       JOIN rooms r ON r.id = b.room_id
       JOIN wards w ON w.id = r.ward_id
       LEFT JOIN users doctor ON doctor.id = a.doctor_id
       LEFT JOIN users assigner ON assigner.id = a.assigned_by_user_id
       LEFT JOIN roles owner ON owner.id = a.assigned_by_role_id
      WHERE a.status = 'active'
      ORDER BY a.admitted_at DESC`
  );
  return result.rows;
}

async function listForPatient(patientId) {
  const result = await db.query(
    `SELECT a.id, a.admitted_at, a.discharged_at, a.status,
            b.bed_number, r.room_number, w.name AS ward_name,
            doctor.name AS doctor_name
       FROM admissions a
       JOIN beds b ON b.id = a.bed_id
       JOIN rooms r ON r.id = b.room_id
       JOIN wards w ON w.id = r.ward_id
       LEFT JOIN users doctor ON doctor.id = a.doctor_id
      WHERE a.patient_id = $1
      ORDER BY a.admitted_at DESC`,
    [patientId]
  );
  return result.rows;
}

async function assignBed(actor, { patientId, bedId, doctorId }) {
  return db.transaction(async (client) => {
    // Locking the bed row first serialises concurrent attempts on
    // the same bed. The unique partial index on active admissions
    // is the backstop if this is ever bypassed.
    const bedResult = await client.query(
      'SELECT id, status, bed_number FROM beds WHERE id = $1 FOR UPDATE',
      [bedId]
    );
    const bed = bedResult.rows[0];
    if (!bed) throw NotFound('That bed does not exist.');
    if (bed.status !== 'vacant') {
      throw Conflict(`Bed ${bed.bed_number} is ${bed.status}. Pick another.`);
    }

    const patientResult = await client.query(
      'SELECT id, name, admission_status FROM patients WHERE id = $1 FOR UPDATE',
      [patientId]
    );
    const patient = patientResult.rows[0];
    if (!patient) throw NotFound('That patient is not on the register.');
    if (patient.admission_status === 'admitted') {
      throw Conflict(`${patient.name} is already in a bed.`);
    }

    // A named doctor must actually be an account that exists.
    // Without the check, a typo silently files the admission under
    // a doctor id that leads nowhere.
    const attendingId = doctorId || actor.id;
    const doctorExists = await client.query(
      'SELECT id FROM users WHERE id = $1 AND is_active',
      [attendingId]
    );
    if (doctorExists.rows.length === 0) {
      throw NotFound('That attending doctor is not an active account.');
    }

    const admission = await client.query(
      `INSERT INTO admissions
         (patient_id, bed_id, doctor_id, assigned_by_user_id, assigned_by_role_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [patientId, bedId, attendingId, actor.id, actor.role.id]
    );

    await client.query(`UPDATE beds SET status = 'occupied' WHERE id = $1`, [bedId]);
    await client.query(
      `UPDATE patients
          SET admission_status = 'admitted', assigned_doctor_id = $2, updated_at = NOW()
        WHERE id = $1`,
      [patientId, attendingId]
    );

    return { admission: admission.rows[0], bedNumber: bed.bed_number, patientName: patient.name };
  });
}

async function discharge(actor, admissionId) {
  return db.transaction(async (client) => {
    const found = await client.query(
      `SELECT a.id, a.bed_id, a.patient_id, a.assigned_by_role_id,
              p.dues_cleared, p.name AS patient_name,
              owner.name AS owner_role_name,
              owner.rank AS owner_role_rank
         FROM admissions a
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN roles owner ON owner.id = a.assigned_by_role_id
        WHERE a.id = $1 AND a.status = 'active'
        FOR UPDATE OF a, p`,
      [admissionId]
    );

    const admission = found.rows[0];
    if (!admission) throw NotFound('No active admission with that id.');

    // Gate 1 — seniority.
    if (!accessControl.canSupersede(actor, admission.owner_role_rank, 'admission.override_assignment')) {
      throw Forbidden(
        `This admission was arranged by a ${admission.owner_role_name}. You need their sign-off, or the override permission, to end it.`
      );
    }

    // Gate 2 — billing.
    if (!admission.dues_cleared && !accessControl.has(actor, 'admission.discharge_unpaid')) {
      throw Conflict(
        `${admission.patient_name} still has outstanding dues. The front desk clears them in Billing, then this will go through.`
      );
    }

    const updated = await client.query(
      `UPDATE admissions SET status = 'discharged', discharged_at = NOW()
        WHERE id = $1 RETURNING *`,
      [admissionId]
    );

    await client.query(`UPDATE beds SET status = 'vacant' WHERE id = $1`, [admission.bed_id]);
    await client.query(
      `UPDATE patients SET admission_status = 'discharged', updated_at = NOW() WHERE id = $1`,
      [admission.patient_id]
    );

    return {
      admission: updated.rows[0],
      bedId: admission.bed_id,
      patientId: admission.patient_id,
      patientName: admission.patient_name,
      bypassedDues: !admission.dues_cleared,
    };
  });
}

module.exports = { listActive, listForPatient, assignBed, discharge };
