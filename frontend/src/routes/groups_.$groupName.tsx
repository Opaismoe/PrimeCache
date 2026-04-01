import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipContent, TooltipTrigger, Tooltip as UiTooltip } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { HTTP_STATUS_CODES } from '@/lib/httpStatusCodes';
import { cn } from '@/lib/utils';
import { GroupForm } from '../components/GroupForm';
import { StatusBadge } from '../components/StatusBadge';
import {
  getApiKey,
  getConfig,
  getGroupAccessibility,
  getGroupBrokenLinks,
  getGroupCwv,
  getGroupExportUrl,
  getGroupOverview,
  getGroupPerformance,
  getGroupSeo,
  getGroupUptime,
  getRuns,
  putConfig,
  triggerAsync,
} from '../lib/api';
import { describeCron } from '../lib/cronUtils';
import { formatChartDate } from '../lib/formatChartDate';
import { formatDate, formatDuration, formatMs } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';
import type {
  BrokenLinkSummary,
  Config,
  CwvStatus,
  Group,
  GroupAccessibility,
  GroupCwv,
  GroupOverview,
  GroupPerformance,
  GroupUptime,
  Run,
  UrlCwv,
  UrlSeoSummary,
} from '../lib/types';

const LINE_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#e879f9'];
const getColor = (i: number) => LINE_COLORS[i % LINE_COLORS.length];

export const Route = createFileRoute('/groups_/$groupName')({
  loader: ({ context: { queryClient }, params }) => {
    if (!getApiKey()) return;
    const name = params.groupName;
    return Promise.all([
      queryClient.ensureQueryData(
        queryOptions({
          queryKey: queryKeys.groups.overview(name),
          queryFn: () => getGroupOverview(name),
        }),
      ),
      queryClient.ensureQueryData(
        queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig }),
      ),
    ]);
  },
  pendingComponent: GroupDetailSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
  component: GroupDetailPage,
});

// ── Skeleton ─────────────────────────────────────────────────────────────────

function GroupDetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-1 h-4 w-28" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="mb-1.5 h-7 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="mb-1.5 h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="mb-4 h-10 w-80" />
      <div className="rounded-lg border border-border">
        <div className="p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE = 20;

