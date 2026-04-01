import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '../components/StatusBadge';
import {
  getApiKey,
  getConfig,
  getLatestRuns,
  getPublicStatus,
  getStats,
  triggerAsync,
} from '../lib/api';
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
  partial_failure: 'Partial Failure',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

// Generate a distinct color for each group bar
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
      <Skeleton className="mb-6 h-7 w-32" />
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
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[220px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[220px] w-full" />
          </CardContent>
        </Card>
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

  const latestByGroup = new Map<string, Run>((latestRuns ?? []).map((r) => [r.group_name, r]));

  const statusBarData = Object.entries(stats?.statusCounts ?? {}).map(([status, count]) => ({
    status: STATUS_LABELS[status] ?? status,
    count,
    fill: STATUS_COLORS[status] ?? '#6b7280',
  }));

  const { groups: stackedGroups, data: stackedData } = buildStackedBarData(
    stats?.visitsByDay ?? [],
  );

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>

      {!config?.groups.length ? (
        <p className="text-muted-foreground">
          No groups configured yet.{' '}
          <Link to="/config" className="text-primary hover:underline">
            Add a group
          </Link>
          .
        </p>
      ) : (
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
                      {latest.success_count !== null && (
                        <span>
                          <span className="text-green-500">{latest.success_count} ok</span>
                          {latest.failure_count ? (
                            <span className="ml-1 text-destructive">
                              {latest.failure_count} failed
                            </span>
                          ) : null}
                        </span>
                      )}
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
      )}

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
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                  >
                    <span
                      className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                        isHealthy ? 'bg-green-500' : isDegraded ? 'bg-yellow-500' : 'bg-destructive'
                      }`}
                    />
                    <span className="flex-1 text-sm font-medium">{g.groupName}</span>
                    <span
                      className={`text-sm font-semibold ${
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

      {stats && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Bar chart — run status breakdown */}
          {statusBarData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-sm font-medium">Run status breakdown</h2>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={statusBarData}
                    margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="status"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {statusBarData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Stacked bar chart — URLs visited per day per group */}
          {stackedData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-sm font-medium">URLs visited per day (last 30 days)</h2>
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
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
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
    </div>
  );
}
