const express = require('express');
const { auditPage } = require('../auditPage');

const router = express.Router();

/**
 * POST /api/audit
 *
 * Validates the URL from the request body, calls auditPage(), and returns
 * a structured JSON response for every code path.
 */
router.post('/audit', async (req, res) => {
  const { url } = req.body || {};

  // ---------------------------------------------------------------
  // 1 — Validate the URL
  // ---------------------------------------------------------------
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

  // Only http(s) are fetchable
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({
      error: true,
      type: 'invalid_url',
      message: `The protocol "${parsed.protocol}" is not supported. Only http and https URLs are accepted.`,
    });
  }

  // ---------------------------------------------------------------
  // 2 — Fetch and parse
  // ---------------------------------------------------------------
  const timeoutMs = parseInt(process.env.TIMEOUT_MS, 10) || 8000;

  try {
    const result = await auditPage(url, timeoutMs);

    // auditPage returns an error-shaped object on failure
    if (result && result.error === true) {
      // Map type to status code
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
    // 3 — Handle timeout / unreachable errors gracefully
    // ---------------------------------------------------------------
    // IMPORTANT: err may be null, undefined, or a primitive (strings,
    // objects without .code, etc.). Always guard property access.
    const errorCode = err?.code ?? null;

    if (errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT') {
      return res.status(504).json({
        error: true,
        type: 'timeout',
        message: `Request to "${url}" timed out after ${timeoutMs} ms.`,
      });
    }

    if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED' || errorCode === 'EAI_AGAIN') {
      return res.status(502).json({
        error: true,
        type: 'network_error',
        message: `Could not reach "${url}". The host may be unreachable or the domain does not exist.`,
      });
    }

    // Catch-all for any unexpected error
    console.error('Unexpected audit error:', err);
    return res.status(500).json({
      error: true,
      type: 'internal_error',
      message: 'An unexpected error occurred while auditing the page. Please try again later.',
    });
  }
});

module.exports = router;
