require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const auditRouter = require('./src/routes/audit');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;

// ---------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'page-pulse' });
});

app.use('/api', auditRouter);

// ---------------------------------------------------------------
// Serve built frontend in production
// ---------------------------------------------------------------
const frontendDist = path.join(__dirname, process.env.FRONTEND_DIST || 'project/dist');

app.use(express.static(frontendDist));

// SPA fallback — send index.html for any non-API GET request
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ---------------------------------------------------------------
// 404 catch-all (only hits for non-GET, non-frontend routes)
// ---------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'not-found', message: 'Route not found.' });
});

// ---------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'internal-error',
    message: 'An unexpected error occurred.',
  });
});

// ---------------------------------------------------------------
// Start
// ---------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Page Pulse running on http://localhost:${PORT}`);
});

module.exports = app;
