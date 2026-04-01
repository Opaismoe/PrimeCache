# PrimeCache

[![CI](https://github.com/Opaismoe/PrimeCache/actions/workflows/ci.yml/badge.svg)](https://github.com/Opaismoe/PrimeCache/actions/workflows/ci.yml)

A self-hosted website monitoring and cache-warming service. PrimeCache visits configured URLs on a cron schedule using a real Chromium browser via [Browserless](https://www.browserless.io/), simulating authentic user behaviour to keep CDN and reverse-proxy caches warm. Every visit is stored in PostgreSQL and surfaced in a React dashboard with performance trends, uptime tracking, SEO audits, and Core Web Vitals.

---

## Features

- Visits URLs on a configurable cron schedule using real Chromium via Browserless
- Simulates human behaviour: Bezier-curve mouse movement, smooth scrolling, randomised dwell time, rotating user agents and viewports
- Automatically dismisses cookie consent banners (Cookiebot, OneTrust, TrustArc, generic GDPR dialogs, shadow DOM and iframe-based banners)
- Records per-visit metrics: HTTP status code, TTFB, load time, redirect count, final URL
- Captures response headers: Cache-Control, X-Cache, CF-Cache-Status, ETag, CSP, and more
- Captures Core Web Vitals (LCP, CLS, INP, FCP) via injected PerformanceObserver
- Captures SEO metadata per visit: title, meta description, H1, canonical URL, Open Graph tags, robots meta
- BFS crawl mode — discovers and warms same-origin internal links up to a configurable depth
- Optional broken link detection (HEAD-checks all discovered links)
- Optional JPEG screenshot capture per visit
- Configurable retry logic per URL (0–10 retries)
- Live-reloads `config.yaml` without restarting the process
- REST API for on-demand triggering, run history, analytics, and config management
- Public status page endpoint — embeddable on external sites, no API key required
- React dashboard with performance trends, uptime, SEO scoring, Core Web Vitals, and CSV exports

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
| `ADMIN_USERNAME` | yes | — | Username for the dashboard login screen |
| `ADMIN_PASSWORD` | yes | — | Password for the dashboard login screen (minimum 8 characters) |
| `DATABASE_URL` | yes | — | PostgreSQL connection string, e.g. `postgres://primecache:<password>@postgres:5432/primecache` |
| `POSTGRES_PASSWORD` | yes | — | Password for the PostgreSQL service (used in Docker Compose) |
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
      checkBrokenLinks: true

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

This starts PrimeCache (API + React dashboard on port 3000) and a PostgreSQL instance. Database migrations run automatically on boot.

### 4. Verify

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":42}
```

---

## Dashboard

The React dashboard is served at `http://localhost:3000` and has the following sections:

### Home
Group cards showing the latest run status, last run time, and success/failure counts. Includes a run status breakdown chart and a URLs-visited-per-day trend chart across all groups.

### Group detail
A tabbed view per group with six sections:

| Tab | What it shows |
|---|---|
| **Overview** | Total runs, overall success rate, avg load time, avg TTFB, recent run list, and per-run trend charts (success rate, load time, uptime, SEO score) |
| **Performance** | P50/P95 load time and TTFB per URL, slow-URL flag, and load time trend chart over last 20 runs |
| **Uptime** | Uptime % per URL over last 30 days, total checks, down count, last status and timestamp |
| **SEO** | SEO score (0–100) per URL with detected issues, title / meta description / H1 / canonical, last 5 snapshots, change detection |
| **Core Web Vitals** | LCP, FCP, CLS, INP at P75 percentile per URL with good/needs-improvement/poor badges and trend charts |
| **Broken Links** | Broken URLs with HTTP status code, error message, occurrence count, and last-seen timestamp |

Performance, Uptime, SEO, and Broken Links tabs all support CSV export.

### Run history
Paginated, filterable table of all runs with status badges, duration, and success/failure counts. Running jobs can be stopped inline. History can be cleared per group.

### Status page
A public-facing uptime page at `/status` — no API key required. Shows per-group health (green ≥99%, yellow 95–99%, red <95%), uptime percentage, URL count, and last run status. Suitable for embedding or sharing.

### Config
Manage URL groups directly from the dashboard — add, edit, rename, or delete groups without touching `config.yaml` directly.

---

## Configuration reference

All fields in the `options` block are optional unless noted.

| Option | Type | Default | Description |
|---|---|---|---|
| `scrollToBottom` | bool | `false` | Scroll to the bottom of the page after load, triggering lazy-loaded content |
| `waitForSelector` | string | — | Wait for a CSS selector to appear before measuring (5 s timeout) |
| `crawl` | bool | `false` | BFS-crawl same-origin internal links discovered on each configured URL |
| `crawl_depth` | int (1–10) | — | Maximum crawl depth. **Required when `crawl: true`** |
| `userAgent` | string | — | Override the rotating user agent string for this group |
| `localStorage` | record | — | Key/value pairs injected into `localStorage` via init script before page load |
| `cookies` | array | — | Cookies injected into the browser context before page load. Fields: `name`, `value`, and optionally `url`, `domain`, `path`, `httpOnly`, `secure`, `sameSite` (`Strict`/`Lax`/`None`), `expires` |
| `basicAuth` | object | — | HTTP Basic Auth credentials: `{ username, password }`. Applied via `httpCredentials` on the browser context — covers all requests including sub-resources |
| `navigationTimeout` | int (ms) | `30000` | Maximum time to wait for page navigation to complete (minimum 5000) |
| `waitUntil` | enum | `networkidle` | Navigation readiness event: `networkidle`, `load`, or `domcontentloaded` |
| `delayMinMs` | int (ms) | `2000` | Minimum random delay between URL visits |
| `delayMaxMs` | int (ms) | `5000` | Maximum random delay between URL visits |
| `fetchAssets` | bool | `true` | When `false`, blocks fonts, images, CSS, and JS downloads. Useful for lightweight cache-pinging |
| `stealth` | bool | `true` | Enable the Playwright stealth plugin to hide browser automation signals |
| `screenshot` | bool | `false` | Capture a JPEG screenshot (60% quality) per visit, stored as base64 in the visit record |
| `checkBrokenLinks` | bool | `false` | HEAD-check all same-origin links discovered on the page and report HTTP 4xx/5xx responses |
| `retryCount` | int (0–10) | `3` | Number of times to retry a failed URL visit before recording it as an error |

---

## REST API

All endpoints except `GET /health`, `GET /api/public/status`, and `POST /api/auth/login` require the `X-API-Key: <your-api-key>` header.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check — no auth |
| GET | `/api/public/status` | Per-group uptime status for the last 30 days — no auth |
| POST | `/api/auth/login` | Exchange `{ username, password }` for `{ token }` — no auth required |
| GET | `/api/runs` | Paginated run history (`?limit=20&offset=0&group=<name>`) |
| GET | `/api/runs/latest` | Latest run per group |
| GET | `/api/runs/:id` | Run detail with all visit records |
| POST | `/api/trigger` | **Synchronous** — runs group, blocks until done, returns `{ runId }` |
| POST | `/api/trigger/async` | **Async** — fires run, returns `{ runId }` immediately |
| POST | `/webhook/warm` | **Async webhook** — `{ "group": "<name>" }`, use `"all"` for every group |
| POST | `/api/runs/:id/cancel` | Cancel a running execution |
| DELETE | `/api/runs` | Clear run history (`?group=<name>` to scope to one group) |
| GET | `/api/config` | Current loaded config |
| PUT | `/api/config` | Update config and rename groups |
| GET | `/api/groups/:name/overview` | Summary stats and per-run trend series |
| GET | `/api/groups/:name/performance` | P50/P95 load time & TTFB per URL + trend |
| GET | `/api/groups/:name/uptime` | Uptime % per URL over last 30 days |
| GET | `/api/groups/:name/seo` | SEO scores and metadata per URL |
| GET | `/api/groups/:name/cwv` | Core Web Vitals at P75 per URL + trend |
| GET | `/api/groups/:name/broken-links` | Broken links discovered during visits |
| GET | `/api/groups/:name/export` | CSV export (`?tab=performance\|uptime\|seo\|links`) |
| GET | `/api/stats` | Global stats: run status breakdown, visits per day per group |

---

## Deployment

### Docker Compose

```bash
cp .env.example .env   # fill in required values
docker compose up -d
```

Persistent data lives in the `postgres_data` named volume. `config.yaml` is mounted from the project root into the container at `/app/config/config.yaml`.

To rebuild after a code change:

```bash
docker compose up --build -d
```

### Coolify

1. Push this repository to a Git remote Coolify can access
2. In Coolify: **New Service → Docker Compose from Git**
3. Set all required environment variables in the Coolify UI
4. Mount `config.yaml` to `/app/config/config.yaml`
5. Set the health check to `GET http://localhost:3000/health`
6. Place PrimeCache on the same internal Docker network as your Browserless instance and set `BROWSERLESS_WS_URL` to its internal service name, e.g. `ws://browserless:3000/chromium/playwright`

---

## Local development

```bash
pnpm install
cp .env.example .env.local   # set DATABASE_URL and CONFIG_PATH=./config.yaml
pnpm dev                     # backend in watch mode
```

Run tests:

```bash
pnpm test          # single pass
pnpm test:watch    # watch mode
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
```

Run a single test file:

```bash
pnpm --filter primecache-backend test warmer/runner.test.ts
```

Full local stack including Browserless and PostgreSQL:

```bash
docker compose up
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js 22, Fastify 5, TypeScript |
| Browser automation | Playwright 1.58 + playwright-extra stealth |
| Database | PostgreSQL 17, Drizzle ORM |
| Scheduling | node-cron |
| Frontend | React 19, TanStack Router, TanStack Query, Recharts, shadcn/ui, Tailwind CSS 4 |
| Build | Vite (frontend), tsc (backend), multi-stage Docker |
| Tests | Vitest, PGlite (in-memory PostgreSQL) |

---

## License

MIT
