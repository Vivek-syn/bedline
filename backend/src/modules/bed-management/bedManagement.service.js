const db = require('../../config/db');
const accessControl = require('../../core/accessControl');
const { NotFound, Conflict, Forbidden } = require('../../core/errors');

const STATUSES = ['vacant', 'occupied', 'reserved', 'maintenance'];

async function listBeds({ status, wardId }) {
  const conditions = [];
  const params = [];

  if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }
  if (wardId) { params.push(wardId); conditions.push(`w.id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT b.id, b.bed_number, b.status,
            r.id AS room_id, r.room_number,
            w.id AS ward_id, w.name AS ward_name, w.type AS ward_type,
            a.id AS admission_id,
            p.name AS patient_name,
            owner.name AS assigned_by_role_name,
            owner.rank AS assigned_by_role_rank
       FROM beds b
       JOIN rooms r ON r.id = b.room_id
       JOIN wards w ON w.id = r.ward_id
       LEFT JOIN admissions a ON a.bed_id = b.id AND a.status = 'active'
       LEFT JOIN patients p ON p.id = a.patient_id
       LEFT JOIN roles owner ON owner.id = a.assigned_by_role_id
       ${where}
       ORDER BY w.name, r.room_number, b.bed_number`,
    params
  );
  return result.rows;
}

async function createBed({ roomId, bedNumber }) {
  const room = await db.query(
    `SELECT r.id, r.capacity, COUNT(b.id)::int AS bed_count
       FROM rooms r LEFT JOIN beds b ON b.room_id = r.id
      WHERE r.id = $1 GROUP BY r.id`,
    [roomId]
  );
  if (room.rows.length === 0) throw NotFound('That room does not exist.');

  // The room's stated capacity is treated as a real limit, not a
  // label. A room with four beds recorded against a capacity of
  // two makes every occupancy figure downstream wrong.
  if (room.rows[0].bed_count >= room.rows[0].capacity) {
    throw Conflict(`This room is set up for ${room.rows[0].capacity} bed${room.rows[0].capacity === 1 ? '' : 's'}. Raise its capacity first.`);
  }

  const result = await db.query(
    `INSERT INTO beds (room_id, bed_number, status) VALUES ($1, $2, 'vacant') RETURNING *`,
    [roomId, bedNumber]
  );
  return result.rows[0];
}

/**
 * Change a bed's status.
 *
 * The seniority rule from the original system survives, but it is
 * now data-driven: instead of a hard-coded nurse < doctor < admin
 * ladder, it compares the actor's role rank against the rank of
 * the role that arranged the bed's current admission, and lets an
 * explicit override permission bypass it.
 */
async function updateStatus(actor, bedId, status) {
  if (!STATUSES.includes(status)) {
    throw Conflict(`Status must be one of: ${STATUSES.join(', ')}.`);
  }

  return db.transaction(async (client) => {
    const found = await client.query(
      `SELECT b.id, b.status,
              a.id AS admission_id,
              owner.name AS owner_role_name,
              owner.rank AS owner_role_rank
         FROM beds b
         LEFT JOIN admissions a ON a.bed_id = b.id AND a.status = 'active'
         LEFT JOIN roles owner ON owner.id = a.assigned_by_role_id
        WHERE b.id = $1
        FOR UPDATE OF b`,
      [bedId]
    );
    const bed = found.rows[0];
    if (!bed) throw NotFound('That bed does not exist.');

    if (bed.admission_id) {
      if (!accessControl.canSupersede(actor, bed.owner_role_rank, 'bed.override_assignment')) {
        throw Forbidden(
          `This bed's current admission was arranged by a ${bed.owner_role_name}. Ask them, or someone with override permission, to change it.`
        );
      }
      // Even with the rank to override, silently freeing an
      // occupied bed would leave an admission pointing at a bed
      // marked vacant. Discharging through the admissions module
      // is the only way to end an admission.
      if (status !== 'occupied') {
        throw Conflict('A patient is in this bed. Discharge them from Admissions first.');
      }
    }

    const updated = await client.query(
      'UPDATE beds SET status = $2 WHERE id = $1 RETURNING *',
      [bedId, status]
    );
    return { bed: updated.rows[0], previousStatus: bed.status };
  });
}

module.exports = { listBeds, createBed, updateStatus, STATUSES };
