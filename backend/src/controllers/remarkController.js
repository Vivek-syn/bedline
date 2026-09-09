const db = require('../config/db');

// POST /api/patients/:patientId/remarks
// Doctor (or admin) leaves a short note on a patient's chart.
async function addRemark(req, res, next) {
  try {
    const { patientId } = req.params;
    const { remark } = req.body;

    if (!remark || !remark.trim()) {
      return res.status(400).json({ message: 'remark is required.' });
    }

    const result = await db.query(
      `INSERT INTO remarks (patient_id, doctor_id, remark)
       VALUES ($1, $2, $3) RETURNING *`,
      [patientId, req.user.id, remark.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/patients/:patientId/remarks
async function getRemarks(req, res, next) {
  try {
    const { patientId } = req.params;
    const result = await db.query(
      `SELECT remarks.*, users.name AS doctor_name
       FROM remarks
       LEFT JOIN users ON remarks.doctor_id = users.id
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { addRemark, getRemarks };
