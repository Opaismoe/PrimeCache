import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupDetailSkeleton } from '../components/GroupDetailSkeleton';
import { StatCard } from '../components/StatCard';
import { HistoryTab } from '../components/tabs/HistoryTab';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { QualityTab } from '../components/tabs/QualityTab';
import { SettingsTab } from '../components/tabs/SettingsTab';
import {
  getApiKey,
  getConfig,
  getGroupOverview,
  getGroupPerformance,
  getGroupUptime,
  putConfig,
  triggerAsync,
} from '../lib/api';
import { describeCron } from '../lib/cronUtils';
import { type GroupDetailSearch, normaliseGroupDetailSearch } from '../lib/groupDetailSearch';
import { queryKeys } from '../lib/queryKeys';
import type { Config, Group } from '../lib/types';

export const Route = createFileRoute('/groups_/$groupName')({
  validateSearch: normaliseGroupDetailSearch,
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

function GroupDetailPage() {
  const { groupName } = Route.useParams();
  const { tab: activeTab, qtab: activeQtab }: GroupDetailSearch = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const { data: overview } = useQuery(
    queryOptions({
      queryKey: queryKeys.groups.overview(groupName),
      queryFn: () => getGroupOverview(groupName),
    }),
  );

  const { data: config } = useQuery(
    queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig }),
  );

  // Performance + uptime are only needed on the Health tab
  const { data: performance } = useQuery({
    queryKey: queryKeys.groups.performance(groupName),
    queryFn: () => getGroupPerformance(groupName),
    enabled: activeTab === 'health',
  });

  const { data: uptime } = useQuery({
    queryKey: queryKeys.groups.uptime(groupName),
    queryFn: () => getGroupUptime(groupName),
    enabled: activeTab === 'health',
  });

  const trigger = useMutation({
    mutationFn: () => triggerAsync(groupName),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.overview(groupName) });
      toast.success('Warm run started');
      navigate({ to: '/history/$runId', params: { runId: String(data.runId) } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to start run'),
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
    toast.success('Settings saved');
    if (updated.name !== groupName) {
      navigate({
        to: '/groups/$groupName',
        params: { groupName: updated.name },
        search: { tab: 'health', qtab: 'seo' },
      });
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

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{groupName}</h1>
          {group && <p className="text-sm text-muted-foreground">{describeCron(group.schedule)}</p>}
        </div>
        <Button onClick={() => trigger.mutate()} disabled={trigger.isPending}>
          {trigger.isPending ? 'Starting…' : 'Run now'}
        </Button>
      </div>

      {/* All-time stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total runs" value={stats ? String(stats.totalRuns) : '—'} />
        <StatCard
          label="All-time success"
          value={stats ? `${stats.successRate.toFixed(1)}%` : '—'}
        />
        <StatCard
          label="All-time avg load"
          value={stats?.avgLoadTimeMs != null ? `${stats.avgLoadTimeMs}ms` : '—'}
        />
        <StatCard
          label="All-time avg TTFB"
          value={stats?.avgTtfbMs != null ? `${stats.avgTtfbMs}ms` : '—'}
        />
      </div>

      {/* 4-tab navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          navigate({
            search: (prev) => ({ ...prev, tab: val as GroupDetailSearch['tab'] }),
            replace: true,
          });
        }}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Health — overview + per-URL sparklines */}
        <TabsContent value="health">
          <OverviewTab overview={overview} performance={performance} uptime={uptime} />
        </TabsContent>

        {/* Quality — SEO / Links / Accessibility / Lighthouse sub-tabs */}
        <TabsContent value="quality">
          <QualityTab
            groupName={groupName}
            activeQtab={activeQtab}
            onQtabChange={(qtab) =>
              navigate({ search: (prev) => ({ ...prev, qtab }), replace: true })
            }
            groupUrls={group?.urls ?? []}
          />
        </TabsContent>

        {/* History — run log with per-page pagination */}
        <TabsContent value="history">
          <HistoryTab groupName={groupName} isActive={activeTab === 'history'} />
        </TabsContent>

        {/* Settings — group config + webhooks */}
        <TabsContent value="settings">
          {group ? (
            <SettingsTab
              group={group}
              groupName={groupName}
              onSave={handleSettingsSave}
              onCancel={() =>
                navigate({ search: (prev) => ({ ...prev, tab: 'health' }), replace: true })
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading group configuration…</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
