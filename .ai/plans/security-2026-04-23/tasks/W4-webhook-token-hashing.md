# W4 — Webhook token hash-at-rest + header delivery

**Wave:** D (after W5 lands to avoid clashing with auth work; includes a DB migration)
**Model:** `claude-sonnet-4-6` — DB migration + query rewrite + route change; no architectural unknowns.
**Findings:** F4 (Medium), F12 (Low)
**Status:** todo

## Goal

Store only a hash of each webhook token in the DB, and accept the token via an `Authorization: Bearer` / `X-Webhook-Token` header instead of the URL path so it stops appearing in reverse-proxy and browser logs.

## Problem

`webhook_tokens.token` is the raw secret; a DB dump yields immediately usable credentials. The public route `POST /webhook/trigger/:token` places the secret in the URL path where Coolify/Cloudflare/Nginx logs and browser referrers capture it.

## Changes

### DB migration (`backend/db/migrations/NNNN_webhook_token_hash.sql`)

- Add column `token_hash text` with unique index.
- Backfill: `UPDATE webhook_tokens SET token_hash = encode(sha256(token::bytea), 'hex')` (Postgres `sha256` via pgcrypto — verify it's enabled; otherwise do the backfill from the app at boot once).
- Drop the plaintext `token` column in a follow-up migration only after the rollout is confirmed; this migration keeps both columns for one release.
- Corresponding Drizzle schema update in `backend/db/schema.ts`.

### `backend/db/queries/webhookTokens.ts`

- `createWebhookToken` generates token, hashes with `createHash('sha256').update(token).digest('hex')`, stores hash, returns plaintext once.
- `findWebhookToken(db, token)` hashes the incoming value and looks up by `token_hash`.
- `WebhookTokenRow` publicly exposed type: omit `token` entirely; return only `id`, `group_name`, `description`, `active`, timestamps.

### `backend/api/routes/webhooks.ts`

- Replace `POST /webhook/trigger/:token` with `POST /webhook/trigger` that reads the token from one of:
  - `Authorization: Bearer <token>`
  - `X-Webhook-Token: <token>` (fallback)
- Keep the path variant for one release behind a deprecation log warning, to give existing integrations a window.
- On match, behavior unchanged (`startRunGroup`, `touchWebhookToken`).

### Frontend (`frontend/src/lib/api.ts` + admin UI)

- If any frontend code shows the trigger URL for copying, update the shown example to header form. (Check `AdminWebhooks` / `api-reference` components.)

## Definition of Done

- Fresh install: DB never contains plaintext tokens; only `token_hash`.
- Both calling conventions work during the transition; the path variant emits a warn log.
- Audit log field `tokenId` still present (`webhook_tokens.id`) — never log the plaintext.
- `backend/api/routes/webhooks.test.ts` covers: header accepted, path deprecated-but-working, header-missing returns 401, tampered token returns 404.
- `pnpm test && pnpm typecheck && pnpm lint` all pass.

## Rollback

- Drop the new column, revert queries, revert route. Plaintext `token` column still intact during the transition release.
