# Cache Warmer — Build Guide

A step-by-step guide to building this project from scratch.

---

## 1. Project scaffold

**Init the project:**
```bash
pnpm init
```

**Install dependencies:**
```bash
pnpm add playwright playwright-extra puppeteer-extra-plugin-stealth
pnpm add fastify
pnpm add knex better-sqlite3
pnpm add node-cron
pnpm add pino pino-pretty
pnpm add zod
pnpm add js-yaml
pnpm add chokidar
pnpm add dotenv
```

**Install dev dependencies:**
```bash
pnpm add -D typescript ts-node ts-node-dev
pnpm add -D @types/node @types/better-sqlite3 @types/js-yaml @types/node-cron
pnpm add -D vitest
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Create `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Add scripts to `package.json`:**
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [x] Done

---

## 2. Docker setup

**Create `docker-compose.yml`** for local development. This spins up the app and a local Browserless instance together:
```yaml
services:
  cache-warmer:
    build: .
    environment:
      - BROWSERLESS_WS_URL=ws://browserless:3000/chromium/playwright
      - BROWSERLESS_TOKEN=dev-token
      - API_KEY=dev-api-key
      - DB_PATH=/app/data/warmer.db
      - CONFIG_PATH=/app/config/config.yaml
      - LOG_LEVEL=debug
      - PORT=3000
    volumes:
      - ./data:/app/data
      - ./config.yaml:/app/config/config.yaml
    ports:
      - "3000:3000"
    depends_on:
      - browserless

  browserless:
    image: ghcr.io/browserless/chromium:latest
    environment:
      - TOKEN=dev-token
    ports:
      - "3001:3000"
```

**Create `Dockerfile`** (multi-stage, production):
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN npm install -g pnpm
COPY package*.json ./
RUN pnpm install --prod
COPY --from=builder /app/dist ./dist
VOLUME ["/app/data", "/app/config"]
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

**Create `.env.example`:**
```env
BROWSERLESS_WS_URL=ws://browserless:3000/chromium/playwright
BROWSERLESS_TOKEN=your-browserless-token
API_KEY=your-random-api-key
DB_PATH=/app/data/warmer.db
CONFIG_PATH=/app/config/config.yaml
PORT=3000
LOG_LEVEL=info
TIMEZONE=Europe/Amsterdam
```

**Create `config.yaml`:**
```yaml
groups:
  - name: homepage
    schedule: "*/15 * * * *"
    urls:
      - https://example.com/
      - https://example.com/nl/
    options:
      scrollToBottom: true
      waitForSelector: "main"

  - name: product-pages
    schedule: "0 * * * *"
    urls:
      - https://example.com/products
```

- [x] Done

---

## 3. Config layer

### `src/config/env.ts`
Validates all environment variables at startup using Zod. If anything required is missing the process exits immediately with a clear error — nothing else should start.

```typescript
import { z } from 'zod'

const EnvSchema = z.object({
  BROWSERLESS_WS_URL: z.string().url(),
  BROWSERLESS_TOKEN: z.string().min(1),
  API_KEY: z.string().min(16),
  DB_PATH: z.string().default('/app/data/warmer.db'),
  CONFIG_PATH: z.string().default('/app/config/config.yaml'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace','debug','info','warn','error']).default('info'),
  TIMEZONE: z.string().default('Europe/Amsterdam'),
  BETWEEN_URLS_MIN_MS: z.coerce.number().default(2000),
  BETWEEN_URLS_MAX_MS: z.coerce.number().default(5000),
})

export const env = EnvSchema.parse(process.env)
```

**Write test first** (`src/config/env.test.ts`), then implement.

- [x] Tests written + failing
- [x] Code written + tests passing
- [x] Done

---

### `src/config/urls.ts`
Reads and validates `config.yaml`. Uses `chokidar` to watch the file for changes and calls a callback so the scheduler can re-register cron jobs without a restart.

The Zod schema to validate a group:
```typescript
const GroupOptionsSchema = z.object({
  scrollToBottom: z.boolean().default(false),
  waitForSelector: z.string().optional(),
}).default({})

const GroupSchema = z.object({
  name: z.string().min(1),
  schedule: z.string().min(1),   // cron expression
  urls: z.array(z.string().url()).min(1),
  options: GroupOptionsSchema,
})

export const ConfigSchema = z.object({
  groups: z.array(GroupSchema).min(1),
})

export type WarmGroup = z.infer<typeof GroupSchema>
export type Config = z.infer<typeof ConfigSchema>
```

**Write test first**, then implement.

- [x] Tests written + failing
- [x] Code written + tests passing
- [x] Done

---

## 4. Utils

### `src/utils/logger.ts`
Pino logger. In development (`LOG_LEVEL=debug`) output goes through `pino-pretty` for human-readable logs. In production it's raw JSON that Coolify captures on stdout.

```typescript
import pino from 'pino'
import { env } from '../config/env'

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.LOG_LEVEL === 'debug'
    ? { target: 'pino-pretty' }
    : undefined,
})
```

