# T15 — Admin: API Reference Section

**Wave:** 3 (parallel with T13, T14, T16; depends on T08)
**Status:** todo

## Goal

Add an "API" section at `/admin?section=api` showing the REST API endpoint reference, a curl quick-example, and the current API key management.

## Design

```
Admin · API
API & access

Endpoints (v1)
GET  /api/runs            List recent runs
GET  /api/runs/:id        Run detail
POST /api/trigger         Trigger run (sync)
...

Quick example
curl -X POST https://.../api/trigger \
  -H "X-API-Key: $API_KEY" \
  -d '{"group":"blog"}'

API Key
[•••••••••••••••] [Copy] [Change]
```

## Data

- Endpoint list: hardcoded from the CLAUDE.md API table
- API key: read from `getApiKey()` (stored in localStorage, never shows full value)
- curl example: static

## Files to Modify

- `frontend/src/routes/admin.tsx` — add `AdminAPI` component for `section=api`

## Definition of Done

- `/admin?section=api` shows endpoint reference table and curl example
- Copy API key button works
- No TypeScript errors
