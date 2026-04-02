import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupDetailSkeleton } from '../components/GroupDetailSkeleton';
import { GroupForm } from '../components/GroupForm';
import { RunResults } from '../components/RunResults';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { TabLoadingSkeleton } from '../components/TabLoadingSkeleton';
import { AccessibilityTab } from '../components/tabs/AccessibilityTab';
import { LighthouseTab } from '../components/tabs/LighthouseTab';
import { LinksTab } from '../components/tabs/LinksTab';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { PerformanceTab } from '../components/tabs/PerformanceTab';
import { SeoTab } from '../components/tabs/SeoTab';
import { UptimeTab } from '../components/tabs/UptimeTab';
import {
  getApiKey,
  getConfig,
  getGroupAccessibility,
  getGroupBrokenLinks,
  getGroupCwv,
  getGroupExportUrl,
  getGroupLighthouse,
  getGroupOverview,
  getGroupPerformance,
  getGroupSeo,
  getGroupUptime,
  getRuns,
  putConfig,
  triggerAsync,
} from '../lib/api';
import { describeCron } from '../lib/cronUtils';
import { formatDate, formatDuration } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';
import type { Config, Group } from '../lib/types';

export const Route = createFileRoute('/groups_/$groupName')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === 'string' ? search.tab : 'overview',
  }),
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

const HISTORY_PAGE_SIZE = 20;

function GroupDetailPage() {
  const { groupName } = Route.useParams();
  const { tab: activeTab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
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

  const { data: lighthouse, isLoading: lighthouseLoading } = useQuery({
    queryKey: queryKeys.groups.lighthouse(groupName),
    queryFn: () => getGroupLighthouse(groupName),
    enabled: activeTab === 'lighthouse',
    refetchInterval: activeTab === 'lighthouse' ? 30_000 : false,
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
      navigate({
        to: '/groups/$groupName',
        params: { groupName: updated.name },
        search: { tab: 'overview' },
      });
    }
  };

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Dashboard
        </Link>
        <span>/</span>
        <span>{groupName}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{groupName}</h1>
          {group && <p className="text-sm text-muted-foreground">{describeCron(group.schedule)}</p>}
        </div>
        <Button onClick={() => trigger.mutate()} disabled={trigger.isPending}>
          {trigger.isPending ? 'Starting…' : 'Run now'}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total runs" value={stats ? String(stats.totalRuns) : '—'} />
        <StatCard label="Success rate" value={stats ? `${stats.successRate.toFixed(1)}%` : '—'} />
        <StatCard
          label="Avg load time"
          value={stats?.avgLoadTimeMs != null ? `${stats.avgLoadTimeMs}ms` : '—'}
        />
        <StatCard
          label="Avg TTFB"
          value={stats?.avgTtfbMs != null ? `${stats.avgTtfbMs}ms` : '—'}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          navigate({ search: (prev) => ({ ...prev, tab: val }), replace: true });
          setHistoryPage(0);
        }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="uptime">Uptime</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
            <TabsTrigger value="lighthouse">Lighthouse</TabsTrigger>
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

        <TabsContent value="overview">
          <OverviewTab overview={overview} />
        </TabsContent>

        <TabsContent value="performance">
          {perfLoading ? (
            <TabLoadingSkeleton rows={6} cols={6} />
          ) : performance ? (
            <PerformanceTab data={performance} />
          ) : (
            <EmptyTab message="No performance data yet — run the group to start collecting data." />
          )}
        </TabsContent>

        <TabsContent value="uptime">
          {uptimeLoading ? (
            <TabLoadingSkeleton rows={5} cols={4} />
          ) : uptime ? (
            <UptimeTab data={uptime} />
          ) : (
            <EmptyTab message="No uptime data yet — run the group to start collecting data." />
          )}
        </TabsContent>

        <TabsContent value="seo">
          {seoLoading || cwvLoading ? (
            <TabLoadingSkeleton rows={5} cols={4} />
          ) : seo ? (
            <SeoTab data={seo} cwv={cwv} />
          ) : (
            <EmptyTab message="No SEO data collected — visits may be failing. Check the Uptime tab for errors." />
          )}
        </TabsContent>

        <TabsContent value="links">
          {linksLoading ? (
            <TabLoadingSkeleton rows={5} cols={5} />
          ) : brokenLinks ? (
            <LinksTab data={brokenLinks} />
          ) : (
            <EmptyTab>
              No broken link data yet. Enable <code>checkBrokenLinks: true</code> in config and run
              the group.
            </EmptyTab>
          )}
        </TabsContent>

        <TabsContent value="accessibility">
          {accessibilityLoading ? (
            <TabLoadingSkeleton rows={5} cols={5} />
          ) : accessibility && accessibility.urls.length > 0 ? (
            <AccessibilityTab data={accessibility} />
          ) : (
            <EmptyTab>
              No accessibility data yet. Enable <code>checkAccessibility: true</code> in config and
              run the group.
            </EmptyTab>
          )}
        </TabsContent>

        <TabsContent value="lighthouse">
          {lighthouseLoading ? (
            <TabLoadingSkeleton rows={4} cols={4} />
          ) : (
            <LighthouseTab data={lighthouse ?? []} groupName={groupName} />
          )}
        </TabsContent>

        <TabsContent value="history">
          {historyLoading ? (
            <TabLoadingSkeleton rows={8} cols={5} />
          ) : !historyRuns?.length ? (
            <EmptyTab message="No runs found for this group." />
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
                          navigate({ to: '/history/$runId', params: { runId: String(run.id) } })
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
                          <RunResults
                            successCount={run.success_count}
                            failureCount={run.failure_count}
                          />
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
              onCancel={() =>
                navigate({ search: (prev) => ({ ...prev, tab: 'overview' }), replace: true })
              }
            />
          ) : (
            <EmptyTab message="Loading group configuration…" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyTab({ message, children }: { message?: string; children?: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children ?? message}</p>;
}
