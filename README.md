# Page Pulse

A Node.js + Express backend that audits web pages for SEO and content metrics.  
Uses [axios](https://axios-http.com/) for HTTP fetching and [cheerio](https://cheerio.js.org/) for HTML parsing.

---

## Setup

### Prerequisites

- **Node.js** >= 18 (the `dev` script uses the `--watch` flag, added in Node 18)
- **npm** (bundled with Node)

### Install dependencies

```bash
npm install
cd project && npm install && cd ..
```

### Development mode (two servers)

Backend runs on `http://localhost:4000`, frontend on `http://localhost:5173`.

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend (Vite dev server, proxies /api to :4000)
cd project && npm run dev
```

The Vite config (`project/vite.config.ts`) proxies `/api/*` requests to `http://localhost:4000`, so the frontend can call the API without CORS issues during development.

### Production mode (single server)

Build the frontend, then start the backend which serves both the API and the static frontend files.

```bash
# Build the frontend
cd project && npm run build && cd ..

# Start — serves API on /api/* and frontend on /*
npm start
```

The production server serves the built frontend from `project/dist/` and falls back to `index.html` for any non-API GET request (SPA routing).

### Run the test suite

```bash
npm test
```

Runs Jest with `--forceExit` and `--detectOpenHandles`. Tests live in `tests/`.

---

## API Contract

### `POST /api/audit`

Fetches a URL, parses the HTML, and returns structured metrics.

#### Request body

```jsonc
{
  "url": "string"  // Fully-qualified http:// or https:// URL (required)
}
```

#### Success response (200)

| Field            | Type    | Description |
|------------------|---------|-------------|
| `url`            | string  | Final resolved URL after all redirects |
| `httpStatus`     | number  | HTTP status code of the response |
| `responseTimeMs` | number  | Total request + response time in ms |
| `title`          | string  | null | Content of the `<title>` tag |
| `metaDescription`| string  | null | Content of `<meta name="description">` |
| `h1Count`        | number  | Number of `<h1>` elements on the page |
| `imagesMissingAlt` | number | `<img>` tags that have no `alt` attribute |
| `wordCount`      | number  | Approximate word count of visible body text |

#### Error response (4xx / 5xx)

All errors share a consistent shape:

| Field    | Type    | Description |
|----------|---------|-------------|
| `error`  | boolean | Always `true` |
| `type`   | string  | Error category (see table below) |
| `message`| string  | Human-readable description |
| `url`    | string  | Present when a response was received (non_html errors) |
| `httpStatus` | number | Present when a response was received |

**Error types this API returns:**

| Type            | HTTP status | When it occurs |
|-----------------|-------------|----------------|
| `invalid_url`   | 400         | URL is missing, not a valid URL, or has an unsupported protocol |
| `non_html`      | 422         | Response is not HTML (wrong Content-Type or empty body) |
| `network_error` | 502         | DNS failure, connection refused, or any network-level error |
| `timeout`       | 504         | Request exceeded the timeout (default 8000 ms, configurable via `TIMEOUT_MS` env var) |
| `internal_error`| 500         | Catch-all for unexpected errors that escape normal handling |

#### Example

**Request:**

```bash
curl -X POST http://localhost:4000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

**Success response (200):**

```json
{
  "url": "https://example.com/",
  "httpStatus": 200,
  "responseTimeMs": 312,
  "title": "Example Domain",
  "metaDescription": null,
  "h1Count": 1,
  "imagesMissingAlt": 1,
  "wordCount": 28
}
```

**Error response (502) — unreachable domain:**

```json
{
  "error": true,
  "type": "network_error",
  "message": "Could not reach \"http://this-does-not-exist.example.com\". The host may be unreachable or the domain does not exist."
}
```

---

## Design decisions

### 1. Consistent error shape instead of ad-hoc error handling

Every failure path — URL validation, network error, timeout, non-HTML response, and the catch-all — returns JSON with the same three fields: `error: true`, a machine-readable `type` string, and a human-readable `message`. Error objects from `auditPage` also include contextual fields (`url`, `httpStatus`) when available.

**Why:** A consumer (frontend, CLI, or another service) can always check `result.error === true` and branch on `result.type` without needing to know which code path produced the error. Ad-hoc error shapes would force every caller to handle each failure mode differently, making the API harder to use correctly.

### 2. Reported URL is the final resolved URL after redirects, not the original input

The `url` field in the success response comes from `response.request.responseUrl` (set by the `follow-redirects` library) rather than the original `url` argument passed to the function. If `http://google.com` redirects through two hops to `https://www.google.com`, the response reports `"url": "https://www.google.com/"`.

**Why:** The original code used the input URL everywhere downstream, which meant the audit result could say it audited one URL when the content actually came from a different one. Worse, when a domain change or protocol switch occurred during redirects, downstream code that relied on the original URL could produce incorrect results or crash. Using the final resolved URL ensures the report reflects the page that was actually parsed.

### 3. Content-Type is explicitly checked before HTML parsing

Before passing the response body to cheerio, the code checks `content-type` against `text/html` and `application/xhtml+xml`. Responses with any other `Content-Type` (e.g. `application/json`, `image/png`) are rejected with a `non_html` error.

**Why:** If the code attempted to parse every response as HTML, a JSON API endpoint or binary file would either produce garbage metrics (accidental text matching) or crash cheerio entirely. The explicit guard turns this into a predictable, testable error path rather than a silent misclassification or a runtime crash.
