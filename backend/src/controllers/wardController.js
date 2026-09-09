const db = require('../config/db');

// GET /api/wards
async function getWards(req, res, next) {
  try {
    const result = await db.query('SELECT * FROM wards ORDER BY floor');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/wards/:id/rooms
async function getRoomsByWard(req, res, next) {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM rooms WHERE ward_id = $1 ORDER BY room_number',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/wards — admin only
async function createWard(req, res, next) {
  try {
    const { name, floor, type } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required.' });

    const result = await db.query(
      `INSERT INTO wards (name, floor, type) VALUES ($1, $2, $3) RETURNING *`,
      [name, floor, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// POST /api/wards/:id/rooms — admin only
async function createRoom(req, res, next) {
  try {
    const { id } = req.params; // ward id
    const { roomNumber, capacity } = req.body;
    if (!roomNumber) return res.status(400).json({ message: 'roomNumber is required.' });

    const result = await db.query(
      `INSERT INTO rooms (ward_id, room_number, capacity) VALUES ($1, $2, $3) RETURNING *`,
      [id, roomNumber, capacity || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { getWards, getRoomsByWard, createWard, createRoom };
