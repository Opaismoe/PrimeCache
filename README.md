# PrimeCache

A self-hosted cache warming service that visits configured URLs using a real browser (via [Browserless](https://browserless.io/)), simulating genuine user behaviour to keep your CDN/reverse-proxy cache warm.

## What it does

- Visits URLs on a configurable cron schedule using Playwright connected to a Browserless instance
- Simulates real users: Bezier-curve mouse movement, smooth scrolling, randomised dwell time, rotating user agents and viewports
- Automatically dismisses cookie consent banners (Cookiebot, OneTrust, TrustArc, generic GDPR dialogs, shadow DOM and iframe-based banners)
- Stores every run and per-URL visit result in SQLite (status code, TTFB, load time, consent strategy, errors)
- Exposes a REST API to trigger runs on demand, inspect history, and reload config
- Live-reloads `config.yaml` without restarting the process
- Deploys as a single Docker container alongside Browserless on Coolify (or any Docker host)

---

## Requirements

- Docker + Docker Compose
- A running [Browserless](https://www.browserless.io/) instance (self-hosted or cloud)

---

## Quick start

**1. Copy the example env file and fill in your values:**

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `BROWSERLESS_WS_URL` | yes | WebSocket URL of your Browserless instance, e.g. `ws://browserless:3000/chromium/playwright` |
| `BROWSERLESS_TOKEN` | yes | Browserless auth token |
| `API_KEY` | yes | Secret for the REST API (min 16 chars) |
| `DB_PATH` | no | SQLite file path (default: `/app/data/warmer.db`) |
| `CONFIG_PATH` | no | Path to `config.yaml` (default: `/app/config/config.yaml`) |
| `PORT` | no | API server port (default: `3000`) |
| `LOG_LEVEL` | no | `trace` / `debug` / `info` / `warn` / `error` (default: `info`) |
| `TIMEZONE` | no | Cron timezone (default: `Europe/Amsterdam`) |

**2. Configure your URL groups in `config.yaml`:**

```yaml
groups:
  - name: homepage
    schedule: "*/15 * * * *"   # every 15 minutes
    urls:
      - https://example.com/
      - https://example.com/nl/
    options:
      scrollToBottom: true
      waitForSelector: "main"  # optional: wait for this selector before interacting

  - name: product-pages
    schedule: "0 * * * *"     # every hour
    urls:
      - https://example.com/products
    options:
      crawl: true
      crawl_depth: 2           # follow links up to 2 levels deep
```

**Crawl mode** — when `crawl: true`, the warmer visits the configured URLs and then follows all same-origin links it discovers, up to `crawl_depth` levels. Duplicate URLs are never visited twice within a single run. This is useful for warming an entire section of a site without listing every page manually.

**3. Start the stack:**

```bash
docker compose up -d
```

**4. Verify it's running:**

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":42}
```

---

## REST API

All endpoints except `/health` require the `X-API-Key` header.

### Health

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":42}
```

No auth required. Used as the Coolify/Docker health check.

### Trigger a run (synchronous)

Runs immediately and waits until complete, then returns the run ID.

```bash
curl -X POST http://localhost:3000/trigger \
  -H "X-API-Key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"group": "homepage"}'
# {"runId": 42}
```

### Webhook (async)

Responds immediately while warming runs in the background. Use `"all"` to warm every configured group at once.

```bash
curl -X POST http://localhost:3000/webhook/warm \
  -H "X-API-Key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"group": "homepage"}'
# {"queued": true, "runIds": [-1]}
```

Watch it run in the logs:

```bash
docker compose logs -f cache-warmer
```

### Run history

```bash
# All runs (paginated)
curl http://localhost:3000/runs \
  -H "X-API-Key: <your-api-key>"

# Latest run per group
curl http://localhost:3000/runs/latest \
  -H "X-API-Key: <your-api-key>"

# Single run with per-URL visit details
curl http://localhost:3000/runs/1 \
  -H "X-API-Key: <your-api-key>"
```

**Example response for `GET /runs/1`:**

```json
{
  "id": 1,
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
      "final_url": "https://example.com/",
      "consent_found": true,
      "consent_strategy": "cookiebot",
      "error": null,
      "visited_at": "2024-01-15T10:00:05.000Z"
    }
  ]
}
```

Run `status` values: `running` · `completed` · `partial_failure` · `failed`

### Config inspection

```bash
curl http://localhost:3000/config \
  -H "X-API-Key: <your-api-key>"
```

Returns the currently loaded URL groups.

---

## Coolify deployment

1. Push this repo to a Git remote Coolify can access
2. In Coolify: **New Service → Docker Compose** (or Docker from Git)
3. Set all environment variables in the Coolify UI (copy from `.env.example`)
4. Add a persistent volume: `/app/data` (for SQLite)
5. Mount your `config.yaml` to `/app/config/config.yaml`
6. Set the health check: `GET http://localhost:3000/health`
7. Put the cache-warmer on the same internal Coolify network as your Browserless service

The `BROWSERLESS_WS_URL` should use the internal service name, e.g. `ws://browserless:3000/chromium/playwright`.

---

## Local development

```bash
pnpm install
cp .env.example .env   # fill in values, set DB_PATH=./data/warmer.db and CONFIG_PATH=./config.yaml
pnpm dev               # starts with watch mode
```

Run tests:

```bash
pnpm test
pnpm typecheck
```

Full local stack with Browserless:

```bash
docker compose up
```

---

## Config live-reload

`config.yaml` is watched with chokidar. Edit the file while the service is running and the cron schedule will update within seconds — no restart required. The currently running warm run (if any) completes before the new schedule takes effect.
