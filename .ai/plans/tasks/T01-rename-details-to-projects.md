# T01 — Rename "Details" → "Projects" in Navigation

**Wave:** 1 (parallel with T02, T03)
**Status:** todo

## Goal

Rename the nav dropdown label from "Details" to "Projects" everywhere it appears. This is a pure text/label change — no routing or data changes needed.

## Files to Modify

- `frontend/src/routes/__root.tsx`
  - Find the nav item label "Details" (the dropdown trigger)
  - Rename to "Projects"
  - The dropdown still lists groups by name linking to `/groups/:name`

## Steps

1. Read `frontend/src/routes/__root.tsx`
2. Find all occurrences of the string `"Details"` used as a nav label
3. Replace with `"Projects"`
4. Verify no other nav-related files reference the label (grep for "Details" in `frontend/src/`)
5. Run `pnpm typecheck` — must pass

## Definition of Done

- Nav bar shows "Projects" as the dropdown label
- All group links inside the dropdown still work
- No TypeScript errors
- Commit: `feat(ui): rename nav Details to Projects`
