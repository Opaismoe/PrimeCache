import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig, getLatestRuns, triggerAsync } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { describeCron } from '../lib/cronUtils';
import { formatDate } from '../lib/formatters';
import type { Run } from '../lib/types';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: queryKeys.config.all(),
    queryFn: getConfig,
  });

  const { data: latestRuns, isLoading: runsLoading } = useQuery({
    queryKey: queryKeys.runs.latest(),
    queryFn: getLatestRuns,
  });

  const trigger = useMutation({
    mutationFn: triggerAsync,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      navigate({ to: '/history/$runId', params: { runId: String(data.runId) } });
    },
  });

  if (configLoading || runsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="text-gray-400" />
      </div>
    );
  }

  const latestByGroup = new Map<string, Run>((latestRuns ?? []).map((r) => [r.group_name, r]));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>

      {!config?.groups.length ? (
        <p className="text-gray-400">
          No groups configured yet.{' '}
          <a href="/config" className="text-blue-400 hover:underline">
            Add a group
          </a>
          .
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {config.groups.map((group) => {
            const latest = latestByGroup.get(group.name);
            const isTriggering = trigger.isPending && trigger.variables === group.name;
            return (
              <div
                key={group.name}
                className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium text-white">{group.name}</h2>
                    <p className="text-xs text-gray-400">{describeCron(group.schedule)}</p>
                  </div>
                  {latest && <StatusBadge status={latest.status} />}
                </div>

                {latest ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span>Last run: {formatDate(latest.started_at)}</span>
                    {latest.success_count !== null && (
                      <span>
                        <span className="text-green-400">{latest.success_count} ok</span>
                        {latest.failure_count ? (
                          <span className="ml-1 text-red-400">{latest.failure_count} failed</span>
                        ) : null}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No runs yet</p>
                )}

                <button
                  onClick={() => trigger.mutate(group.name)}
                  disabled={trigger.isPending}
                  className="mt-auto rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {isTriggering ? 'Starting…' : 'Run now'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
