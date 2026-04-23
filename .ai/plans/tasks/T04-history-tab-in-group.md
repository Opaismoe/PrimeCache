# T04 — Add History Tab to Group Detail Page

**Wave:** 2 (parallel with T05, T06)
**Status:** todo

## Goal

Add a "History" tab to the group detail page (`/groups/:name`). This tab shows the paginated run history scoped to the current group — reusing the existing history table UI and data that already exists on `/history`.

## Context

- Group detail page: `frontend/src/routes/groups_.$groupName.tsx`
- Existing tabs: Overview, Performance, Uptime, SEO, Links, CWV
- Existing history page: `frontend/src/routes/history.tsx`
- Existing API: `GET /api/runs?group=<name>&limit=20&offset=0`
  - Already supports group filter
- Existing API: `GET /api/runs/:id` for run detail
- `getRuns()` fetch helper is already in `frontend/src/lib/api.ts`

## Files to Modify

- `frontend/src/routes/groups_.$groupName.tsx`
  - Add `"history"` to the tab list
  - Add a `HistoryTab` section (inline or extracted component)
  - The tab renders a paginated table of runs for this group
  - Columns: Run #, Started, Duration, Status, URLs (success/failure)
  - Clicking a row navigates to `/history/:runId`
  - Pagination: prev/next buttons, show current page

## Data Fetching

```typescript
// Inside the History tab, when tab === 'history':
const { data } = useQuery({
  queryKey: queryKeys.runs({ group: groupName, limit: 20, offset: page * 20 }),
  queryFn: () => getRuns({ group: groupName, limit: 20, offset: page * 20 }),
})
```

Use `useQuery` (already imported). Keep pagination state in `useState`.

## Steps

1. Read `frontend/src/routes/groups_.$groupName.tsx` — understand tab switching pattern
2. Read `frontend/src/routes/history.tsx` — copy the table structure
3. Add `"history"` tab trigger to the `<TabsList>`
4. Add `<TabsContent value="history">` with the runs table
5. Wire up `getRuns({ group: groupName })` query
6. Add pagination controls (reuse the same pattern from `history.tsx`)
7. Rows link to `/history/$runId` using TanStack Router `<Link>`
8. Run `pnpm typecheck` — must pass

## Definition of Done

- Group detail page has a "History" tab
- Tab shows paginated run list scoped to the group
- Clicking a row navigates to the run detail page
- Pagination works (next/prev)
- No TypeScript errors
- Commit: `feat(ui): add History tab to group detail page`
