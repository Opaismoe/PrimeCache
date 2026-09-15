# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow
- Branch per feature: `feature/<name>` or `fix/<name>` — never commit directly to `main`
- Small, focused commits — one logical change per commit
- Conventional Commits: `feat(scope): summary`, `fix(scope): summary`, `test(scope): summary`, `chore: summary`
- Commit after tests pass, commit after implementation passes, commit after each bug fix — not all at once

## Development workflow (TDD — enforced)

All work follows the states in `.ai/todo.md`: **init → test → code → review → done**.

- **Write tests before implementation.** Tests must fail before you write any code.
- **Never move to `code` state** until tests exist and fail for the right reason.
- **Never move to `review` state** until all tests pass.
- Test files live alongside source: `backend/config/env.test.ts` next to `backend/config/env.ts`.
- Use PGlite (in-memory PostgreSQL) for DB tests — never mock the query layer itself.
- Mock only external I/O: Browserless WS, filesystem. Never mock the module under test.
- After completing a task, update its status in `.ai/todo.md`.

## Commands

Run from the repo root:

```bash
pnpm dev           # backend in watch mode (ts-node-dev)
pnpm build         # tsc backend + vite frontend → dist/
pnpm start         # node dist/index.js (production)
pnpm typecheck     # tsc --noEmit (all packages)
pnpm lint          # biome check (all packages)
pnpm test          # vitest run (all packages)
pnpm test:watch    # vitest watch (all packages)
```

Run a single test file:
```bash
pnpm --filter primecache-backend test warmer/runner.test.ts
```

Docker:
```bash
docker-compose up          # local dev (requires external Browserless — see env vars)
docker-compose up --build  # rebuild image
```

## Environment variables

Required (no defaults):
- `BROWSERLESS_WS_URL` — e.g. `ws://browserless:3000/chromium/playwright`
- `BROWSERLESS_TOKEN` — auth token for your Browserless instance
- `API_KEY` — minimum 16 characters
- `SECRET_ENCRYPTION_KEY` — 64-character hex string (32 bytes); generate with `openssl rand -hex 32`
- `DATABASE_URL` — PostgreSQL connection string, e.g. `postgres://primecache:<password>@postgres:5432/primecache`
- `POSTGRES_PASSWORD` — password for the PostgreSQL Docker service
- `ADMIN_USERNAME` — username for the dashboard login screen
- `ADMIN_PASSWORD` — minimum 8 characters

Optional (defaults shown):
- `BROWSERLESS_HTTP_URL` — direct HTTP base URL for Lighthouse audits, e.g. `http://browserless:3000`. Use this when `BROWSERLESS_WS_URL` points to a public domain behind Cloudflare (CF passes WS but blocks HTTP). Defaults to deriving from `BROWSERLESS_WS_URL`.
- `CONFIG_PATH=/app/config/config.yaml`
- `PORT=3000`
- `LOG_LEVEL=info` (trace|debug|info|warn|error)
- `TIMEZONE=Europe/Amsterdam`
- `BETWEEN_URLS_MIN_MS=2000` / `BETWEEN_URLS_MAX_MS=5000`
- `TRUST_PROXY=false` — set `true` behind Coolify/nginx/Cloudflare so `request.ip` (used for rate-limit buckets) is the client, not the proxy
- `COOKIE_SECURE=true` — set `false` only for local HTTP development; session cookies are `Secure` otherwise

## Architecture

`backend/index.ts` boots in four sequential steps: run Drizzle migrations → load and resolve config → start Fastify API → register node-cron schedulers.

