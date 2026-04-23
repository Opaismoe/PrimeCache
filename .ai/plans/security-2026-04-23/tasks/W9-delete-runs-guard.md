# W9 — Require explicit confirm on unqualified `DELETE /runs`

**Wave:** B (touches `server.ts`)
**Model:** `claude-haiku-4-5-20251001` — small, localized change.
**Findings:** F20 (Info)
**Status:** done

## Goal

Prevent a single authenticated call from wiping all run history. Authenticated API-key holders should still be able to delete scoped data freely.

## Problem

`DELETE /api/runs` with no query string deletes every row in the `runs` table. No confirmation, no scope, no undo.

## Changes

### `backend/api/server.ts`

```ts
protected_.delete<{ Querystring: { group?: string; confirm?: string } }>('/runs', async (request, reply) => {
  const { group, confirm } = request.query;
  if (!group && confirm !== 'true') {
    return reply.code(400).send({
      error: 'Refusing to delete all runs without confirm=true or a group filter',
    });
  }
  const deleted = await deleteRuns(db, group ? { group } : undefined);
  return { deleted };
});
```

### Frontend

- If the admin UI surfaces a "Clear all history" button, make it pass `?confirm=true` and show a confirmation dialog. Check `frontend/src/routes/admin.tsx` for the existing `deleteRuns` call; adjust `frontend/src/lib/api.ts` if the signature changes.

## Definition of Done

- `DELETE /api/runs` with no query → 400.
- `DELETE /api/runs?confirm=true` → deletes all.
- `DELETE /api/runs?group=foo` → deletes only `foo`, unchanged.
- New vitest case covers the 400 path.
- Frontend "Clear all history" still works (now with explicit confirm flag).
- `pnpm test && pnpm typecheck && pnpm lint` all pass.
