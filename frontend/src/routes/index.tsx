import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RunResults } from '../components/RunResults';
import { StatusBadge } from '../components/StatusBadge';
import {
  getApiKey,
  getConfig,
  getLatestRuns,
  getPublicStatus,
  getStats,
  triggerAsync,
} from '../lib/api';
import { CHART_TOOLTIP_STYLE } from '../lib/chartStyles';
import { describeCron } from '../lib/cronUtils';
import { formatChartDate } from '../lib/formatChartDate';
import { formatDate } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';
import type { Run, Stats } from '../lib/types';

const configQueryOptions = queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig });
const latestRunsQueryOptions = queryOptions({
  queryKey: queryKeys.runs.latest(),
  queryFn: getLatestRuns,
});
const statsQueryOptions = queryOptions({ queryKey: queryKeys.stats.all(), queryFn: getStats });
const publicStatusQueryOptions = queryOptions({
  queryKey: queryKeys.publicStatus.all(),
  queryFn: getPublicStatus,
  refetchInterval: 60_000,
});

export const Route = createFileRoute('/')({
  loader: ({ context: { queryClient } }) => {
    if (!getApiKey()) return;
    return Promise.all([
      queryClient.ensureQueryData(configQueryOptions),
      queryClient.ensureQueryData(latestRunsQueryOptions),
      queryClient.ensureQueryData(statsQueryOptions),
    ]);
  },
  pendingComponent: DashboardSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
  component: DashboardPage,
});

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  partial_failure: '#f59e0b',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  partial_failure: 'Partial failure',
  failed: 'Failed',
  cancelled: 'Cancelled / failed',
};

const GROUP_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#e879f9'];

function getGroupColor(index: number) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

function buildStackedBarData(visitsByDay: Stats['visitsByDay']) {
  const groups = [...new Set(visitsByDay.map((v) => v.group))];
  const byDate = new Map<string, Record<string, number>>();
  for (const v of visitsByDay) {
    let row = byDate.get(v.date);
    if (!row) {
      row = {};
      byDate.set(v.date, row);
    }
    row[v.group] = v.count;
  }
  return {
    groups,
    data: [...byDate.entries()].map(([date, counts]) => ({ date, ...counts })),
  };
}

