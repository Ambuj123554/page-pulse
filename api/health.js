/**
 * Vercel serverless function — GET /api/health
 *
 * Lightweight health-check endpoint. Returns the same shape as the
 * Express /health route in server.js.
 */
module.exports = async (req, res) => {
  res.json({ status: 'ok', service: 'page-pulse' });
};
