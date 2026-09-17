const db = require('../../config/db');
const { NotFound, Conflict } = require('../../core/errors');

async function listWards() {
  const result = await db.query(
    `SELECT w.id, w.name, w.floor, w.type,
            COUNT(DISTINCT r.id)::int AS room_count,
            COUNT(b.id)::int AS bed_count
       FROM wards w
       LEFT JOIN rooms r ON r.ward_id = w.id
       LEFT JOIN beds b ON b.room_id = r.id
      GROUP BY w.id
      ORDER BY w.floor NULLS LAST, w.name`
  );
  return result.rows;
}

async function listRooms(wardId) {
  const ward = await db.query('SELECT id FROM wards WHERE id = $1', [wardId]);
  if (ward.rows.length === 0) throw NotFound('That ward does not exist.');

  const result = await db.query(
    `SELECT r.id, r.room_number, r.capacity, COUNT(b.id)::int AS bed_count
       FROM rooms r LEFT JOIN beds b ON b.room_id = r.id
      WHERE r.ward_id = $1
      GROUP BY r.id
      ORDER BY r.room_number`,
    [wardId]
  );
  return result.rows;
}

async function createWard({ name, floor, type }) {
  const result = await db.query(
    'INSERT INTO wards (name, floor, type) VALUES ($1, $2, $3) RETURNING *',
    [name, floor ?? null, type || null]
  );
  return result.rows[0];
}

async function createRoom(wardId, { roomNumber, capacity }) {
  const ward = await db.query('SELECT id FROM wards WHERE id = $1', [wardId]);
  if (ward.rows.length === 0) throw NotFound('That ward does not exist.');

  const clash = await db.query(
    'SELECT 1 FROM rooms WHERE ward_id = $1 AND room_number = $2',
    [wardId, roomNumber]
  );
  if (clash.rows.length > 0) throw Conflict(`Room ${roomNumber} already exists in this ward.`);

  const result = await db.query(
    'INSERT INTO rooms (ward_id, room_number, capacity) VALUES ($1, $2, $3) RETURNING *',
    [wardId, roomNumber, capacity || 1]
  );
  return result.rows[0];
}

module.exports = { listWards, listRooms, createWard, createRoom };
