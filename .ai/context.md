# Cache Warmer — Project Context

## Purpose
A cache warming service that uses a self-hosted **Browserless** instance to visit configured URLs, simulating real user behaviour (mouse movement, scrolling, dwell time, cookie consent handling). Ensures CDN/cache layers serve fully-rendered, post-consent pages.

## Tech Stack
- **Runtime**: Node.js 22 LTS + TypeScript
- **Browser automation**: Playwright v1.51 (Playwright native WS protocol)
- **Stealth**: `playwright-extra` + `puppeteer-extra-plugin-stealth`
- **API server**: Fastify v4
- **Database**: SQLite via `better-sqlite3` + Knex migrations
- **Logging**: pino (structured JSON, stdout for Coolify)
- **Scheduler**: node-cron
- **Config validation**: Zod
- **Deployment**: Docker → Coolify

## Browserless Connection
Uses the **Playwright native protocol** endpoint (not CDP):
```
ws://<browserless-host>/chromium/playwright?token=TOKEN
```
Connected via `playwright.chromium.connect(wsEndpoint)`.

## Key Features
1. **URL groups**: defined in `config.yaml` — each group has a cron schedule and a list of URLs
2. **Real-user simulation**: Bezier-curve mouse movement, smooth scroll, 3–8s dwell time
3. **Cookie consent**: auto-dismissal for Cookiebot, OneTrust, TrustArc, generic GDPR banners (Dutch + English)
4. **Webhook trigger**: `POST /webhook/warm` with `X-API-Key` header — triggers on-demand warming
5. **Logging**: all runs and per-URL visits stored in SQLite, accessible via REST API

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Coolify health check |
| GET | `/runs` | API key | Paginated run history |
| GET | `/runs/:id` | API key | Run detail with visits |
| GET | `/runs/latest` | API key | Latest run per group |
| POST | `/trigger` | API key | Trigger group run by name |
| POST | `/webhook/warm` | API key | Webhook: trigger one or all groups |
| GET | `/config` | API key | Show current URL config |

**Auth header**: `X-API-Key: <value of API_KEY env var>`

## Environment Variables
```env
BROWSERLESS_WS_URL=ws://browserless:3000/chromium/playwright
BROWSERLESS_TOKEN=<secret>
API_KEY=<random-secret>
DB_PATH=/app/data/warmer.db
CONFIG_PATH=/app/config/config.yaml
PORT=3000
LOG_LEVEL=info
TIMEZONE=Europe/Amsterdam
```

## Project Structure
```
src/
├── index.ts            # entry point
├── config/             # Zod-validated env + config.yaml parser
├── browser/            # connection, context, stealth, cookieConsent
├── warmer/             # runner (group) + visitor (single URL)
├── scheduler/          # node-cron job per group
├── db/                 # Knex client, migrations, queries
├── api/                # Fastify server + routes
└── utils/              # logger, userAgents
```

## Deployment (Coolify)
- Docker multi-stage build
- Persistent volume: `/app/data` (SQLite)
- Config volume: `/app/config/config.yaml`
- Health check: `GET /health`
- Browserless runs on same Coolify internal network

## config.yaml example
```yaml
groups:
  - name: homepage
    schedule: "*/15 * * * *"
    urls:
      - https://example.com/
    options:
      scrollToBottom: true
      waitForSelector: "main"
```