Always use child loggers with context:
```typescript
const log = logger.child({ runId: 42, url: 'https://example.com' })
log.info('visit complete')
```

- [x] Done

---

### `src/utils/userAgents.ts`
A hardcoded pool of real Chrome user agents across Windows, macOS, Linux. The `pickRandomUA()` function returns a different one each call.

```typescript
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // ... more
]

export function pickRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}
```

- [x] Done

---

## 5. Database

### `src/db/client.ts`
Knex singleton using `better-sqlite3`. The DB file path comes from `env.DB_PATH`.

```typescript
import knex from 'knex'
import { env } from '../config/env'

export const db = knex({
  client: 'better-sqlite3',
  connection: { filename: env.DB_PATH },
  useNullAsDefault: true,
})
```

### Migrations

**`src/db/migrations/001_create_runs.ts`:**
```typescript
export async function up(knex) {
  await knex.schema.createTable('runs', (t) => {
    t.increments('id')
    t.string('group_name').notNullable()
    t.datetime('started_at').notNullable()
    t.datetime('ended_at')
    t.string('status').notNullable()   // running | completed | partial_failure | failed
    t.integer('total_urls')
    t.integer('success_count')
    t.integer('failure_count')
  })
}
```

**`src/db/migrations/002_create_visits.ts`:**
```typescript
export async function up(knex) {
  await knex.schema.createTable('visits', (t) => {
    t.increments('id')
    t.integer('run_id').references('id').inTable('runs').notNullable()
    t.string('url').notNullable()
    t.integer('status_code')
    t.string('final_url')
    t.integer('ttfb_ms')
    t.integer('load_time_ms')
    t.boolean('consent_found')
    t.string('consent_strategy')
    t.text('error')
    t.datetime('visited_at').notNullable()
  })
}
```

Run migrations at startup:
```typescript
await db.migrate.latest({ directory: './src/db/migrations' })
```

Use in-memory SQLite for tests:
```typescript
const testDb = knex({ client: 'better-sqlite3', connection: ':memory:', useNullAsDefault: true })
```

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

## 6. Browser layer

### `src/browser/connection.ts`
Connects to Browserless using Playwright's native WebSocket protocol. Keeps a singleton `Browser` and reconnects automatically if it drops.

```typescript
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { env } from '../config/env'

chromium.use(StealthPlugin())

const wsEndpoint = `${env.BROWSERLESS_WS_URL}?token=${env.BROWSERLESS_TOKEN}`

let browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser
  browser = await chromium.connect(wsEndpoint)
  return browser
}
```

**Important**: Reconnect with exponential backoff (try after 1s, 2s, 4s, 8s, 16s — then give up). On `SIGTERM` / `SIGINT` call `browser.close()`.

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

### `src/browser/context.ts`
Creates a fresh isolated `BrowserContext` for every URL visit. This gives each visit its own cookies and storage so consent state from one visit never leaks to another.

```typescript
export async function createContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: {
      width:  1280 + Math.floor(Math.random() * 641),   // 1280–1920
      height:  768 + Math.floor(Math.random() * 313),   //  768–1080
    },
    userAgent: pickRandomUA(),
    locale: pickRandom(['en-US', 'en-GB', 'nl-NL']),
    timezoneId: 'Europe/Amsterdam',
    extraHTTPHeaders: {
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
    },
  })
}
```

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

### `src/browser/stealth.ts`
Three functions that simulate a human after page load. Call them in order inside `visitor.ts`.

**Mouse movement** — moves the cursor along a Bezier curve across the viewport:
```typescript
export async function simulateMouseMovement(page: Page): Promise<void>
// moves in ~1-3px increments with 5-15ms between each step
```

**Scroll** — scrolls down in increments with pauses:
```typescript
export async function simulateScroll(page: Page): Promise<void>
// 100-300px per step, 200-800ms pause between steps
```

**Reading dwell** — waits a random amount of time to simulate reading:
```typescript
export async function simulateReading(page: Page): Promise<void>
// waits 3000-8000ms
```

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

### `src/browser/cookieConsent.ts`
The most important module for cache warming — the page only gets cached in its "accepted" state if the consent banner is actually dismissed.

Tries these strategies in order (3s timeout per attempt):

| # | Strategy | Selector |
|---|----------|----------|
| 1 | Cookiebot | `#CybotCookiebotDialogBodyButtonAccept` |
| 2 | OneTrust | `#onetrust-accept-btn-handler` |
| 3 | TrustArc | `#truste-consent-button` |
| 4 | Generic text | buttons matching `/^(accept\|akkoord\|accepteer\|agree\|allow all\|toestaan)/i` |
| 5 | Shadow DOM | pierce shadow root to find accept button |
| 6 | iframe | switch to `iframe[src*=consent]` and apply matching inside |

After clicking, always wait 500–1000ms before proceeding — CMPs fire an XHR after accept.

Return type:
```typescript
type ConsentResult = {
  found: boolean
  strategy: string | null
  durationMs: number
}
```

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

## 7. Warmer

