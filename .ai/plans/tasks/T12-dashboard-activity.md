# T12 — Dashboard: Recent Activity Feed

**Wave:** 2 (parallel with T10, T11; depends on T08+T09)
**Status:** todo

## Goal

Add a "Recent activity" section at the bottom of the dashboard showing the last N runs across all groups as a timeline feed.

## Design

```
Recent activity                                         All events →
┌─────────────────────────────────────────────────────────────────┐
│ 11:08  ● ok    cron     Think     warmed 48 URLs · avg 497ms   │
│ 10:07  ● ok    cron     Think     warmed 48 URLs · all 200s    │
│ 09:00  ● warn  webhook  Newvi     1 URL failed (502)           │
│ 08:00  ● ok    cron     Terral…   warmed 14 URLs               │
└─────────────────────────────────────────────────────────────────┘
```

## Data

Use `latestRuns` (already fetched) — shows one row per group. Each row shows:
- Time (from `started_at`)
- Status badge (completed/partial/failed)
- Group name
- Summary: "warmed N URLs · N failed" from `success_count` / `failure_count`

No new API calls needed. `latestRuns` has one entry per group.

## Files to Modify

- `frontend/src/routes/index.tsx` — add `ActivityFeed` section at bottom, after the charts

## Definition of Done

- Activity feed shows recent runs
- Rows link to `/history/$runId`
- "All events →" links to `/history`
- No TypeScript errors
