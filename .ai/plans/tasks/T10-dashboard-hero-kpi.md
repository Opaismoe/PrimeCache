# T10 — Dashboard: Hero Callout + KPI Row

**Wave:** 2 (parallel with T11, T12; depends on T08+T09)
**Status:** todo

## Goal

Add a hero callout section and 4-KPI row at the top of the dashboard, above the project cards.

## Design

```
┌──────────────────────────────────────────────────────────────┐
│ Overview · last 30 days                                       │
│                                                               │
│ Keeping six sites warm.                                      │
│ 47 URLs across 3 projects · 99.8% uptime · avg load 425ms.  │
│ All origins healthy.                                          │
│                                   [Sync config] [Warm all ▶] │
└──────────────────────────────────────────────────────────────┘

[ Uptime · 30d ]  [ Avg load ]  [ Total URLs ]  [ Failed · 24h ]
  99.8%              425ms         47              0
  ↑ +0.1            ↓ −12ms                       ↑ −2
  sparkline          sparkline
```

## Data Sources (all existing)

- Group count: `config.groups.length`
- Total URLs: `config.groups.reduce((s, g) => s + g.urls.length, 0)`
- Uptime %: avg across `publicStatus[].uptimePct`
- Avg load: avg across `latestRuns[].success_count` / total — or from `stats`
- Failed count: sum of `latestRuns[].failure_count`
- "All origins healthy" / "N URLs failing": from `latestRuns`

## KPI tiles (simplified — no sparklines, no delta since data not available)

4 tiles in a grid:
1. Uptime · 30d — avg `uptimePct` across all groups from `publicStatus`
2. Total URLs — from config
3. Avg load — avg `latestRuns[].success_count`... actually avg load not in latestRuns. Use `stats.visitsByDay` count or skip this. Best option: show success rate from latestRuns.
4. Failing · 24h — sum `latestRuns[].failure_count ?? 0`

Actually simplified to:
1. Groups — `config.groups.length`
2. Total URLs — config total
3. Uptime · 30d — avg `publicStatus[].uptimePct`
4. Failing — sum `latestRuns[].failure_count`

## Files to Modify

- `frontend/src/routes/index.tsx` — add `HeroCallout` and `KpiRow` sections above project cards

## Definition of Done

- Hero callout shows dynamic text with group count, URL count, uptime, failure summary
- 4 KPI tiles render with real data
- "Warm all" button triggers all groups
- No TypeScript errors
