# T14 — Admin: Webhooks Section

**Wave:** 3 (parallel with T13, T15, T16; depends on T08)
**Status:** todo

## Goal

Add a "Webhooks" section to the admin page (at `/admin?section=webhooks`) showing all webhook tokens across all groups in a unified view with per-group manage controls.

## Design

```
Admin · Webhooks
Inbound webhooks
POST to per-group URLs to trigger a warming run.

[ Webhooks defined: N ]  [ Triggers · 24h: — ]

Configured endpoints
────────────────────────────────────────────────
● active  blog     https://pc.../hook/blog/...   48 runs  2h ago  [copy] [delete]
● idle    shop     https://pc.../hook/shop/...    0 runs  never   [copy] [delete]
```

## Data

- `GET /api/groups/:name/webhooks` per group (already exists)
- Need to fetch webhooks for all groups and flatten into one list
- Use `config.groups` to know which groups exist, then `useQueries` to fetch each group's webhooks
- Or: add a single `GET /api/webhooks` endpoint — but that requires backend work. Use `useQueries` instead.

## Files to Modify

- `frontend/src/routes/admin.tsx` — add `section` search param validation and routing
- Add `AdminWebhooks` component (inline or in new file)
- `frontend/src/lib/api.ts` — ensure `getGroupWebhooks`, `createWebhookToken`, `deleteWebhookToken` exist

## Definition of Done

- `/admin?section=webhooks` shows all groups' webhook tokens
- Can copy URL, delete tokens, create new tokens
- No TypeScript errors
