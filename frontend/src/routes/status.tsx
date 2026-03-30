import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { StatusBadge } from '../components/StatusBadge';
import { getPublicStatus } from '../lib/api';
import { formatDate } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';
import type { RunStatus } from '../lib/types';

export const Route = createFileRoute('/status')({
  component: StatusPage,
});

function StatusPage() {
  const { data: groups, isLoading } = useQuery({
    queryKey: queryKeys.publicStatus.all(),
    queryFn: getPublicStatus,
    refetchInterval: 60_000,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Status</h1>
        <span className="text-sm text-muted-foreground">Last 30 days</span>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {groups && groups.length === 0 && (
        <p className="text-muted-foreground">No data yet — trigger a run first.</p>
      )}

      {groups && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((g) => {
            const isHealthy = g.uptimePct >= 99;
            const isDegraded = g.uptimePct >= 95 && g.uptimePct < 99;
            return (
              <div
                key={g.groupName}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isHealthy ? 'bg-green-500' : isDegraded ? 'bg-yellow-500' : 'bg-destructive'
                    }`}
                  />
                  <div>
                    <p className="font-medium">{g.groupName}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.urlCount} {g.urlCount === 1 ? 'URL' : 'URLs'}
                      {g.lastRunAt ? ` · last run ${formatDate(g.lastRunAt)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {g.lastRunStatus && <StatusBadge status={g.lastRunStatus as RunStatus} />}
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
