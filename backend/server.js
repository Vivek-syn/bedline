// ============================================================
// SERVER ENTRYPOINT
// This is the file you run: `node server.js` (or `npm run dev`)
// It wires everything together: middleware, routes, error handling.
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./src/routes/authRoutes');
const bedRoutes = require('./src/routes/bedRoutes');
const admissionRoutes = require('./src/routes/admissionRoutes');
const patientRoutes = require('./src/routes/patientRoutes');
const wardRoutes = require('./src/routes/wardRoutes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// --- Global middleware (runs on EVERY request, in this order) ---
app.use(helmet());               // sets safer HTTP headers
app.use(cors());                 // allows the React app (different port) to call this API
app.use(express.json());         // parses incoming JSON bodies into req.body

// --- Health check (handy to confirm the server is alive) ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Feature routes ---
// Each of these is mounted at a "base path". So a route defined
// as router.post('/login') inside authRoutes actually becomes
// POST /api/auth/login once mounted here.
app.use('/api/auth', authRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/wards', wardRoutes);

// --- 404 handler for unmatched routes ---
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

// --- Central error handler (must be LAST) ---
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
