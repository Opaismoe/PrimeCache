import { queryOptions, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RunResults } from '../components/RunResults';
import { StatusBadge } from '../components/StatusBadge';
import { getApiKey, getConfig, getGroupsHealth, getLatestRuns } from '../lib/api';
import { describeCron } from '../lib/cronUtils';
import { formatDate } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';
import type { GroupHealthSummary, Run } from '../lib/types';

const configQueryOptions = queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig });
const latestRunsQueryOptions = queryOptions({
  queryKey: queryKeys.runs.latest(),
  queryFn: getLatestRuns,
});

export const Route = createFileRoute('/groups')({
  loader: ({ context: { queryClient } }) => {
    if (!getApiKey()) return;
    return Promise.all([
      queryClient.ensureQueryData(configQueryOptions),
      queryClient.ensureQueryData(latestRunsQueryOptions),
    ]);
  },
  component: ProjectsPage,
});

function NeedsWorkBadge({ health }: { health: GroupHealthSummary }) {
  const problematicTabs = Object.entries(health.tabs)
    .filter(([, hasIssue]) => hasIssue)
    .map(([tab]) => tab);

  if (problematicTabs.length === 0) return null;

  return (
    <span className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 text-xs font-medium px-2 py-0.5 rounded-full">
      Needs work · {problematicTabs.join(', ')}
    </span>
  );
}

function GroupCard({
  group,
  latestRun,
  health,
}: {
  group: { name: string; schedule: string };
  latestRun: Run | undefined;
  health: GroupHealthSummary | undefined;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              to="/groups/$groupName"
              params={{ groupName: group.name }}
              search={{ tab: 'health', qtab: 'seo' }}
              className="font-semibold text-base hover:text-primary hover:underline"
            >
              {group.name}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">{describeCron(group.schedule)}</p>
          </div>
          {latestRun && <StatusBadge status={latestRun.status} />}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {latestRun ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Last run: {formatDate(latestRun.started_at)}</span>
            <RunResults
              successCount={latestRun.success_count}
              failureCount={latestRun.failure_count}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No runs yet</p>
        )}
        {health && <NeedsWorkBadge health={health} />}
      </CardContent>
    </Card>
  );
}

function ProjectsPage() {
  const { data: config } = useQuery(configQueryOptions);
  const { data: latestRuns } = useQuery(latestRunsQueryOptions);
  const { data: healthData } = useQuery({
    queryKey: queryKeys.groups.health(),
    queryFn: getGroupsHealth,
    enabled: !!getApiKey(),
  });

  const latestByGroup = new Map<string, Run>((latestRuns ?? []).map((r) => [r.group_name, r]));
  const healthByGroup = new Map<string, GroupHealthSummary>(
    (healthData ?? []).map((h) => [h.name, h]),
  );

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Projects</h1>

      {!config?.groups.length ? (
        <p className="text-muted-foreground">
          No groups configured yet.{' '}
          <Link to="/admin" className="text-primary hover:underline">
            Add a group
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {config.groups.map((group) => (
            <GroupCard
              key={group.name}
              group={group}
              latestRun={latestByGroup.get(group.name)}
              health={healthByGroup.get(group.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
