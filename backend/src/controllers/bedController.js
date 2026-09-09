const db = require('../config/db');
const { canSupersede } = require('../utils/permissions');

// GET /api/beds?status=vacant
// Everyone logged in can VIEW beds.
async function getBeds(req, res, next) {
  try {
    const { status } = req.query;

    let query = `
      SELECT beds.id, beds.bed_number, beds.status,
             rooms.room_number, rooms.id AS room_id,
             wards.name AS ward_name, wards.type AS ward_type
      FROM beds
      JOIN rooms ON beds.room_id = rooms.id
      JOIN wards ON rooms.ward_id = wards.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE beds.status = $1';
      params.push(status);
    }

    query += ' ORDER BY wards.name, rooms.room_number, beds.bed_number';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/beds/:id/status
// Nurse/Admin use this to mark a bed vacant, occupied, reserved,
// or under maintenance. NEW RULE: a nurse cannot change the
// status of a bed whose active admission was assigned by a
// doctor or admin — that's the doctor's/admin's call to reverse,
// not the nurse's. Admin can always change any bed's status.
async function updateBedStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const actorRole = req.user.role;

    const validStatuses = ['vacant', 'occupied', 'reserved', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }

    if (actorRole !== 'admin') {
      // Is there an active admission on this bed, and if so, who assigned it?
      const activeAdmission = await db.query(
        `SELECT assigned_by_role FROM admissions WHERE bed_id = $1 AND status = 'active'`,
        [id]
      );
      if (activeAdmission.rows.length > 0) {
        const ownerRole = activeAdmission.rows[0].assigned_by_role;
        if (!canSupersede(actorRole, ownerRole)) {
          return res.status(403).json({
            message: `A ${actorRole} cannot change a bed assigned by a ${ownerRole}.`,
          });
        }
      }
    }

    const result = await db.query(
      'UPDATE beds SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bed not found.' });
    }

    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id)
       VALUES ($1, $2, 'bed', $3)`,
      [req.user.id, `set status to ${status}`, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// POST /api/beds
// Admin-only: add a brand new bed to an existing room.
// Body: { roomId, bedNumber }
async function createBed(req, res, next) {
  try {
    const { roomId, bedNumber } = req.body;
    if (!roomId || !bedNumber) {
      return res.status(400).json({ message: 'roomId and bedNumber are required.' });
    }

    const room = await db.query('SELECT id FROM rooms WHERE id = $1', [roomId]);
    if (room.rows.length === 0) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const result = await db.query(
      `INSERT INTO beds (room_id, bed_number, status)
       VALUES ($1, $2, 'vacant') RETURNING *`,
      [roomId, bedNumber]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { getBeds, updateBedStatus, createBed };
