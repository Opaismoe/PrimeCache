# PrimeCache

[![CI](https://github.com/Opaismoe/PrimeCache/actions/workflows/ci.yml/badge.svg)](https://github.com/Opaismoe/PrimeCache/actions/workflows/ci.yml)

A self-hosted cache-warming service. PrimeCache visits configured URLs on a cron schedule using Playwright connected to a [Browserless](https://www.browserless.io/) instance, simulating real user behaviour (mouse movement, scrolling, randomised dwell time) to keep CDN and reverse-proxy caches warm. Every run and per-URL visit result is stored in SQLite and exposed through a REST API and a React dashboard.

---

## Features

- Visits URLs on a configurable cron schedule using a real Chromium browser via Browserless
- Simulates human behaviour: Bezier-curve mouse movement, smooth scrolling, randomised dwell time, rotating user agents and viewports
- Automatically dismisses cookie consent banners: Cookiebot, OneTrust, TrustArc, generic GDPR dialogs, shadow DOM and iframe-based banners
- Records per-visit metrics: HTTP status code, TTFB, load time, redirect count, response headers (Cache-Control, X-Cache, CF-Cache-Status, ETag, CSP, etc.)
- Captures Core Web Vitals (LCP, CLS, INP, FCP) and SEO metadata (title, meta description, canonical URL, Open Graph tags) per visit
- BFS crawl mode — discovers and warms same-origin internal links up to a configurable depth
- Optional broken link detection (HEAD-checks all discovered links)
- Optional JPEG screenshot capture per visit
- Live-reloads `config.yaml` without restarting the process
- REST API for on-demand triggering, run history, and config inspection
- React dashboard with run history, uptime charts, SEO score trends, and Core Web Vitals

---

## Requirements

- Docker and Docker Compose
- A running [Browserless](https://www.browserless.io/) instance (self-hosted or cloud)

---

## Quick start

### 1. Environment variables

Copy `.env.example` to `.env` and fill in the required values:

| Variable | Required | Default | Description |
|---|---|---|---|
| `BROWSERLESS_WS_URL` | yes | — | WebSocket URL of your Browserless instance, e.g. `ws://browserless:3000/chromium/playwright` |
| `BROWSERLESS_TOKEN` | yes | — | Browserless auth token |
| `API_KEY` | yes | — | Secret for the REST API (minimum 16 characters) |
| `POSTGRES_PASSWORD` | yes | — | Password for the PostgreSQL database |
| `DB_PATH` | no | `/app/data/warmer.db` | SQLite file path |
| `CONFIG_PATH` | no | `/app/config/config.yaml` | Path to `config.yaml` inside the container |
| `PORT` | no | `3000` | API server port |
| `LOG_LEVEL` | no | `info` | Log verbosity: `trace` / `debug` / `info` / `warn` / `error` |
| `TIMEZONE` | no | `Europe/Amsterdam` | Timezone used for cron schedule evaluation |

### 2. Configure URL groups in `config.yaml`

```yaml
groups:
  - name: homepage
    schedule: "*/15 * * * *"   # every 15 minutes
    urls:
      - https://example.com/
      - https://example.com/about/
    options:
      scrollToBottom: true
      waitForSelector: "main"

  - name: product-pages
    schedule: "0 * * * *"     # every hour
    urls:
      - https://example.com/products/
    options:
      crawl: true
      crawl_depth: 2

  - name: staging
    schedule: "0 6 * * *"
    urls:
      - https://staging.example.com/
    options:
      basicAuth:
        username: ci
        password: secret
      fetchAssets: false
      stealth: false
```

### 3. Start the stack

```bash
docker compose up -d
```

The stack starts PrimeCache (port 3000) and a PostgreSQL instance. Mount your `config.yaml` is already configured in `docker-compose.yml`.

### 4. Verify

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":42}
```

---

## Configuration reference

Each group in `config.yaml` accepts an `options` block. All fields are optional unless noted.

| Option | Type | Default | Description |
|---|---|---|---|
| `scrollToBottom` | bool | `false` | Scroll to the bottom of the page after load, triggering lazy-loaded content |
| `waitForSelector` | string | — | Wait for a CSS selector to appear in the DOM before measuring metrics (5 s timeout) |
| `crawl` | bool | `false` | BFS-crawl same-origin internal links discovered on each configured URL |
| `crawl_depth` | int (1–10) | — | Maximum crawl depth. **Required when `crawl: true`** |
| `userAgent` | string | — | Override the rotating user agent string for this group |
| `localStorage` | record | — | Key/value pairs injected into `localStorage` via an init script before page load |
| `cookies` | array | — | Cookies injected into the browser context before page load. Each entry: `name`, `value`, and optionally `url`, `domain`, `path`, `httpOnly`, `secure`, `sameSite` (`Strict`/`Lax`/`None`), `expires` |
| `basicAuth` | object | — | HTTP Basic Auth credentials: `{ username, password }`. Applied to all requests in the context |
| `navigationTimeout` | int (ms) | `30000` | Maximum time to wait for page navigation to complete (minimum 5000) |
| `waitUntil` | enum | `networkidle` | Navigation readiness event: `networkidle`, `load`, or `domcontentloaded` |
| `delayMinMs` | int (ms) | — | Minimum delay between URL visits for this group, overriding the global setting |
| `delayMaxMs` | int (ms) | — | Maximum delay between URL visits for this group, overriding the global setting |
| `fetchAssets` | bool | `true` | When `false`, blocks downloads of fonts, images, CSS, and JS. Useful for lightweight cache-pinging |
| `stealth` | bool | `true` | Enable the Playwright stealth plugin and fingerprint randomisation |
| `screenshot` | bool | `false` | Capture a JPEG screenshot (60% quality) per visit and store it as base64 in the visit record |
| `checkBrokenLinks` | bool | `false` | HEAD-check all same-origin links discovered on the page and report those returning HTTP 4xx/5xx |
| `retryCount` | int (0–10) | `3` | Number of times to retry a failed URL visit before recording it as an error |

### Crawl mode

When `crawl: true`, the warmer visits each configured URL, extracts all same-origin `<a href>` links, and recursively visits them up to `crawl_depth` levels. URL fragments are stripped and duplicates are skipped within a single run. This is useful for warming an entire section of a site without enumerating every page.

### Live reload

`config.yaml` is watched with chokidar. Saving the file while the service is running applies the new schedule immediately — no restart required. A run already in progress completes before the updated schedule takes effect. If the file contains a validation error the previous config stays active and an error is logged.

---

## REST API

All endpoints except `GET /health` require the `X-API-Key: <your-api-key>` header.

### `GET /health`

Liveness check. No authentication required.

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":42}
```

### `POST /trigger` — synchronous run

Runs the specified group immediately, blocks until complete, then returns the run ID.

```bash
curl -X POST http://localhost:3000/trigger \
  -H "X-API-Key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"group": "homepage"}'
# {"runId": 42}
```

### `POST /webhook/warm` — async run

Fires the run in the background and responds immediately. Use `"all"` to trigger every configured group at once.

```bash
curl -X POST http://localhost:3000/webhook/warm \
  -H "X-API-Key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"group": "homepage"}'
# {"queued": true, "runIds": [-1]}
```

### `GET /runs`

Paginated run history. Query parameters: `limit` (default 20), `offset` (default 0).

```bash
curl http://localhost:3000/runs?limit=20&offset=0 \
  -H "X-API-Key: <your-api-key>"
```

### `GET /runs/latest`

Returns the latest run for each configured group.

```bash
curl http://localhost:3000/runs/latest \
  -H "X-API-Key: <your-api-key>"
```

### `GET /runs/:id`

Returns full detail for a single run, including per-URL visit records.

```bash
curl http://localhost:3000/runs/42 \
  -H "X-API-Key: <your-api-key>"
```

Example response:

```json
{
  "id": 42,
  "group_name": "homepage",
  "started_at": "2024-01-15T10:00:00.000Z",
  "ended_at": "2024-01-15T10:00:45.000Z",
  "status": "completed",
  "total_urls": 2,
  "success_count": 2,
  "failure_count": 0,
  "visits": [
    {
      "url": "https://example.com/",
      "status_code": 200,
      "ttfb_ms": 124,
      "load_time_ms": 1840,
      "redirect_count": 0,
      "final_url": "https://example.com/",
      "consent_found": true,
      "consent_strategy": "cookiebot",
      "headers": {
        "cache_control": "public, max-age=3600",
        "cf_cache_status": "HIT"
      },
      "seo": {
        "title": "Example Domain",
        "meta_description": null,
        "h1": "Example Domain",
        "canonical_url": "https://example.com/"
      },
      "cwv": {
        "lcp_ms": 820,
        "cls_score": 0.02,
        "inp_ms": null,
        "fcp_ms": 410
      },
      "error": null,
      "visited_at": "2024-01-15T10:00:05.000Z"
    }
  ]
}
```

Run `status` values: `running` · `completed` · `partial_failure` · `failed`

### `GET /config`

Returns the currently loaded URL group configuration.

```bash
curl http://localhost:3000/config \
  -H "X-API-Key: <your-api-key>"
```

---

## Deployment

### Docker Compose (generic)

The included `docker-compose.yml` starts PrimeCache and PostgreSQL. Adjust the volume mounts and environment variables as needed:

```bash
cp .env.example .env   # fill in required values
docker compose up -d
```

Persistent data lives in the `postgres_data` named volume. Mount your `config.yaml` to `/app/config/config.yaml` inside the container (already configured in `docker-compose.yml`).

To rebuild the image after a code change:

```bash
docker compose up --build -d
```

### Coolify

1. Push this repository to a Git remote that Coolify can access
2. In Coolify: **New Service → Docker Compose from Git**
3. Set all environment variables in the Coolify UI (see the table above)
4. Mount `config.yaml` to `/app/config/config.yaml`
5. Set the health check endpoint to `GET http://localhost:3000/health`
6. Place the PrimeCache service on the same internal Docker network as your Browserless instance and set `BROWSERLESS_WS_URL` to use its internal service name, e.g. `ws://browserless:3000/chromium/playwright`

---

## Local development

```bash
pnpm install
cp .env.example .env   # set DB_PATH=./data/warmer.db and CONFIG_PATH=./config.yaml
pnpm dev               # backend in watch mode (ts-node-dev)
```

Run tests:

```bash
pnpm test          # single pass
pnpm test:watch    # watch mode
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint src/
```

Full local stack including Browserless:

```bash
docker compose up
```

Run a single test file:

```bash
pnpm test backend/src/warmer/runner.test.ts
```

---

## License

MIT
