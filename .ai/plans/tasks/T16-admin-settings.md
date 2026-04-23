# T16 — Admin: Settings Section

**Wave:** 3 (parallel with T13, T14, T15; depends on T08)
**Status:** todo

## Goal

Add a "Settings" section at `/admin?section=settings` with collapsible sections for global instance configuration display.

## Design

Collapsible sections (all read-only / informational, matching env vars):
1. **Browserless & runtime** — endpoint URL, token (masked), navigation timeout
2. **Human simulation** — toggle display for stealth, scroll, mouse sim (read from config)
3. **Cookie consent banners** — show which strategies are enabled (static / always on)
4. **Storage & retention** — DB URL (masked), config path
5. **Danger zone** — "Clear all history" button (wires to existing `deleteRuns()`)

## Notes

- This is mostly a display page for env-level config since those values come from the backend env
- The danger zone "Clear all history" can reuse the existing `deleteMutation` from the current admin page
- Active Runs section (from current admin.tsx) moves here

## Files to Modify

- `frontend/src/routes/admin.tsx` — add `AdminSettings` component for `section=settings`
- The current admin page (groups management + delete history) becomes the default `section=groups`

## Definition of Done

- `/admin?section=settings` shows collapsible settings
- Danger zone "Clear all history" is functional
- Active runs display is visible
- No TypeScript errors
