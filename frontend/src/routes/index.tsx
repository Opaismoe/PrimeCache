import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { getConfig, getLatestRuns, triggerAsync, getStats } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { describeCron } from '../lib/cronUtils';
import { formatDate } from '../lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Link } from '@tanstack/react-router';
import type { Run, Stats } from '../lib/types';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const configQueryOptions = queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig });
const latestRunsQueryOptions = queryOptions({ queryKey: queryKeys.runs.latest(), queryFn: getLatestRuns });
const statsQueryOptions = queryOptions({ queryKey: queryKeys.stats.all(), queryFn: getStats });

export const Route = createFileRoute('/')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(configQueryOptions),
      queryClient.ensureQueryData(latestRunsQueryOptions),
      queryClient.ensureQueryData(statsQueryOptions),
    ]),
  pendingComponent: DashboardSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
  component: DashboardPage,
});

const STATUS_COLORS: Record<string, string> = {
  completed: '#4ade80',
  partial_failure: '#fbbf24',
  failed: '#f87171',
  cancelled: '#9ca3af',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  partial_failure: 'Partial',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

// Generate a distinct color for each group line
const LINE_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#e879f9'];

function getGroupColor(index: number) {
  return LINE_COLORS[index % LINE_COLORS.length];
}

function buildLineChartData(visitsByDay: Stats['visitsByDay']) {
  const groups = [...new Set(visitsByDay.map((v) => v.group))];
  const byDate = new Map<string, Record<string, number>>();
  for (const v of visitsByDay) {
    if (!byDate.has(v.date)) byDate.set(v.date, {});
    byDate.get(v.date)![v.group] = v.count;
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

  const trigger = useMutation({
    mutationFn: triggerAsync,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      navigate({ to: '/history/$runId', params: { runId: String(data.runId) } });
    },
  });

  const latestByGroup = new Map<string, Run>((latestRuns ?? []).map((r) => [r.group_name, r]));

  const pieData = Object.entries(stats?.statusCounts ?? {}).map(([status, count]) => ({
    name: STATUS_LABELS[status] ?? status,
    value: count,
    color: STATUS_COLORS[status] ?? '#6b7280',
  }));

  const { groups: lineGroups, data: lineData } = buildLineChartData(stats?.visitsByDay ?? []);

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
                      <h2 className="font-medium">{group.name}</h2>
                      <p className="text-xs text-muted-foreground">{describeCron(group.schedule)}</p>
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
                            <span className="ml-1 text-destructive">{latest.failure_count} failed</span>
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

      {stats && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Pie chart — run status breakdown */}
          {pieData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-sm font-medium">Run status breakdown</h2>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Line chart — URLs visited per day per group */}
          {lineData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-sm font-medium">URLs visited per day (last 30 days)</h2>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {lineGroups.map((group, i) => (
                      <Line
                        key={group}
                        type="monotone"
                        dataKey={group}
                        stroke={getGroupColor(i)}
                        dot={false}
                        strokeWidth={2}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
