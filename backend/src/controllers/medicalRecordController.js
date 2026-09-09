const db = require('../config/db');

// POST /api/patients/:patientId/medical-records
// Only a doctor (or admin) can add an entry — typically done at
// admission time to record the diagnosis/treatment plan.
async function addMedicalRecord(req, res, next) {
  try {
    const { patientId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'content is required.' });
    }

    const result = await db.query(
      `INSERT INTO medical_records (patient_id, doctor_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [patientId, req.user.id, content.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/patients/:patientId/medical-records
// Doctor, nurse, and admin can all read the full history.
async function getMedicalRecords(req, res, next) {
  try {
    const { patientId } = req.params;
    const result = await db.query(
      `SELECT medical_records.*, users.name AS doctor_name
       FROM medical_records
       LEFT JOIN users ON medical_records.doctor_id = users.id
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { addMedicalRecord, getMedicalRecords };
