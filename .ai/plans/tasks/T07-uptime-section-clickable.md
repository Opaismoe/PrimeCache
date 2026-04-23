# T07 — Uptime Section: Make Rows Clickable → Status Details Page

**Wave:** 3 (depends on T06 being complete)
**Status:** todo

## Goal

Make the uptime status section on the dashboard (added in T06) interactive. Clicking any row (or the entire section header) navigates to `/status` — the existing public uptime details page — where the user can see per-run history and uptime breakdowns.

## Context

- Dashboard uptime section added in T06: `frontend/src/routes/index.tsx`
- Target destination: `/status` (`frontend/src/routes/status.tsx`)
- Navigation: TanStack Router `<Link to="/status">` or `useNavigate()`

## Design

Two levels of clickability:

1. **Section header / title**: "Uptime Status →" — clicking navigates to `/status`
2. **Each row**: the entire row is a `<Link to="/status">` so it's fully clickable

Use a subtle hover state (`hover:bg-muted/50 cursor-pointer`) on rows to signal clickability.

Add a small arrow icon (→ or `ChevronRight` from lucide-react) on the section header or each row to visually hint that it's a link.

## Files to Modify

- `frontend/src/routes/index.tsx`
  - Wrap the section title in a `<Link to="/status">` or add a "View details →" link next to the title
  - Wrap each row `<div>` in `<Link to="/status" className="...hover styles...">`

## Steps

1. Read `frontend/src/routes/index.tsx` — find the uptime section added in T06
2. Wrap each row with `<Link to="/status">` from `@tanstack/react-router`
3. Add hover styles: `hover:bg-muted/50 rounded-md transition-colors cursor-pointer`
4. Add `<ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />` to each row end
5. Add "View all →" link next to the section heading
6. Run `pnpm typecheck` — must pass

## Definition of Done

- Clicking any uptime row navigates to `/status`
- Rows have a visible hover state
- A "View all →" or "→" indicator is present near the heading
- No TypeScript errors
- Commit: `feat(ui): make dashboard uptime rows link to status details page`
