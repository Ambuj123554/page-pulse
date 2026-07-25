const { auditPage } = require('../src/auditPage');
const http = require('http');

// ------------------------------------------------------------------
// Helper — spin up a tiny HTTP server for integration-style tests
// ------------------------------------------------------------------
let server;
let baseUrl;
let slowTimer;  // Track the /slow setTimeout so we can clear it in afterAll

beforeAll((done) => {
  server = http.createServer((req, res) => {
    const respond = (status, contentType, body) => {
      res.writeHead(status, { 'Content-Type': contentType });
      res.end(body);
    };

    const u = new URL(req.url, 'http://localhost');

    switch (u.pathname) {
      // ---------- Happy path ----------
      case '/happy':
        respond(200, 'text/html', `
          <!DOCTYPE html>
          <html>
            <head>
              <title>My Test Page</title>
              <meta name="description" content="A page for testing">
            </head>
            <body>
              <h1>Main heading</h1>
              <h1>Second h1</h1>
              <img src="a.jpg">
              <img src="b.jpg" alt="described">
              <img src="c.jpg">
              <p>Hello world. This has several words for counting.</p>
            </body>
          </html>
        `);
        break;

      // ---------- Non-HTML response ----------
      case '/not-html':
        respond(200, 'application/json', '{"ok":true}');
        break;

      // ---------- Slow page (triggers timeout) ----------
      case '/slow':
        slowTimer = setTimeout(() => respond(200, 'text/html', '<html></html>'), 3000);
        break;

      // ---------- 404 HTML (still audit-able) ----------
      case '/not-found':
        respond(404, 'text/html', '<html><head><title>Not here</title></head><body><h1>Oops</h1></body></html>');
        break;

      default:
        respond(404, 'text/plain', 'Not found');
    }
  });

  server.listen(0, () => {
    baseUrl = `http://localhost:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  // The /slow test schedules a 3000ms setTimeout, but the test itself
  // finishes in ~500ms (axios timeout).  If we don't clear that timer
  // here, Jest reports it as an "open handle" and prints a warning.
  clearTimeout(slowTimer);

  server.close(done);
});

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe('auditPage', () => {
  // -------- Happy path --------
  test('returns correct metrics for a normal HTML page', async () => {
    const result = await auditPage(`${baseUrl}/happy`);

    expect(result).toMatchObject({
      url: `${baseUrl}/happy`,
      httpStatus: 200,
      title: 'My Test Page',
      metaDescription: 'A page for testing',
      h1Count: 2,
      imagesMissingAlt: 2,
    });
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.wordCount).toBeGreaterThan(0);
    // No error key on success
    expect(result.error).toBeUndefined();
  });

  // -------- Non-HTTP URL validation --------
  test('returns an error object for an invalid URL (malformed)', async () => {
    const result = await auditPage('not-a-url');

    expect(result).toMatchObject({
      error: true,
      type: 'network_error',
    });
    expect(result.message).toContain('not-a-url');
  });

  // -------- Non-HTML response --------
  test('returns an error object for non-HTML content', async () => {
    const result = await auditPage(`${baseUrl}/not-html`);

    expect(result).toMatchObject({
      error: true,
      type: 'non_html',
    });
    expect(result.message).toContain('Content-Type');
  });

  // -------- Timeout --------
  test('returns an error object on timeout when page is too slow', async () => {
    // Use a very short timeout so the /slow endpoint (3s) triggers it
    const result = await auditPage(`${baseUrl}/slow`, 500);

    expect(result).toMatchObject({
      error: true,
      type: 'network_error',
    });
    expect(result.message).toContain('timeout');
  });

  // -------- 404 HTML page is still parsable --------
  test('reports metrics even on a 404 HTML page', async () => {
    const result = await auditPage(`${baseUrl}/not-found`);

    expect(result.httpStatus).toBe(404);
    expect(result.title).toBe('Not here');
    expect(result.h1Count).toBe(1);
    expect(result.error).toBeUndefined();
  });

  // -------- Unreachable host --------
  test('returns an error object for an unreachable host', async () => {
    const result = await auditPage(
      'http://this-domain-does-not-exist-xyz1234567.com/', 2000
    );

    expect(result).toMatchObject({
      error: true,
      type: 'network_error',
    });
    expect(result.message).toContain('ENOTFOUND');
  });
});
