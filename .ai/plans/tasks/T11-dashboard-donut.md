# T11 — Dashboard: Donut Chart for Run Outcomes

**Wave:** 2 (parallel with T10, T12; depends on T08+T09)
**Status:** todo

## Goal

Replace the vertical bar chart for "Run status breakdown" with a donut chart + legend rows (label, count, %). Matches the design's "Run outcomes · last 500" panel.

## Design

```
┌─────────────────────────────────────┐
│ Run outcomes · last N               │
│                                     │
│  [  donut  ]  ● Completed  458  91% │
│               ● Partial     32   6% │
│               ● Failed      10   2% │
│                                     │
│ Mean duration · 52s · p95 91s       │
└─────────────────────────────────────┘
```

## Implementation

Use `PieChart` + `Pie` from recharts with `innerRadius` for donut effect.

Data: `stats.statusCounts` (already available, keyed by status string).

Legend rows: for each status show colored square, label, count, percentage.

## Files to Modify

- `frontend/src/routes/index.tsx`
  - Import `PieChart`, `Pie`, `Cell` from recharts (in addition to existing)
  - Replace the `<BarChart>` for run status with `<PieChart>` donut

## Colors

Reuse `STATUS_COLORS` map already in the file.

## Definition of Done

- Donut chart renders with correct colors and proportions
- Legend rows show label, count, and pct
- Tooltip shows on hover
- No TypeScript errors
