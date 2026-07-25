const { auditPage } = require('../src/auditPage');

/**
 * Vercel serverless function — POST /api/audit
 *
 * Reuses the same auditPage() logic from src/auditPage.js (axios + cheerio)
 * with the same error-handling contract documented in README.md.
 *
 * Express is NOT needed here — Vercel handles routing, body parsing and
 * CORS natively.
 */
module.exports = async (req, res) => {
  // ---------------------------------------------------------------
  // CORS — allow frontend (same domain) and dev tools
  // ---------------------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // ---------------------------------------------------------------
  // Method check
  // ---------------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: true,
      type: 'invalid_method',
      message: 'Only POST requests are accepted at this endpoint. Use POST with a JSON body containing a "url" field.',
    });
  }

  // ---------------------------------------------------------------
  // 1 — Validate the URL
  // ---------------------------------------------------------------
  const { url } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      error: true,
      type: 'invalid_url',
      message: 'A valid "url" string is required in the request body.',
    });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({
      error: true,
      type: 'invalid_url',
      message: `"${url}" is not a valid URL. Please provide a well-formed URL including the protocol (e.g. https://example.com).`,
    });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({
      error: true,
      type: 'invalid_url',
      message: `The protocol "${parsed.protocol}" is not supported. Only http and https URLs are accepted.`,
    });
  }

  // ---------------------------------------------------------------
  // 2 — Fetch and parse via the shared module
  // ---------------------------------------------------------------
  const timeoutMs = parseInt(process.env.TIMEOUT_MS, 10) || 8000;

  try {
    const result = await auditPage(url, timeoutMs);

    // auditPage returns an error-shaped object on failure
    if (result && result.error === true) {
      const statusMap = {
        non_html: 422,
        network_error: 502,
      };
      const statusCode = statusMap[result.type] || 502;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    // ---------------------------------------------------------------
    // 3 — Handle timeout / unreachable / unexpected errors
    // ---------------------------------------------------------------
    const errorCode = err?.code ?? null;

    if (errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT') {
      return res.status(504).json({
        error: true,
        type: 'timeout',
        message: `Request to "${url}" timed out after ${timeoutMs} ms.`,
      });
    }

    if (
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'EAI_AGAIN'
    ) {
      return res.status(502).json({
        error: true,
        type: 'network_error',
        message: `Could not reach "${url}". The host may be unreachable or the domain does not exist.`,
      });
    }

    // Catch-all
    console.error('Unexpected audit error:', err);
    return res.status(500).json({
      error: true,
      type: 'internal_error',
      message: 'An unexpected error occurred while auditing the page. Please try again later.',
    });
  }
};