### `src/warmer/visitor.ts`
Orchestrates a single URL visit end-to-end. Returns a `VisitResult` — never throws.

```typescript
export type VisitResult = {
  url: string
  finalUrl: string
  statusCode: number | null
  ttfbMs: number | null
  loadTimeMs: number
  consentFound: boolean
  consentStrategy: string | null
  error: string | null
  visitedAt: Date
}
```

Visit flow:
1. `createContext()` → `context.newPage()`
2. Attach response listener to capture TTFB
3. `page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })`
4. `waitForSelector` if configured
5. `dismissCookieConsent(page)`
6. `simulateMouseMovement(page)`
7. `simulateScroll(page)` if `scrollToBottom: true`
8. `simulateReading(page)`
9. `context.close()` — always in `finally`

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

### `src/warmer/runner.ts`
Runs all URLs in a group, writes results to the DB, handles partial failures.

```typescript
export async function runGroup(group: WarmGroup): Promise<number> // returns runId
```

Flow:
1. Insert `Run` record with `status: 'running'`
2. For each URL: call `visitor.ts`, wait `randomDelay(BETWEEN_URLS_MIN_MS, BETWEEN_URLS_MAX_MS)`
3. Insert all `VisitResult` rows into `visits` table
4. Update `Run` record: set `ended_at`, set status to:
   - `completed` — all visits succeeded
   - `partial_failure` — some visits failed
   - `failed` — all visits failed

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

## 8. Scheduler

### `src/scheduler/index.ts`
Registers one cron job per URL group from `config.yaml`. When `config.yaml` changes (via chokidar), all existing jobs are destroyed and re-registered with the new config.

```typescript
import cron from 'node-cron'

const jobs: cron.ScheduledTask[] = []

export function registerJobs(groups: WarmGroup[]): void {
  jobs.forEach(j => j.destroy())
  jobs.length = 0

  for (const group of groups) {
    const job = cron.schedule(group.schedule, () => runGroup(group), {
      timezone: env.TIMEZONE,
    })
    jobs.push(job)
  }
}
```

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

## 9. API

### `src/api/server.ts`
Fastify instance. All routes except `/health` live inside a scoped plugin that applies the API key check as a `preHandler` hook.

```typescript
// Auth hook (applied to all protected routes)
protectedRoutes.addHook('preHandler', async (request, reply) => {
  const key = request.headers['x-api-key']
  if (!key || !timingSafeEqual(Buffer.from(key), Buffer.from(env.API_KEY))) {
    reply.code(401).send({ error: 'Unauthorized' })
  }
})
```

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

### Routes

**`GET /health`** — no auth, used by Coolify:
```json
{ "status": "ok", "uptime": 123.4 }
```
- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

**`GET /runs?limit=20&offset=0`** — paginated run history
**`GET /runs/latest`** — one run per group, most recent
**`GET /runs/:id`** — run + all its visit records
- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

**`POST /trigger`** — trigger a group run manually:
```json
// request body
{ "group": "homepage" }
// response
{ "runId": 42 }
```
- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

**`POST /webhook/warm`** — same as trigger but also accepts `"all"` to warm every group:
```json
// request
{ "group": "all" }
// response
{ "runIds": [42, 43], "queued": true }
```
Responds immediately — warming runs in the background.

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

**`GET /config`** — returns the current parsed URL config:
```json
{ "groups": [{ "name": "homepage", "schedule": "*/15 * * * *", "urls": [...] }] }
```
- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

## 10. Entry point

### `src/index.ts`
Boots everything in the correct order:

```typescript
async function main() {
  // 1. validate config
  const config = loadConfig(env.CONFIG_PATH)

  // 2. run DB migrations (must happen before anything else)
  await db.migrate.latest(...)

  // 3. start API server
  await server.listen({ port: env.PORT, host: '0.0.0.0' })

  // 4. register cron jobs
  registerJobs(config.groups)

  // 5. watch config.yaml for changes
  watchConfig(env.CONFIG_PATH, (newConfig) => {
    registerJobs(newConfig.groups)
  })

  // 6. graceful shutdown
  process.on('SIGTERM', async () => {
    await server.close()
    await disconnect()
    process.exit(0)
  })
}

main()
```

- [ ] Tests written + failing
- [ ] Code written + tests passing
- [ ] Done

---

## 11. Deploy to Coolify

1. Push code to your Git repo
2. In Coolify: create a new service → Docker from Git
3. Set all env vars (copy from `.env.example`)
4. Add a persistent volume: `/app/data`
5. Add a config file resource: `config.yaml` → mounted at `/app/config/config.yaml`
6. Set health check: `GET http://localhost:3000/health`
7. Make sure the cache-warmer service is on the same internal Coolify network as Browserless

**Smoke test after deploy:**
```bash
# health check
curl https://your-warmer.domain/health

# trigger a warm run
curl -X POST https://your-warmer.domain/webhook/warm \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{ "group": "homepage" }'

# check the result
curl https://your-warmer.domain/runs/latest \
  -H "X-API-Key: your-api-key"
```

- [ ] Done
