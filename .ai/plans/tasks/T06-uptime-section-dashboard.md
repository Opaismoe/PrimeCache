# T06 — Dashboard: Add Uptime Status Section

**Wave:** 2 (parallel with T04, T05)
**Status:** todo

## Goal

Embed a compact uptime status section on the main dashboard (`/`), showing the current uptime health for each group. This replaces the need to navigate to `/status` just to see uptime — it's now visible at a glance from the home page.

## Context

- Dashboard: `frontend/src/routes/index.tsx`
- Existing public status page: `frontend/src/routes/status.tsx` — this is the source of truth for the UI pattern
- Existing API: `GET /api/public/status` (no auth required)
  - Returns: `{ groups: { name: string, uptime: number, urlCount: number, lastStatus: string | null, lastRun: string | null }[] }`
- `getPublicStatus()` fetch helper: check `frontend/src/lib/api.ts` — add if missing

## Design

The section appears on the dashboard **below the group cards**, **above the charts** (or at the bottom — agent decides based on visual balance).

Layout:
```
[ Uptime Status ]
┌─────────────────────────────────────────────┐
│  ● blog       99.8%  ████████████████████  │  ← clickable row
│  ● shop       97.2%  ████████████████░░░░  │  ← clickable row
│  ● api        100%   ████████████████████  │  ← clickable row
└─────────────────────────────────────────────┘
```

Each row shows:
- Status dot (green ≥99%, yellow 95–99%, red <95%)
- Group name
- Uptime percentage
- A colored progress/fill bar representing the uptime %

The **entire section** (or each row) is clickable → navigates to `/status` (the full uptime details page). See T07 for the click behavior.

## Health Color Logic (reuse from `status.tsx`)

```typescript
function uptimeColor(pct: number) {
  if (pct >= 99) return 'text-green-500'
  if (pct >= 95) return 'text-amber-500'
  return 'text-red-500'
}
```

## Files to Modify

- `frontend/src/routes/index.tsx`
  - Add `useQuery` for `getPublicStatus()`
  - Add `UptimeSection` block (inline JSX or extracted component)
  - Render per-group uptime row with dot, name, %, fill bar
- `frontend/src/lib/api.ts`
  - Add `getPublicStatus()` if not already present (check first)

## Steps

1. Read `frontend/src/routes/status.tsx` — copy health color logic and row layout
2. Read `frontend/src/lib/api.ts` — check if `getPublicStatus()` exists; add if not
3. Read `frontend/src/routes/index.tsx` — find the right place to insert the section
4. Add the uptime query and render the section
5. Style with Tailwind: card container, row layout, fill bar using `w-[{pct}%]` or a thin `<progress>` element
6. Run `pnpm typecheck` — must pass

## Definition of Done

- Dashboard shows an "Uptime Status" section with per-group rows
- Each row shows: status dot, group name, uptime %, fill bar
- Colors reflect health (green/yellow/red)
- No TypeScript errors
- Commit: `feat(ui): add uptime status section to dashboard`

> Note: Click behavior is implemented in T07 (next wave).
