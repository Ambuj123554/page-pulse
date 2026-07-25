const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Return the final resolved URL from an axios response object.
 * After redirects, the original `url` parameter no longer reflects
 * where the content actually came from.  This helper extracts the
 * final URL that axios / follow-redirects landed on.
 *
 * @param {object} response  The axios response object.
 * @param {string} fallback  Original input URL to fall back on.
 * @returns {string} The final URL after all redirects (or fallback).
 */
function getFinalUrl(response, fallback) {
  try {
    // axios v1 / follow-redirects stores the final resolved URL on the
    // underlying IncomingMessage.  The exact location varies by axios
    // version, so we try multiple known paths.
    return (
      response?.request?.responseUrl ||
      response?.request?.res?.responseUrl ||
      response?.responseUrl ||
      fallback
    );
  } catch {
    return fallback;
  }
}

/**
 * Safely extract text from a cheerio-wrapped element attribute.
 * Returns `null` when the attribute is missing (rather than `undefined`),
 * keeping the JSON response consistent.
 *
 * @param {cheerio.Cheerio} $el
 * @param {string} attr
 * @returns {string|null}
 */
function safeAttr($el, attr) {
  const val = $el.attr(attr);
  return val?.trim() ?? null;
}

/**
 * Fetch a page and return structured audit data.
 *
 * @param {string} url  Fully-qualified URL to audit.
 * @param {number} [timeoutMs=8000]  Request timeout in milliseconds.
 * @returns {Promise<object>} Audit result with shape documented in README.
 */
async function auditPage(url, timeoutMs = 8000) {
  try {
    const start = Date.now();

    const response = await axios.get(url, {
      timeout: timeoutMs,
      responseType: 'text',
      // Follow redirects (default: true)
      maxRedirects: 5,
      // Respect common user-agent to avoid being blocked
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PagePulse/1.0; +https://github.com/page-pulse)',
        Accept: 'text/html,application/xhtml+xml',
      },
      // Don't throw on non-2xx — we inspect httpStatus ourselves
      validateStatus: () => true,
    });

    const responseTimeMs = Date.now() - start;
    const httpStatus = response.status;

    // ---------------------------------------------------------------
    // Step 1 — use the FINAL resolved URL after any redirects
    // ---------------------------------------------------------------
    const finalUrl = getFinalUrl(response, url);

    // ---------------------------------------------------------------
    // Step 2 — verify we actually received a response body
    // ---------------------------------------------------------------
    const html = response.data;

    if (html === undefined || html === null || typeof html !== 'string') {
      return {
        error: true,
        type: 'non_html',
        message: `The page returned a ${httpStatus} with an empty or non-text body. Only HTML pages can be audited.`,
        url: finalUrl,
        httpStatus,
        responseTimeMs,
      };
    }

    // ---------------------------------------------------------------
    // Step 3 — verify the response is HTML
    // ---------------------------------------------------------------
    const contentType = response.headers['content-type'] || '';
    const isHtml =
      contentType.startsWith('text/html') ||
      contentType.startsWith('application/xhtml+xml');

    if (!isHtml) {
      return {
        error: true,
        type: 'non_html',
        message: `The page returned a ${httpStatus} with Content-Type "${contentType}". Only HTML pages can be audited.`,
        url: finalUrl,
        httpStatus,
        responseTimeMs,
      };
    }

    // ---------------------------------------------------------------
    // Step 4 — parse with cheerio and extract metrics
    // ---------------------------------------------------------------
    const $ = cheerio.load(html);

    const title = $('title').first().text().trim() || null;

    const metaDescription = safeAttr($('meta[name="description"]'), 'content');

    const h1Count = $('h1').length;

    // Count <img> tags that have no `alt` attribute at all
    let imagesMissingAlt = 0;
    $('img').each((_i, el) => {
      if ($(el).attr('alt') === undefined) {
        imagesMissingAlt += 1;
      }
    });

    // Approximate word count from visible body text
    const bodyText = $('body').text();
    const words = bodyText
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const wordCount = words.length;

    return {
      url: finalUrl,
      httpStatus,
      responseTimeMs,
      title,
      metaDescription,
      h1Count,
      imagesMissingAlt,
      wordCount,
    };
  } catch (err) {
    // Catch ANY unexpected error inside auditPage (axios failure, cheerio
    // crash, undefined property access, etc.) so this function NEVER throws
    // or returns a rejected promise. Always return a structured error object.
    let errorMessage;
    try {
      errorMessage = err?.message || String(err) || 'Unknown error during page audit';
    } catch {
      errorMessage = 'Unknown error during page audit';
    }

    return {
      error: true,
      type: 'network_error',
      message: `Failed to audit "${url}": ${errorMessage}`,
    };
  }
}

module.exports = { auditPage };
