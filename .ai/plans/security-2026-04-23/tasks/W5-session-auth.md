# W5 — Session auth: replace `API_KEY`-as-session with signed sessions

**Wave:** C (architectural; serialize — do not run parallel to W1/W3 which also touch `server.ts`)
**Model:** `claude-opus-4-7` — cross-cutting design choice (token shape, cookie vs header, revocation model, migration path for existing clients). Requires backend + frontend + DB coordination.
**Findings:** F8 (Medium), F9 (Low)
**Status:** done

## Goal

Stop handing out `env.API_KEY` as a user-session token. Issue short-lived per-session credentials with server-side revocation. Keep `API_KEY` as a machine-only credential for CI / webhooks / `curl` usage.

## Problem

`POST /api/auth/login` returns `env.API_KEY` verbatim (`backend/api/server.ts:83`). The SPA stores it in `localStorage`. Consequences:

- No expiry — a leaked token is valid forever until the environment is rotated and the service restarted.
- No revocation per user/session.
- XSS (or a compromised browser extension, a shared machine, F2-style log leakage) permanently owns the server.

## Design decisions to make (Opus should weigh these and pick one in the first PR description)

1. **Token shape:** signed JWT (stateless) vs opaque session id backed by a DB row.
   - Prefer opaque session rows: trivial revocation, no key-management overhead, no algorithm-confusion pitfalls. JWT only wins if we need multiple verifiers, which we don't.
2. **Delivery:** `HttpOnly; Secure; SameSite=Strict` cookie vs continuing with `X-API-Key` header.
   - Cookies neutralize XSS exfiltration but require CSRF defense (double-submit token or `SameSite=Strict` + state-changing routes accept POST/PUT/DELETE only).
   - If keeping header + `localStorage`, at least shorten lifetime and enable revocation — lower win, less churn.
3. **Dual credentials model:** keep `env.API_KEY` as an alternative auth path for CI/machines; `requireApiKey` accepts either a valid session cookie OR `X-API-Key: <API_KEY>`. Dashboard login only ever issues sessions, never echoes `API_KEY`.

Recommended default: **opaque session cookie**, `SameSite=Strict`, 12h idle expiry, explicit `POST /api/auth/logout` that deletes the row.

## Changes (assuming the recommended default)

### DB migration

- New table `sessions`:
  ```sql
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,             -- randomBytes(32).toString('hex')
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
  ```

### Backend

- `backend/api/routes/auth.ts` (new): `POST /login`, `POST /logout`, `GET /me`.
- `requireApiKey` becomes `requireAuth`:
  - Accept `X-API-Key: <env.API_KEY>` (machine path) → pass.
  - Else read session cookie → look up row, check `expires_at > now()`, bump `last_used_at` → pass.
  - Else 401.
- Login endpoint: verify admin creds (existing `timingSafeEqual` logic — coordinate with W8), create session row, set `Set-Cookie: pc_session=<id>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`.
- CSRF: require all non-GET protected routes to carry either `X-API-Key` or a double-submit token header. Opus should pick the exact mechanism — a `csrf_token` second cookie mirrored in a header is simplest.
- Periodic sweep job to delete expired sessions (cron job, every hour).

### Frontend

- Remove `getApiKey()`/`saveApiKey()` usages from the session-login path. Login returns `{ ok: true }`; cookie is set by the server.
- Keep an "Use raw API key" developer affordance for users who want machine-style auth — that path still writes to `localStorage` but is clearly labeled as dev-only.
- CSRF helper in `frontend/src/lib/api.ts`: read the `csrf_token` cookie, mirror into `X-CSRF-Token` on every non-GET.

## Definition of Done

- Login no longer returns `env.API_KEY`.
- Logout invalidates the server-side session.
- Protected routes accept either the session cookie (with CSRF) or `X-API-Key`.
- Existing CI / webhook integrations that use `X-API-Key: <env.API_KEY>` still work — regression-test this explicitly.
- New `backend/api/auth.test.ts`: login→cookie set, logout→invalidated, expired session rejected, CSRF missing on POST rejected.
- SPA: F9 closed for dashboard users (cookie is HttpOnly).
- Migration is reversible.
- `pnpm test && pnpm typecheck && pnpm lint` all pass.

## Coordination / order

- Land **before** W1, W3, W8 if feasible — those also touch `server.ts`. If W1/W3 land first, W5 rebases them.
- W4 depends on this only loosely (they both touch webhook flow but different functions).
