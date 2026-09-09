// A "controller" holds the actual logic for a route: read the
// request, talk to the database, send back a response. Routes
// files just say WHICH URL maps to WHICH controller function —
// they stay thin on purpose.

const bcrypt = require('bcrypt');
const db = require('../config/db');
const { signToken } = require('../utils/jwt');

// POST /api/auth/register
// Creates a new user account. In real hospital software, only an
// Admin/Receptionist would create staff/patient accounts — but we
// expose this openly here for the demo, so you can try every role.
async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password and role are all required.' });
    }

    const validRoles = ['admin', 'doctor', 'nurse', 'receptionist', 'patient'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: `role must be one of: ${validRoles.join(', ')}` });
    }

    // Check for an existing account with that email
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    // NEVER store plain-text passwords. bcrypt.hash "salts" and
    // hashes the password so even we (the developers) can't read it.
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, passwordHash, role]
    );

    const user = result.rows[0];

    // If they're registering as a patient, also create their patient record
    if (role === 'patient') {
      await db.query(
        `INSERT INTO patients (user_id, name) VALUES ($1, $2)`,
        [user.id, name]
      );
    }

    const token = signToken({ id: user.id, role: user.role });

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      // Deliberately vague — don't reveal whether the email exists
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken({ id: user.id, role: user.role });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