### Data flow for a warm run
1. **Trigger**: either node-cron (scheduled) or `POST /api/trigger` / `POST /webhook/warm` (on-demand)
2. `scheduler/index.ts` or `api/routes/` calls `warmer/runner.ts`
3. `runner.ts` reserves the group in `warmer/registry.ts` (a group never has two overlapping runs; a second trigger gets `RunAlreadyActiveError`), creates a `Run` DB record with `triggered_by` (`schedule|api|webhook|manual`), loops over URLs with random delays (2–5s between each), calls `warmer/visitor.ts` per URL, then finalises the run record
4. `visitor.ts` creates a fresh `BrowserContext` (via `browser/context.ts`), navigates, dismisses consent, simulates user behaviour, captures metrics, closes the context, returns `VisitResult`. The whole visit runs under `visitTimeout` (default 120s); on expiry the context is closed and the visit is recorded as failed
5. `runner.ts` inserts each `VisitResult` as a `Visit` row as soon as it completes (one row per URL, so crawl progress is visible mid-run), plus the SEO/headers/CWV/screenshot/broken-link/accessibility side tables
6. If a visit fails inside `getBrowser()` (`errorKind: 'connection'`), the runner skips retries and aborts the remaining URLs — Browserless is down, so every further URL would only burn the reconnect backoff

### Browserless connection
Always use Playwright **native** WS protocol — not CDP:
```typescript
const browser = await chromium.connect(`${env.BROWSERLESS_WS_URL}?token=${env.BROWSERLESS_TOKEN}`)
```
Endpoint format: `ws://<browserless-host>/chromium/playwright`

`browser/connection.ts` holds a singleton `Browser` with auto-reconnect (exponential backoff, max 5 retries). `getBrowser()` is the only entry point — never call `chromium.connect()` directly outside this module.

### Browser contexts
Create one `BrowserContext` per URL visit for full isolation (cookies, storage). Always close in `finally`. The context factory in `browser/context.ts` applies stealth, random viewport (1280–1920 × 768–1080), rotating user agents, and locale headers.

### Config loading
- `backend/config/env.ts` — Zod-parses `process.env` at startup. Hard exit if any required var is missing.
- `backend/config/urls.ts` — Parses and Zod-validates `config.yaml`. Uses chokidar to watch for file changes and hot-reloads the scheduler without restarting the process.

### Secrets store
Credentials in `config.yaml` (basicAuth, cookies, userAgent) can reference encrypted secrets stored in PostgreSQL using `secret:name` syntax. Secrets are AES-256-GCM encrypted at rest; the master key lives in `SECRET_ENCRYPTION_KEY`.

Manage secrets via the API (all require `X-API-Key`):
- `GET /api/secrets` — list secret names
- `POST /api/secrets` body `{ name, value }` — create or update
- `DELETE /api/secrets/:name` — remove

Resolution happens after `loadConfig()` at startup and on every config hot-reload. If a referenced secret is missing, the process logs an error and keeps the previous config. `index.ts` keeps two copies: the **raw** config (`secret:` references intact) is what `GET /api/config` serves and what the admin form round-trips; the **resolved** config (decrypted) goes only to the scheduler, runner and trigger routes. Never serialise the resolved one.

`PUT /api/config` rejects (400) a config that references a secret not in the store, and `DELETE /api/secrets/:name` refuses (409) while any group references it — otherwise the file on disk would fail to load on the next restart.

