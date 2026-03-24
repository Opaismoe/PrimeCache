import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig, getLatestRuns, triggerAsync } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { describeCron } from '../lib/cronUtils';
import { formatDate } from '../lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Link } from '@tanstack/react-router';
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
        <Spinner className="text-muted-foreground" />
      </div>
    );
  }

  const latestByGroup = new Map<string, Run>((latestRuns ?? []).map((r) => [r.group_name, r]));

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
    </div>
  );
}