function GroupDetailPage() {
  const { groupName } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [historyPage, setHistoryPage] = useState(0);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const { data: overview } = useQuery(
    queryOptions({
      queryKey: queryKeys.groups.overview(groupName),
      queryFn: () => getGroupOverview(groupName),
    }),
  );

  const { data: config } = useQuery(
    queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig }),
  );

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: queryKeys.groups.performance(groupName),
    queryFn: () => getGroupPerformance(groupName),
    enabled: activeTab === 'performance',
  });

  const { data: uptime, isLoading: uptimeLoading } = useQuery({
    queryKey: queryKeys.groups.uptime(groupName),
    queryFn: () => getGroupUptime(groupName),
    enabled: activeTab === 'uptime',
  });

  const { data: seo, isLoading: seoLoading } = useQuery({
    queryKey: queryKeys.groups.seo(groupName),
    queryFn: () => getGroupSeo(groupName),
    enabled: activeTab === 'seo',
  });

  const { data: cwv, isLoading: cwvLoading } = useQuery({
    queryKey: queryKeys.groups.cwv(groupName),
    queryFn: () => getGroupCwv(groupName),
    enabled: activeTab === 'seo',
  });

  const { data: brokenLinks, isLoading: linksLoading } = useQuery({
    queryKey: queryKeys.groups.brokenLinks(groupName),
    queryFn: () => getGroupBrokenLinks(groupName),
    enabled: activeTab === 'links',
  });

  const { data: accessibility, isLoading: accessibilityLoading } = useQuery({
    queryKey: queryKeys.groups.accessibility(groupName),
    queryFn: () => getGroupAccessibility(groupName),
    enabled: activeTab === 'accessibility',
  });

  const { data: historyRuns, isLoading: historyLoading } = useQuery({
    queryKey: [...queryKeys.runs.all(), 'group-tab', groupName, historyPage],
    queryFn: () =>
      getRuns({
        group: groupName,
        limit: HISTORY_PAGE_SIZE,
        offset: historyPage * HISTORY_PAGE_SIZE,
      }),
    enabled: activeTab === 'history',
  });

  const trigger = useMutation({
    mutationFn: () => triggerAsync(groupName),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.overview(groupName) });
      navigate({ to: '/history/$runId', params: { runId: String(data.runId) } });
    },
  });

  const group = config?.groups.find((g) => g.name === groupName);
  const stats = overview?.stats;

  const handleSettingsSave = async (updated: Group) => {
    if (!config) return;
    const newConfig: Config = {
      ...config,
      groups: config.groups.map((g) => (g.name === groupName ? updated : g)),
    };
    await putConfig(newConfig);
    queryClient.invalidateQueries({ queryKey: queryKeys.config.all() });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
    if (updated.name !== groupName) {
      navigate({ to: '/groups/$groupName', params: { groupName: updated.name } });
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Dashboard
        </Link>
        <span>/</span>
        <span>{groupName}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{groupName}</h1>
          {group && <p className="text-sm text-muted-foreground">{describeCron(group.schedule)}</p>}
        </div>
        <Button onClick={() => trigger.mutate()} disabled={trigger.isPending}>
          {trigger.isPending ? 'Starting…' : 'Run now'}
        </Button>
      </div>

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total runs" value={stats ? String(stats.totalRuns) : '—'} />
        <StatCard label="Success rate" value={stats ? `${stats.successRate.toFixed(1)}%` : '—'} />
        <StatCard label="Avg load time" value={stats ? formatMs(stats.avgLoadTimeMs) : '—'} />
        <StatCard
          label="Avg TTFB"
          value={stats?.avgTtfbMs != null ? formatMs(stats.avgTtfbMs) : '—'}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="uptime">Uptime</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
            <TabsTrigger value="history">Cache runs</TabsTrigger>
            <TabsTrigger value="settings">Config</TabsTrigger>
          </TabsList>
          {['performance', 'uptime', 'seo', 'links'].includes(activeTab) && (
            <a
              href={getGroupExportUrl(groupName, activeTab)}
              download
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Export CSV
            </a>
          )}
        </div>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <OverviewTab overview={overview} />
        </TabsContent>

        {/* ── Performance ── */}
        <TabsContent value="performance">
          {perfLoading ? (
            <TabLoadingSkeleton rows={6} cols={6} />
          ) : performance ? (
            <PerformanceTab data={performance} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No performance data yet — run the group to start collecting data.
            </p>
          )}
        </TabsContent>

        {/* ── Uptime ── */}
        <TabsContent value="uptime">
          {uptimeLoading ? (
            <TabLoadingSkeleton rows={5} cols={4} />
          ) : uptime ? (
            <UptimeTab data={uptime} colors={LINE_COLORS} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No uptime data yet — run the group to start collecting data.
            </p>
          )}
        </TabsContent>

        {/* ── SEO ── */}
        <TabsContent value="seo">
          {seoLoading || cwvLoading ? (
            <TabLoadingSkeleton rows={5} cols={4} />
          ) : seo ? (
            <SeoTab data={seo} cwv={cwv} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No SEO data collected — visits may be failing. Check the Uptime tab for errors.
            </p>
          )}
        </TabsContent>

        {/* ── Links ── */}
        <TabsContent value="links">
          {linksLoading ? (
            <TabLoadingSkeleton rows={5} cols={5} />
          ) : brokenLinks ? (
            <LinksTab data={brokenLinks} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No broken link data yet. Enable <code>checkBrokenLinks: true</code> in config and run
              the group.
            </p>
          )}
        </TabsContent>

        {/* ── Accessibility ── */}
        <TabsContent value="accessibility">
          {accessibilityLoading ? (
            <TabLoadingSkeleton rows={5} cols={5} />
          ) : accessibility && accessibility.urls.length > 0 ? (
            <AccessibilityTab data={accessibility} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No accessibility data yet. Enable <code>checkAccessibility: true</code> in config and
              run the group.
            </p>
          )}
        </TabsContent>

        {/* ── History ── */}
        <TabsContent value="history">
          {historyLoading ? (
            <TabLoadingSkeleton rows={8} cols={5} />
          ) : !historyRuns?.length ? (
            <p className="text-sm text-muted-foreground">No runs found for this group.</p>
          ) : (
            <>
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run #</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Results</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRuns.map((run) => (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() =>
                          navigate({
                            to: '/history/$runId',
                            params: { runId: String(run.id) },
                          })
                        }
                      >
                        <TableCell>
                          <span className="text-muted-foreground">#{run.id}</span>
                        </TableCell>
                        <TableCell>{formatDate(run.started_at)}</TableCell>
                        <TableCell>{formatDuration(run.started_at, run.ended_at)}</TableCell>
                        <TableCell>
                          <StatusBadge status={run.status} />
                        </TableCell>
                        <TableCell>
                          {run.success_count !== null ? (
                            <span>
                              <span className="text-green-500">{run.success_count} ok</span>
                              {run.failure_count ? (
                                <span className="ml-2 text-destructive">
                                  {run.failure_count} failed
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryPage((p) => p - 1)}
                  disabled={historyPage <= 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {historyPage + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryPage((p) => p + 1)}
                  disabled={historyRuns.length < HISTORY_PAGE_SIZE}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Settings ── */}
        <TabsContent value="settings">
          {settingsSaved && (
            <div className="mb-4 rounded-md border border-green-700 bg-green-950/40 px-3 py-2 text-sm text-green-400">
              Settings saved successfully.
            </div>
          )}
          {group ? (
            <GroupForm
              initial={group}
              onSave={handleSettingsSave}
              onCancel={() => setActiveTab('overview')}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading group configuration…</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function TabLoadingSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: cols }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full max-w-[120px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ overview }: { overview: GroupOverview | undefined }) {
  const navigate = useNavigate();
  if (!overview) return null;

  const { recentRuns, series } = overview;
  const hasSeoData = series.some((s) => s.avgSeoScore !== null);

  return (
    <div>
      {/* Charts */}
      {series.length > 1 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Success rate per run</h3>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis
                    dataKey="startedAt"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={formatChartDate}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={formatChartDate}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Success rate']}
                  />
                  <Area
                    type="monotone"
                    dataKey="successRate"
                    stroke="#4ade80"
                    fill="#4ade8020"
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Avg load time per run</h3>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis
                    dataKey="startedAt"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={formatChartDate}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => formatMs(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={formatChartDate}
                    formatter={(v) => [formatMs(Number(v)), 'Avg load']}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgLoadTimeMs"
                    stroke="#60a5fa"
                    fill="#60a5fa20"
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Uptime per run</h3>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis
                    dataKey="startedAt"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={formatChartDate}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={formatChartDate}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Uptime']}
                  />
                  <Area
                    type="monotone"
                    dataKey="uptimePct"
                    stroke="#a78bfa"
                    fill="#a78bfa20"
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {hasSeoData && (
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium">SEO score per run</h3>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <XAxis
                      dataKey="startedAt"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={formatChartDate}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      labelFormatter={formatChartDate}
                      formatter={(v) => [Number(v).toFixed(1), 'SEO score']}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgSeoScore"
                      stroke="#fb923c"
                      fill="#fb923c20"
                      dot={false}
                      strokeWidth={2}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent runs table */}
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">Recent runs</h3>
      {recentRuns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRuns.map((run: Run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({ to: '/history/$runId', params: { runId: String(run.id) } })
                  }
                >
                  <TableCell className="text-muted-foreground">#{run.id}</TableCell>
                  <TableCell>{formatDate(run.started_at)}</TableCell>
                  <TableCell>{formatDuration(run.started_at, run.ended_at)}</TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>
                    {run.success_count !== null ? (
                      <span>
                        <span className="text-green-500">{run.success_count} ok</span>
                        {run.failure_count ? (
                          <span className="ml-2 text-destructive">{run.failure_count} failed</span>
                        ) : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab({ data }: { data: GroupPerformance }) {
  if (data.urls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No performance data yet — run the group to start collecting data.
      </p>
    );
  }

  const slowCount = data.urls.filter((u) => u.isSlow).length;

  // Build multi-line chart data: group by startedAt, each URL is a key
  const urlList = [...new Set(data.loadTimeTrend.map((p) => p.url))].slice(0, 6);
  const byRun = new Map<string, Record<string, string | number>>();
  for (const p of data.loadTimeTrend) {
    let row = byRun.get(p.startedAt);
    if (!row) {
      row = { startedAt: p.startedAt };
      byRun.set(p.startedAt, row);
    }
    row[p.url] = p.avgLoadTimeMs;
  }
  const chartData = [...byRun.values()];

  return (
    <div>
      {slowCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">
            {slowCount} slow {slowCount === 1 ? 'page' : 'pages'}
          </span>
          <span className="text-muted-foreground">— P95 load time exceeds 3s</span>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>P50 Load</TableHead>
              <TableHead>P95 Load</TableHead>
              <TableHead>P50 TTFB</TableHead>
              <TableHead>P95 TTFB</TableHead>
              <TableHead>Samples</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.urls.map((u) => (
              <TableRow key={u.url}>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  <div className="flex items-center gap-2">
                    {u.isSlow && (
                      <Badge variant="destructive" className="shrink-0 text-xs">
                        Slow
                      </Badge>
                    )}
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-foreground hover:underline"
                    >
                      {u.url}
                    </a>
                  </div>
                </TableCell>
                <TableCell>{formatMs(u.p50LoadTimeMs)}</TableCell>
                <TableCell className={u.isSlow ? 'text-destructive font-medium' : ''}>
                  {formatMs(u.p95LoadTimeMs)}
                </TableCell>
                <TableCell>{u.p50TtfbMs != null ? formatMs(u.p50TtfbMs) : '—'}</TableCell>
                <TableCell>{u.p95TtfbMs != null ? formatMs(u.p95TtfbMs) : '—'}</TableCell>
                <TableCell className="text-muted-foreground">{u.sampleCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Load time trend per URL</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="startedAt"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={formatChartDate}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => formatMs(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  labelFormatter={formatChartDate}
                  formatter={(v, name) => [
                    formatMs(Number(v)),
                    String(name).split('/').pop() ?? String(name),
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(v) => v.split('/').pop() ?? v}
                />
                {urlList.map((url, i) => (
                  <Area
                    key={url}
                    type="monotone"
                    dataKey={url}
                    stroke={getColor(i)}
                    fill={getColor(i)}
                    fillOpacity={0.08}
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Uptime Tab ────────────────────────────────────────────────────────────────

function UptimeTab({ data }: { data: GroupUptime; colors?: string[] }) {
  if (data.urls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No uptime data yet — run the group to start collecting data.
      </p>
    );
  }

  const downNow = data.urls.filter((u) => u.lastStatus === 'down').length;

  const byUrl = new Map<string, { startedAt: string; value: number }[]>();
  for (const pt of data.uptimeTrend) {
    const arr = byUrl.get(pt.url) ?? [];
    arr.push({ startedAt: pt.startedAt, value: pt.wasDown ? 0 : 1 });
    byUrl.set(pt.url, arr);
  }
  const urlEntries = [...byUrl.entries()];

  return (
    <div>
      {downNow > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">
            {downNow} {downNow === 1 ? 'URL' : 'URLs'} currently down
          </span>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Uptime</TableHead>
              <TableHead>Down</TableHead>
              <TableHead>Checks</TableHead>
              <TableHead>Last status</TableHead>
              <TableHead>Last checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.urls.map((u) => (
              <TableRow key={u.url}>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-foreground hover:underline"
                  >
                    {u.url}
                  </a>
                </TableCell>
                <TableCell>
                  <span
                    className={
                      u.uptimePct >= 99
                        ? 'text-green-500 font-medium'
                        : u.uptimePct >= 95
                          ? 'text-yellow-500 font-medium'
                          : 'text-destructive font-medium'
                    }
                  >
                    {u.uptimePct.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.downCount}</TableCell>
                <TableCell className="text-muted-foreground">{u.totalChecks}</TableCell>
                <TableCell>
                  <Badge
                    variant={u.lastStatus === 'up' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {u.lastStatus === 'up' ? 'Up' : 'Down'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(u.lastCheckedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {urlEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Uptime trend per URL</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-border">
              {urlEntries.map(([url, points]) => {
                const label = (() => {
                  try {
                    return new URL(url).pathname || '/';
                  } catch {
                    return url;
                  }
                })();
                const hasOutage = points.some((p) => p.value === 0);
                return (
                  <div key={url} className="flex items-center gap-3 py-2">
                    <span
                      className="w-56 shrink-0 truncate text-xs font-mono text-muted-foreground"
                      title={url}
                    >
                      {label}
                    </span>
                    {hasOutage ? (
                      <span className="text-xs text-destructive shrink-0">⚠ outage</span>
                    ) : (
                      <span className="text-xs text-green-500 shrink-0">✓ all up</span>
                    )}
                    <ResponsiveContainer width="100%" height={36}>
                      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient
                            id={`upGrad-${url.replace(/[^a-z0-9]/gi, '')}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="startedAt" hide />
                        <YAxis domain={[0, 1]} hide />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: 11,
                          }}
                          labelFormatter={formatChartDate}
                          formatter={(v) => [v === 1 ? 'Up' : 'Down', '']}
                        />
                        <Area
                          type="stepAfter"
                          dataKey="value"
                          stroke={hasOutage ? '#f87171' : '#4ade80'}
                          fill={`url(#upGrad-${url.replace(/[^a-z0-9]/gi, '')})`}
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── CWV Section ───────────────────────────────────────────────────────────────

const CWV_STATUS_COLOR: Record<CwvStatus, string> = {
  good: 'text-green-500',
  'needs-improvement': 'text-yellow-500',
  poor: 'text-destructive',
};

function CwvTile({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: number | null;
  unit: string;
  status: CwvStatus | null;
}) {
  const color = status ? CWV_STATUS_COLOR[status] : 'text-muted-foreground';
  return (
    <div className="flex flex-col items-center rounded-lg border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {value != null ? (
        <>
          <p className={`text-xl font-semibold tabular-nums ${color}`}>
            {value}
            {unit}
          </p>
          {status && (
            <p className={`text-xs mt-0.5 ${color}`}>
              {status === 'needs-improvement'
                ? 'Needs work'
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </p>
          )}
        </>
      ) : (
        <p className="text-lg text-muted-foreground">—</p>
      )}
    </div>
  );
}

function CwvSection({ cwv }: { cwv: GroupCwv }) {
  // Aggregate: worst P75 across all URLs (most conservative view)
  const aggregate = cwv.urls.reduce<{
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    inp: number | null;
    lcpStatus: CwvStatus | null;
    fcpStatus: CwvStatus | null;
    clsStatus: CwvStatus | null;
    inpStatus: CwvStatus | null;
  }>(
    (acc, u) => ({
      lcp: acc.lcp === null ? u.lcpP75 : u.lcpP75 !== null ? Math.max(acc.lcp, u.lcpP75) : acc.lcp,
      fcp: acc.fcp === null ? u.fcpP75 : u.fcpP75 !== null ? Math.max(acc.fcp, u.fcpP75) : acc.fcp,
      cls: acc.cls === null ? u.clsP75 : u.clsP75 !== null ? Math.max(acc.cls, u.clsP75) : acc.cls,
      inp: acc.inp === null ? u.inpP75 : u.inpP75 !== null ? Math.max(acc.inp, u.inpP75) : acc.inp,
      lcpStatus:
        acc.lcpStatus === null
          ? u.lcpStatus
          : u.lcpStatus === 'poor'
            ? 'poor'
            : acc.lcpStatus === 'poor'
              ? 'poor'
              : (u.lcpStatus ?? acc.lcpStatus),
      fcpStatus:
        acc.fcpStatus === null
          ? u.fcpStatus
          : u.fcpStatus === 'poor'
            ? 'poor'
            : acc.fcpStatus === 'poor'
              ? 'poor'
              : (u.fcpStatus ?? acc.fcpStatus),
      clsStatus:
        acc.clsStatus === null
          ? u.clsStatus
          : u.clsStatus === 'poor'
            ? 'poor'
            : acc.clsStatus === 'poor'
              ? 'poor'
              : (u.clsStatus ?? acc.clsStatus),
      inpStatus:
        acc.inpStatus === null
          ? u.inpStatus
          : u.inpStatus === 'poor'
            ? 'poor'
            : acc.inpStatus === 'poor'
              ? 'poor'
              : (u.inpStatus ?? acc.inpStatus),
    }),
    {
      lcp: null,
      fcp: null,
      cls: null,
      inp: null,
      lcpStatus: null,
      fcpStatus: null,
      clsStatus: null,
      inpStatus: null,
    },
  );

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Core Web Vitals (P75)</h3>

      {/* Score tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CwvTile label="LCP" value={aggregate.lcp} unit="ms" status={aggregate.lcpStatus} />
        <CwvTile label="FCP" value={aggregate.fcp} unit="ms" status={aggregate.fcpStatus} />
        <CwvTile label="CLS" value={aggregate.cls} unit="" status={aggregate.clsStatus} />
        <CwvTile label="INP" value={aggregate.inp} unit="ms" status={aggregate.inpStatus} />
      </div>

      {/* Trend chart */}
      {cwv.trend.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">CWV trend (avg per run)</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cwv.trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="startedAt"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={formatChartDate}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `${v}ms`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  labelFormatter={formatChartDate}
                  formatter={(v, name) => [`${v}ms`, String(name).toUpperCase()]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(v) => String(v).toUpperCase()}
                />
                <Area
                  type="monotone"
                  dataKey="avgLcpMs"
                  name="lcp"
                  stroke="#60a5fa"
                  fill="#60a5fa20"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="avgFcpMs"
                  name="fcp"
                  stroke="#4ade80"
                  fill="#4ade8020"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="avgInpMs"
                  name="inp"
                  stroke="#fb923c"
                  fill="#fb923c20"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-URL trend charts */}
      {(() => {
        const urlList = [...new Set(cwv.urlTrend.map((p) => p.url))].slice(0, 6);
        const byRun = new Map<string, Record<string, string | number>>();
        for (const p of cwv.urlTrend) {
          let row = byRun.get(p.startedAt);
          if (!row) {
            row = { startedAt: p.startedAt };
            byRun.set(p.startedAt, row);
          }
          if (p.avgLcpMs != null) row[`lcp::${p.url}`] = p.avgLcpMs;
          if (p.avgClsScore != null) row[`cls::${p.url}`] = p.avgClsScore;
          if (p.avgTtfbMs != null) row[`ttfb::${p.url}`] = p.avgTtfbMs;
        }
        const urlChartData = [...byRun.values()];

        if (urlChartData.length <= 1) return null;

        const legendFormatter = (v: string) => v.split('::')[1]?.split('/').pop() ?? v;
        const tooltipContentStyle = {
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
        };

        return (
          <div className="mt-4 flex flex-col gap-4">
            {/* LCP per URL */}
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium">LCP trend per URL</h3>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={urlChartData}
                    margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                  >
                    <XAxis
                      dataKey="startedAt"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={formatChartDate}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => formatMs(v)}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      labelFormatter={formatChartDate}
                      formatter={(v, name) => [
                        formatMs(Number(v)),
                        String(name).replace('lcp::', '').split('/').pop() ?? '',
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendFormatter} />
                    {urlList.map((url, i) => (
                      <Area
                        key={url}
                        type="monotone"
                        dataKey={`lcp::${url}`}
                        stroke={getColor(i)}
                        fill={getColor(i)}
                        fillOpacity={0.08}
                        dot={false}
                        strokeWidth={2}
                        activeDot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* CLS per URL */}
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium">CLS trend per URL</h3>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={urlChartData}
                    margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                  >
                    <XAxis
                      dataKey="startedAt"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={formatChartDate}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => Number(v).toFixed(3)}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      labelFormatter={formatChartDate}
                      formatter={(v, name) => [
                        Number(v).toFixed(3),
                        String(name).replace('cls::', '').split('/').pop() ?? '',
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendFormatter} />
                    {urlList.map((url, i) => (
                      <Area
                        key={url}
                        type="monotone"
                        dataKey={`cls::${url}`}
                        stroke={getColor(i)}
                        fill={getColor(i)}
                        fillOpacity={0.08}
                        dot={false}
                        strokeWidth={2}
                        activeDot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* TTFB per URL */}
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium">TTFB trend per URL</h3>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={urlChartData}
                    margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                  >
                    <XAxis
                      dataKey="startedAt"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={formatChartDate}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => formatMs(v)}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      labelFormatter={formatChartDate}
                      formatter={(v, name) => [
                        formatMs(Number(v)),
                        String(name).replace('ttfb::', '').split('/').pop() ?? '',
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendFormatter} />
                    {urlList.map((url, i) => (
                      <Area
                        key={url}
                        type="monotone"
                        dataKey={`ttfb::${url}`}
                        stroke={getColor(i)}
                        fill={getColor(i)}
                        fillOpacity={0.08}
                        dot={false}
                        strokeWidth={2}
                        activeDot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}

// ── SEO Tab ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-destructive';
}

function SeoFieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 py-1 text-xs border-b border-border last:border-0">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className={value ? 'font-mono break-all' : 'italic text-muted-foreground'}>
        {value ?? 'not set'}
      </span>
    </div>
  );
}

function SeoTab({ data, cwv }: { data: { urls: UrlSeoSummary[] }; cwv: GroupCwv | undefined }) {
  const issueCount = data.urls.reduce((n, u) => n + u.issues.length, 0);
  const changedCount = data.urls.filter((u) => u.changed).length;

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-4 flex flex-wrap gap-3">
        {issueCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="font-medium">
              {issueCount} SEO {issueCount === 1 ? 'issue' : 'issues'}
            </span>
            <span className="text-muted-foreground">
              across {data.urls.filter((u) => u.issues.length > 0).length} URLs
            </span>
          </div>
        )}
        {changedCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <span className="font-medium">
              {changedCount} {changedCount === 1 ? 'URL' : 'URLs'} changed
            </span>
            <span className="text-muted-foreground">since last run</span>
          </div>
        )}
        {data.urls.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No SEO data collected — visits may be failing. Check the Uptime tab for errors.
          </p>
        )}
      </div>

      {/* CWV section */}
      {cwv && cwv.urls.length > 0 && <CwvSection cwv={cwv} />}

      {/* Per-URL cards */}
      <div className="flex flex-col gap-3">
        {data.urls.map((u) => {
          const urlCwv: UrlCwv | undefined = cwv?.urls.find((c) => c.url === u.url);
          return (
            <Card key={u.url}>
              {/* Per-URL CWV tiles */}
              {urlCwv && (
                <div className="border-b border-border px-4 pt-4 pb-3">
                  <p className="mb-2 text-xs text-muted-foreground font-medium">
                    Core Web Vitals (P75)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <CwvTile
                      label="LCP"
                      value={urlCwv.lcpP75}
                      unit="ms"
                      status={urlCwv.lcpStatus}
                    />
                    <CwvTile
                      label="FCP"
                      value={urlCwv.fcpP75}
                      unit="ms"
                      status={urlCwv.fcpStatus}
                    />
                    <CwvTile
                      label="CLS"
                      value={urlCwv.clsP75}
                      unit=""
                      status={urlCwv.clsStatus}
                    />
                    <CwvTile
                      label="INP"
                      value={urlCwv.inpP75}
                      unit="ms"
                      status={urlCwv.inpStatus}
                    />
                  </div>
                </div>
              )}

              <CardContent className="pt-4">
                {/* Header row */}
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.changed && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-yellow-500 text-yellow-600 dark:text-yellow-400 text-xs"
                      >
                        Changed
                      </Badge>
                    )}
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-mono text-xs hover:text-foreground hover:underline text-muted-foreground"
                    >
                      {u.url}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-lg font-bold ${scoreColor(u.score)}`}>{u.score}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                </div>

                {/* Issues */}
                {u.issues.length > 0 && (
                  <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2">
                    <ul className="space-y-0.5">
                      {u.issues.map((issue) => (
                        <li
                          key={issue}
                          className="flex items-start gap-1.5 text-xs text-destructive"
                        >
                          <span className="mt-0.5 shrink-0">✕</span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* SEO details — collapsible */}
                {u.latestSeo && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
                      <span className="font-medium">SEO details</span>
                      <span className="text-xs">▼</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-b-md border border-t-0 border-border px-3 py-1">
                        <SeoFieldRow label="Title" value={u.latestSeo.title} />
                        <SeoFieldRow label="Meta description" value={u.latestSeo.metaDescription} />
                        <SeoFieldRow label="H1" value={u.latestSeo.h1} />
                        <SeoFieldRow label="H2" value={u.latestSeo.h2} />
                        <SeoFieldRow label="H3" value={u.latestSeo.h3} />
                        <SeoFieldRow label="H4" value={u.latestSeo.h4} />
                        <SeoFieldRow label="H5" value={u.latestSeo.h5} />
                        <SeoFieldRow label="Canonical URL" value={u.latestSeo.canonicalUrl} />
                        <SeoFieldRow label="og:title" value={u.latestSeo.ogTitle} />
                        <SeoFieldRow label="og:description" value={u.latestSeo.ogDescription} />
                        <SeoFieldRow label="og:image" value={u.latestSeo.ogImage} />
                        <SeoFieldRow label="Viewport" value={u.latestSeo.viewportMeta} />
                        <SeoFieldRow label="Lang" value={u.latestSeo.lang} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* History diff (last 2 runs) */}
                {u.changed && u.history.length >= 2 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Changes since previous run
                    </p>
                    <div className="space-y-1">
                      {(['title', 'metaDescription', 'h1', 'canonicalUrl'] as const).map((field) => {
                        const prev = u.history[1].seo[field];
                        const curr = u.history[0].seo[field];
                        if (prev === curr) return null;
                        const labels: Record<string, string> = {
                          title: 'Title',
                          metaDescription: 'Meta description',
                          h1: 'H1',
                          canonicalUrl: 'Canonical',
                        };
                        return (
                          <div
                            key={field}
                            className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs"
                          >
                            <span className="font-medium text-yellow-600 dark:text-yellow-400">
                              {labels[field]}
                            </span>
                            <div className="mt-1 text-muted-foreground line-through">
                              {prev ?? '(empty)'}
                            </div>
                            <div className="mt-0.5 text-foreground">{curr ?? '(empty)'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── HTTP Status Badge ──────────────────────────────────────────────────────────

function HttpStatusBadge({ status }: { status: number | null }) {
  if (status === null) return <span className="text-muted-foreground text-xs">—</span>;

  const info = HTTP_STATUS_CODES[status];
  const badge = (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium cursor-default',
        status < 300
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : status < 400
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      )}
    >
      {status}
    </span>
  );

  if (!info) return badge;

  return (
    <UiTooltip>
      <TooltipTrigger render={badge} />
      <TooltipContent className="max-w-xs" side="top">
        <p className="font-semibold">
          {status} {info.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
        <a
          href={info.mdnUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline mt-1 block"
        >
          Learn more on MDN →
        </a>
      </TooltipContent>
    </UiTooltip>
  );
}

// ── Links Tab ─────────────────────────────────────────────────────────────────

function LinksTab({ data }: { data: BrokenLinkSummary[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No broken links found — all discovered links returned 2xx/3xx responses.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <span className="font-medium">
          {data.length} broken {data.length === 1 ? 'link' : 'links'} detected
        </span>
      </div>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Occurrences</TableHead>
              <TableHead>Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((l) => (
              <TableRow key={l.url}>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground hover:underline text-muted-foreground"
                  >
                    {l.url}
                  </a>
                </TableCell>
                <TableCell>
                  <HttpStatusBadge status={l.statusCode ?? null} />
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {l.error ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{l.occurrences}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(l.lastSeenAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Accessibility Tab ─────────────────────────────────────────────────────────

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  serious: 'bg-orange-500 text-white',
  moderate: 'bg-yellow-500 text-black',
  minor: 'bg-muted text-muted-foreground',
};

function AccessibilityTab({ data }: { data: GroupAccessibility }) {
  const totalCritical = data.urls.reduce((s, u) => s + u.latestCriticalCount, 0);
  const totalSerious = data.urls.reduce((s, u) => s + u.latestSeriousCount, 0);

  const bannerClass =
    totalCritical > 0
      ? 'border-destructive bg-destructive/10 text-destructive'
      : totalSerious > 0
        ? 'border-orange-400 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
        : 'border-border bg-muted/30 text-muted-foreground';

  const sorted = [...data.urls].sort(
    (a, b) =>
      b.latestCriticalCount - a.latestCriticalCount || b.latestSeriousCount - a.latestSeriousCount,
  );

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 text-sm font-medium ${bannerClass}`}>
        {totalCritical > 0 || totalSerious > 0
          ? `${totalCritical} critical, ${totalSerious} serious violations across ${data.urls.length} URL${data.urls.length !== 1 ? 's' : ''}`
          : `No critical or serious violations across ${data.urls.length} URL${data.urls.length !== 1 ? 's' : ''}`}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Critical</TableHead>
              <TableHead>Serious</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Top violations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((url) => (
              <TableRow key={url.url}>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  <a
                    href={url.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground hover:underline"
                  >
                    {url.url}
                  </a>
                </TableCell>
                <TableCell>
                  {url.latestCriticalCount > 0 ? (
                    <span className="font-semibold text-destructive">
                      {url.latestCriticalCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {url.latestSeriousCount > 0 ? (
                    <span className="font-semibold text-orange-500">{url.latestSeriousCount}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{url.latestViolationCount}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {url.topViolations.map((v) => (
                      <a
                        key={v.id}
                        href={v.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={v.help}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${IMPACT_COLORS[v.impact] ?? IMPACT_COLORS.minor} hover:opacity-80`}
                      >
                        {v.id}
                        {v.occurrences > 1 && <span className="opacity-70">×{v.occurrences}</span>}
                      </a>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
