# T08 — Sidebar Navigation

**Wave:** 1 (parallel with T09)
**Status:** in_progress

## Goal

Replace the horizontal top navigation bar with a vertical left sidebar. This is a structural layout change that affects the root layout in `__root.tsx`. All other wave-3 tasks depend on this being complete.

## Design

```
┌─────────────────────────────────────────────────────┐
│ ▪ PrimeCache            (sidebar, 232px wide)        │
│   v2 · self-hosted                                   │
├─────────────────────────────────────────────────────┤
│ WORKSPACE                                            │
│   Dashboard       (→ /)                             │
│   Projects        (→ /groups)                       │
│   History         (→ /history)                      │
│   Status          (→ /status)                       │
│                                                      │
│ ADMIN                                                │
│   Groups          (→ /admin)                        │
│   Webhooks        (→ /admin?section=webhooks)       │
│   API             (→ /admin?section=api)            │
│   Settings        (→ /admin?section=settings)       │
├─────────────────────────────────────────────────────┤
│ [A] Admin · Theme toggle                            │
└─────────────────────────────────────────────────────┘
```

## Layout change

Old: `flex-col` (topnav + content below)
New: `flex-row` (sidebar 232px + `flex-1` content area)

The main content area loses the `max-w-7xl mx-auto` wrapper (or keeps it within the flex-1 area).

## Files to Modify

- `frontend/src/routes/__root.tsx` — replace `<nav>` with `<Sidebar>`, change layout to `flex min-h-screen`

## Sidebar component (inline in __root.tsx)

Nav groups:
- **Workspace**: Dashboard (→ /), Projects (→ /groups), History (→ /history), Status (→ /status)
- **Admin** (only shown when loggedIn): Groups (→ /admin), Webhooks (→ /admin?section=webhooks), API (→ /admin?section=api), Settings (→ /admin?section=settings)

Footer:
- Theme toggle button (Sun/Moon)
- "Admin" label (no real user profile available)

Active state: use TanStack Router `<Link activeProps={{ className: 'bg-muted text-foreground' }}>`

## Notes

- When `shouldShowModal` (not logged in), still show the sidebar shell but with only the Status nav item visible
- On the status page, show the full sidebar (it's public)
- No mobile drawer needed — desktop-first

## Definition of Done

- Left sidebar visible on all pages
- Nav items route correctly
- Active item highlighted
- Theme toggle works
- No TypeScript errors