`config.yaml` group options (see `config.example.yaml` for the annotated version):
```yaml
options:
  # Navigation
  navigationTimeout: 30000    # ms for page.goto (min 5000)
  visitTimeout: 120000        # hard budget for the whole visit incl. consent/audits (min 10000)
  waitUntil: networkidle      # networkidle | load | domcontentloaded
  waitForSelector: "main"     # wait for CSS selector before measuring (5s, best effort)
  # Behaviour
  scrollToBottom: true        # scroll to page bottom after load
  delayMinMs: 2000            # override BETWEEN_URLS_MIN_MS for this group
  delayMaxMs: 5000            # override BETWEEN_URLS_MAX_MS for this group
  # Fingerprint
  userAgent: "MyBot/1.0"      # override the rotating user agent (plain or secret:<name>)
  stealth: true               # playwright-extra stealth plugin
  fetchAssets: true           # false blocks fonts/images/css/js
  # Auth & session — values may be secret:<name>
  basicAuth: { username: u, password: secret:pw }
  cookies: [{ name: session, value: secret:sess, domain: example.com }]
  localStorage: { feature_flag: "true" }
  # Crawling
  crawl: true                 # BFS crawl — discover and visit same-origin links
  crawl_depth: 2              # required when crawl: true; max 10
  crawl_timeout_ms: 3600000   # max ms the entire run may take before auto-cancel (min 60000)
  # Data collection
  screenshot: false
  checkBrokenLinks: false     # HEAD-check discovered links from the backend process
  checkAccessibility: false   # axe-core audit
  checkLighthouse: false      # post-run Lighthouse via Browserless (skipped if the run was cancelled)
  # Reliability
  retryCount: 3               # per-URL retries (0–10); skipped when Browserless itself is unreachable
```

URLs must be `http://` or `https://`; the schema rejects other schemes.

### API routes

All routes except `GET /health`, `GET /api/public/status`, `POST /api/auth/login` and `POST /webhook/trigger/:token` require either the `X-API-Key` header or a session cookie (see below).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check — no auth |
| GET | `/api/public/status` | Per-group uptime for last 30 days — no auth |
| POST | `/api/auth/login` | `{ username, password }` → sets `pc_session` + `pc_csrf` cookies — no auth; 10/min per IP |
| POST | `/api/auth/logout` | Deletes the session and clears cookies |
| GET | `/api/auth/me` | Session validity probe |
| GET | `/api/runs` | Paginated run history (`?limit=20&offset=0&group=<name>`) |
| GET | `/api/runs/latest` | Latest run per group |
| GET | `/api/runs/:id` | Run detail with visits |
| GET | `/api/runs/:id/screenshots` | Screenshots captured during a run |
| POST | `/api/trigger` | **Synchronous** — runs group, blocks until done, returns `{ runId }`; 409 `{ runId }` if the group is already running |
| POST | `/api/trigger/async` | **Async** — fires run, returns `{ runId }` immediately; 409 if already running |
| POST | `/api/webhook/warm` | **Async** — `{ "group": "<name>" }` or `"all"`; returns `{ runIds, alreadyRunning }` |
| POST | `/webhook/trigger/:token` | **Inbound webhook** — no auth; token in URL is the credential; 30/min per IP. Returns `{ queued: true, runId }` or `{ queued: false, runId, alreadyRunning: true }` |
| POST | `/api/runs/:id/cancel` | Signal cancellation. An active run finalises itself; an orphaned `running` row (e.g. after a restart) is finalised here |
| DELETE | `/api/runs` | Clear run history (`?group=<name>` to scope; `?confirm=true` required for all) |
| GET | `/api/config` | Current on-disk config (`secret:` references intact) |
| PUT | `/api/config` | Update config and rename groups; 400 if it references unknown secrets |
| GET | `/api/rate-limits` | Per-category limiter usage |
| GET | `/api/groups-health` | Which tabs have issues, per group |
| GET | `/api/groups/:name/overview` | Summary stats and per-run trend series |
| GET | `/api/groups/:name/performance` | P50/P95 load time & TTFB per URL + trend |
| GET | `/api/groups/:name/uptime` | Uptime % per URL over last 30 days |
| GET | `/api/groups/:name/seo` | SEO scores and metadata per URL |
| GET | `/api/groups/:name/cwv` | Core Web Vitals at P75 per URL + trend |
| GET | `/api/groups/:name/broken-links` | Broken links discovered during visits |
| GET | `/api/groups/:name/accessibility` | axe-core violations per URL |
| GET | `/api/groups/:name/lighthouse` | Latest Lighthouse report per URL (`?formFactor=desktop\|mobile`) |
| POST | `/api/groups/:name/lighthouse/trigger` | Run Lighthouse now; body `{ formFactor?, url? }` |
| GET | `/api/groups/:name/crawled-urls` | URLs discovered by crawling |
| DELETE | `/api/groups/:name/crawled-urls` | Forget a crawled URL; body `{ url }` |
| GET | `/api/groups/:name/export` | CSV export (`?tab=performance\|uptime\|seo\|links`) |
| GET | `/api/stats` | Run status breakdown, visits per day per group, consent strategy counts (last 7d vs prior 7d) |
| GET | `/api/secrets` | List secret names (no values) |
| POST | `/api/secrets` | Upsert secret `{ name, value }` — encrypts and stores |
| DELETE | `/api/secrets/:name` | Remove a secret; 409 while a group references it |
| GET | `/api/groups/:name/webhooks` | List webhook tokens with `fire_count` / `success_count` (no token values) |
| POST | `/api/groups/:name/webhooks` | Create webhook token; body `{ description? }`; token returned once |
| DELETE | `/api/groups/:name/webhooks/:id` | Delete a webhook token |
| PATCH | `/api/groups/:name/webhooks/:id` | Toggle active; body `{ active: boolean }` |

