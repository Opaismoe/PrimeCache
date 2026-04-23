# PrimeCache — Roadmap Plan

## Overview

PrimeCache is evolving from a cache warmer into a multi-tool web monitoring platform. This plan captures all UI/UX and structural changes.

---

## Wave 1–2 (completed — commit c1cc014)

| Task | Change | Status |
|------|--------|--------|
| T01 | Rename nav "Details" → "Projects" | ✅ done |
| T02 | Dashboard: run status chart → bar/column | ✅ done |
| T03 | Dashboard: URLs per day chart → bar/column | ✅ done |
| T04 | History tab in group detail | ✅ done |
| T05 | Config/Settings tab in group detail | ✅ done |
| T06 | Dashboard: embed uptime status section | ✅ done |
| T07 | Uptime status section → clickable → /status | ✅ done |

---

## Wave 3 (current — branch feature/redesign-wave-3)

Bold new visual direction based on design handoff. Linear/Vercel-grade developer tool aesthetic.

### Execution Waves

```
Wave 1 — Foundation (T08 + T09 parallel, T08 must finish before Wave 2 starts)
  T08 — Sidebar navigation (replaces top nav, structural layout change)
  T09 — JetBrains Mono font + CSS design tokens

Wave 2 — Dashboard redesign (depends on T08+T09, tasks parallel)
  T10 — Dashboard: hero callout + 4-KPI row
  T11 — Dashboard: donut chart (replaces run status bar chart)
  T12 — Dashboard: recent activity feed

Wave 3 — Remaining screens (depends on T08, tasks parallel)
  T13 — Run detail redesign (waterfall visualization, better layout)
  T14 — Admin: Webhooks section
  T15 — Admin: API reference section
  T16 — Admin: Settings section (collapsible global config)
```

---

## Task Files

**Wave 1**
- [T08 — Sidebar navigation](tasks/T08-sidebar-navigation.md)
- [T09 — JetBrains Mono + design tokens](tasks/T09-design-tokens.md)

**Wave 2**
- [T10 — Dashboard hero callout + KPI row](tasks/T10-dashboard-hero-kpi.md)
- [T11 — Dashboard donut chart](tasks/T11-dashboard-donut.md)
- [T12 — Dashboard activity feed](tasks/T12-dashboard-activity.md)

**Wave 3**
- [T13 — Run detail redesign](tasks/T13-run-detail.md)
- [T14 — Admin Webhooks](tasks/T14-admin-webhooks.md)
- [T15 — Admin API](tasks/T15-admin-api.md)
- [T16 — Admin Settings](tasks/T16-admin-settings.md)
