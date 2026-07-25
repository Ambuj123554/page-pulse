const { auditPage } = require('../src/auditPage');

// Mock the entire axios module so no real network calls are made
jest.mock('axios');
const axios = require('axios');

// ------------------------------------------------------------------
// Helper — sample HTML used by the happy-path test
// ------------------------------------------------------------------
const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Test Page Title</title>
  <meta name="description" content="Sample meta description text">
</head>
<body>
  <h1>Section Heading</h1>
  <img src="pic.jpg">
  <img src="photo.jpg" alt="A photo">
  <p>Short paragraph words here.</p>
</body>
</html>`;

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe('auditPage (mocked network)', () => {
  // Reset all mock state before each test so tests never leak into
  // each other.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ================================================================
  // 1. HAPPY PATH
  // ================================================================
  test('returns correct metrics for a normal HTML page', async () => {
    // Arrange — mock axios.get to resolve with an HTML response,
    // simulating a successful page fetch.  The `request.responseUrl`
    // field is what the real `follow-redirects` library populates
    // after following redirects, so we test that the code uses the
    // FINAL resolved URL, not the original input.
    axios.get.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: SAMPLE_HTML,
      request: { responseUrl: 'https://example.com/resolved-page' },
    });

    // Act
    const result = await auditPage('http://example.com');

    // Assert — check every field that the function is supposed to
    // compute from the HTML.
    expect(result).toMatchObject({
      // The original input was http://example.com but the mock says
      // the final redirect landed on https://example.com/resolved-page.
      url: 'https://example.com/resolved-page',

      httpStatus: 200,

      // <title>Test Page Title</title>
      title: 'Test Page Title',

      // <meta name="description" content="Sample meta description text">
      metaDescription: 'Sample meta description text',

      // There is exactly one <h1>
      h1Count: 1,

      // Two <img> tags: one without alt, one with alt="A photo".
      // Only the missing-alt one is counted.
      imagesMissingAlt: 1,

      // Body text after cheerio extraction and normalisation:
      //   "Section Heading Short paragraph words here."
      // That is 6 whitespace-separated tokens.
      wordCount: 6,
    });

    // responseTimeMs is measured in real time, so it should always
    // be >= 0.  We can't assert an exact value because it varies
    // with machine speed.
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);

    // Successful audits MUST NOT have an `error` key.
    expect(result.error).toBeUndefined();
  });

  // ================================================================
  // 2. FAILURE — Malformed / invalid URL
  // ================================================================
  test('returns error object for malformed URL without throwing', async () => {
    // Arrange — when a truly invalid URL string is passed, axios
    // rejects with an error.  We mock that rejection here.
    const err = new Error('ERR_INVALID_URL: not-a-valid-url');
    axios.get.mockRejectedValue(err);

    // Act — pass a string that is not a valid URL at all.
    const result = await auditPage('not-a-valid-url');

    // Assert — the function must return a structured error object
    // instead of throwing, and the error message must reference the
    // failing URL so callers can diagnose the problem.
    expect(result).toMatchObject({
      error: true,
      type: 'network_error',
    });
    expect(result.message).toContain('not-a-valid-url');
  });

  // ================================================================
  // 3. FAILURE — Unreachable domain (ENOTFOUND)
  // ================================================================
  test('returns error object for unreachable domain without throwing', async () => {
    // Arrange — simulate a DNS resolution failure, which axios
    // surfaces as an error with `.code === 'ENOTFOUND'`.
    const networkErr = new Error('getaddrinfo ENOTFOUND nowhere.example.com');
    networkErr.code = 'ENOTFOUND';
    axios.get.mockRejectedValue(networkErr);

    // Act — pass a URL whose host does not exist.
    const result = await auditPage('http://nowhere.example.com');

    // Assert — the function must catch the error and return a
    // structured network_error object, never throw.
    expect(result).toMatchObject({
      error: true,
      type: 'network_error',
    });
    // The error message should contain the URL we tried to reach.
    expect(result.message).toContain('nowhere.example.com');
  });

  // ================================================================
  // 4. BONUS — Non-HTML Content-Type
  // ================================================================
  test('returns non_html error when Content-Type is not HTML', async () => {
    // Arrange — mock a successful HTTP response that returns JSON
    // instead of HTML.  The URL / endpoint is valid, the server is
    // reachable, but the content type is wrong.
    axios.get.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: '{"ok":true}',
      request: { responseUrl: 'https://example.com/data.json' },
    });

    // Act
    const result = await auditPage('https://example.com/data.json');

    // Assert — the function should detect the Content-Type mismatch
    // and return a non_html error, NOT attempt to parse the JSON as
    // HTML with cheerio (which could crash or produce garbage).
    expect(result).toMatchObject({
      error: true,
      type: 'non_html',
    });
    expect(result.message).toContain('Content-Type');
    expect(result.message).toContain('application/json');
    // Even in error cases, the function should include contextual
    // metadata so callers can log / investigate.
    expect(result.url).toBe('https://example.com/data.json');
    expect(result.httpStatus).toBe(200);
  });
});