### API authentication
Auth is a Fastify `preHandler` hook scoped to the protected plugin — not per-route. Two paths: `X-API-Key` (machine callers; compared via sha256 + `timingSafeEqual`) or the `pc_session` cookie issued by login (12h, stored in the `sessions` table) with a `pc_csrf` double-submit header on mutating requests. Rate limits are keyed by client IP only — never by a header the caller controls. Webhook trigger tokens are stored as sha256 and looked up by hash.

### Cookie consent (`browser/cookieConsent.ts`)
Strategies are tried in order; each click is bounded to 3s so a changed CMP DOM cannot stall the visit:
1. Cookiebot → OneTrust → TrustArc (id selectors) → generic attribute selector (`[id|class*=accept|agree|cookie]`) → shadow DOM pierce with text match (`/^(accept|akkoord|accepteer|agree|allow all|toestaan)/i`) → iframe-based banners

The winning strategy is stored per visit in `visits.consent_strategy`; `GET /api/stats` aggregates it week-over-week so a silent regression shows up as a drop.

After clicking, always wait 500–1000ms before continuing — CMPs fire XHR after accept that re-renders the page.

### Database
Drizzle ORM with `postgres-js` (PostgreSQL 17). Migrations in `backend/db/migrations/` run automatically at startup via `drizzle-orm/postgres-js/migrator`. All queries go through `backend/db/queries/` helpers — never raw SQL in business logic.

**Migration journal timestamps matter.** The migrator applies only entries whose `when` in `meta/_journal.json` is greater than the `created_at` of the last migration recorded in the database. A hand-written entry with a made-up or backdated `when` is silently skipped in production (this bit 0011, 0012 and 0013). Always use the real current epoch-millis (`date +%s%3d`), or let `drizzle-kit generate` write the entry.

### Logging
Always use pino child loggers (`logger.child({ runId, url })`). The runner passes its child logger into `visitUrl` so every visit line carries `runId`, `group` and `url`. Never `console.log`. Log level via `LOG_LEVEL` env var. Output is JSON on stdout (Coolify captures it).

## Key invariants
- A single URL failure must not abort the group run — `visitor.ts` catches per-URL errors and returns them in `VisitResult.error`; `runner.ts` sets status `partial_failure` if some fail, `failed` if all fail. The one exception is `errorKind: 'connection'` (Browserless unreachable), which stops the run early
- One run per group at a time — `warmer/registry.ts` reserves the group before the run row is inserted
- `GET /api/config` must never contain resolved secrets — it serves the raw config
- `config.yaml` is live-reloadable — do not cache its contents outside `backend/config/urls.ts`
- Browserless is **not** included in `docker-compose.yml` — you must provide your own instance and set `BROWSERLESS_WS_URL`