function DashboardSkeleton() {
  return (
    <div>
      <Skeleton className="mb-2 h-5 w-40" />
      <Skeleton className="mb-1 h-9 w-72" />
      <Skeleton className="mb-8 h-4 w-96" />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="mb-1.5 h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex flex-col gap-3">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: config } = useQuery(configQueryOptions);
  const { data: latestRuns } = useQuery(latestRunsQueryOptions);
  const { data: stats } = useQuery(statsQueryOptions);
  const { data: publicStatus } = useQuery(publicStatusQueryOptions);

  const trigger = useMutation({
    mutationFn: triggerAsync,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      navigate({ to: '/history/$runId', params: { runId: String(data.runId) } });
    },
  });

  const syncAll = () => queryClient.invalidateQueries();

  const latestByGroup = new Map<string, Run>((latestRuns ?? []).map((r) => [r.group_name, r]));

  // KPI derivations
  const groupCount = config?.groups.length ?? 0;
  const totalUrls = config?.groups.reduce((s, g) => s + g.urls.length, 0) ?? 0;
  const avgUptime =
    publicStatus && publicStatus.length > 0
      ? publicStatus.reduce((s, g) => s + g.uptimePct, 0) / publicStatus.length
      : null;
  const totalFailing = (latestRuns ?? []).reduce((s, r) => s + (r.failure_count ?? 0), 0);

  // Donut chart data
  const totalRuns = Object.values(stats?.statusCounts ?? {}).reduce((s, n) => s + n, 0);
  const donutData = Object.entries(stats?.statusCounts ?? {}).map(([status, count]) => ({
    name: STATUS_LABELS[status] ?? status,
    value: count,
    color: STATUS_COLORS[status] ?? '#6b7280',
    pct: totalRuns > 0 ? ((count / totalRuns) * 100).toFixed(1) : '0',
  }));

  const { groups: stackedGroups, data: stackedData } = buildStackedBarData(
    stats?.visitsByDay ?? [],
  );

  const heroText = buildHeroText(groupCount, totalUrls, avgUptime, totalFailing);

  return (
    <div>
      {/* ── Hero callout ─────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Overview · last 30 days
          </p>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">
            Keeping{' '}
            <span className="italic">{numberWord(groupCount)}</span>{' '}
            {groupCount === 1 ? 'site' : 'sites'} warm
            <span className="text-amber-500">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">{heroText}</p>
        </div>
        {config?.groups.length ? (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={syncAll}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Sync
            </Button>
          </div>
        ) : null}
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────── */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Projects" value={String(groupCount)} />
        <KpiTile label="Total URLs" value={String(totalUrls)} />
        <KpiTile
          label="Avg uptime · 30d"
          value={avgUptime != null ? `${avgUptime.toFixed(1)}%` : '—'}
          valueClass={
            avgUptime == null
              ? ''
              : avgUptime >= 99
                ? 'text-green-500'
                : avgUptime >= 95
                  ? 'text-amber-500'
                  : 'text-destructive'
          }
        />
        <KpiTile
          label="Failing · 24h"
          value={String(totalFailing)}
          valueClass={totalFailing > 0 ? 'text-destructive' : 'text-green-500'}
        />
      </div>

      {/* ── Project cards ─────────────────────────────────────────────── */}
      {!config?.groups.length ? (
        <p className="text-muted-foreground">
          No groups configured yet.{' '}
          <Link to="/admin" className="text-primary hover:underline">
            Add a group
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Projects</h2>
            <Link to="/groups" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              All projects <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {config.groups.map((group) => {
              const latest = latestByGroup.get(group.name);
              const isTriggering = trigger.isPending && trigger.variables === group.name;
              return (
                <Card key={group.name} className="flex flex-col gap-3">
                  <CardHeader className="pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to="/groups/$groupName"
                          params={{ groupName: group.name }}
                          search={{ tab: 'health', qtab: 'seo' }}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {group.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {describeCron(group.schedule)}
                        </p>
                      </div>
                      {latest && <StatusBadge status={latest.status} />}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 pt-0">
                    {latest ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Last run: {formatDate(latest.started_at)}</span>
                        <RunResults
                          successCount={latest.success_count}
                          failureCount={latest.failure_count}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No runs yet</p>
                    )}
                    <Button
                      onClick={() => trigger.mutate(group.name)}
                      disabled={trigger.isPending}
                      className="mt-auto"
                    >
                      {isTriggering ? 'Starting…' : 'Run now'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── Uptime section ───────────────────────────────────────────── */}
      {publicStatus && publicStatus.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Uptime Status</h2>
            <Link
              to="/status"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {publicStatus.map((g) => {
                const isHealthy = g.uptimePct >= 99;
                const isDegraded = g.uptimePct >= 95 && g.uptimePct < 99;
                return (
                  <Link
                    key={g.groupName}
                    to="/status"
                    className="flex items-center gap-3 rounded-md px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                        isHealthy ? 'bg-green-500' : isDegraded ? 'bg-yellow-500' : 'bg-destructive'
                      }`}
                    />
                    <span className="flex-1 text-sm font-medium">{g.groupName}</span>
                    <span
                      className={`font-mono text-sm font-semibold ${
                        isHealthy
                          ? 'text-green-500'
                          : isDegraded
                            ? 'text-yellow-500'
                            : 'text-destructive'
                      }`}
                    >
                      {g.uptimePct.toFixed(1)}%
                    </span>
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          isHealthy
                            ? 'bg-green-500'
                            : isDegraded
                              ? 'bg-yellow-500'
                              : 'bg-destructive'
                        }`}
                        style={{ width: `${Math.min(100, g.uptimePct)}%` }}
                      />
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────────────────── */}
      {stats && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Donut chart — run outcomes */}
          {donutData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-sm font-medium">Run outcomes · last {totalRuns}</h2>
                <p className="text-xs text-muted-foreground">Completed vs. partial vs. failed</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={62}
                        dataKey="value"
                        strokeWidth={2}
                        stroke="hsl(var(--background))"
                      >
                        {donutData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v) => [`${v}`, 'runs']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-1 flex-col gap-2.5">
                    {donutData.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-sm"
                            style={{ background: entry.color }}
                          />
                          <span>{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{entry.pct}%</span>
                          <span className="font-mono text-sm">{entry.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stacked bar chart — URLs visited per day */}
          {stackedData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-sm font-medium">URL visits · last 30 days</h2>
                <p className="text-xs text-muted-foreground">Per project, stacked</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stackedData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v: unknown) => formatChartDate(v)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {stackedGroups.map((group, i) => (
                      <Bar key={group} dataKey={group} stackId="a" fill={getGroupColor(i)} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Recent activity ──────────────────────────────────────────── */}
      {latestRuns && latestRuns.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent activity</h2>
            <Link
              to="/history"
              search={{ page: 1, group: '' }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All events →
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              {latestRuns.map((run, i) => (
                <Link
                  key={run.id}
                  to="/history/$runId"
                  params={{ runId: String(run.id) }}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50 ${
                    i < latestRuns.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <span className="font-mono text-xs text-muted-foreground w-[46px] shrink-0">
                    {new Date(run.started_at).toLocaleTimeString('nl-NL', { timeStyle: 'short' })}
                  </span>
                  <StatusBadge status={run.status} />
                  <span className="font-medium">{run.group_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {run.success_count != null && run.failure_count != null
                      ? `${run.success_count} ok${run.failure_count > 0 ? ` · ${run.failure_count} failed` : ''}`
                      : '—'}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">#{run.id}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  valueClass = '',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`font-mono text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function buildHeroText(
  groupCount: number,
  totalUrls: number,
  avgUptime: number | null,
  totalFailing: number,
): string {
  const parts: string[] = [];
  if (totalUrls > 0) parts.push(`${totalUrls} URL${totalUrls !== 1 ? 's' : ''} across ${groupCount} ${groupCount === 1 ? 'project' : 'projects'}`);
  if (avgUptime != null) parts.push(`${avgUptime.toFixed(1)}% uptime`);
  const base = parts.join(' · ');
  const health =
    totalFailing === 0
      ? 'All origins healthy.'
      : `${totalFailing} URL${totalFailing !== 1 ? 's' : ''} currently failing.`;
  return base ? `${base}. ${health}` : health;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function numberWord(n: number): string {
  return n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
}
