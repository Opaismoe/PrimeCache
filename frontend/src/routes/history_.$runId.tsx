import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRunById, cancelRun } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { formatDate, formatDuration, formatMs } from '../lib/formatters';

export const Route = createFileRoute('/history_/$runId')({
  component: RunDetailPage,
});

function RunDetailPage() {
  const { runId } = Route.useParams();
  const id = parseInt(runId);
  const queryClient = useQueryClient();

  const { data: run, isLoading } = useQuery({
    queryKey: queryKeys.runs.detail(id),
    queryFn: () => getRunById(id),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });

  const cancel = useMutation({
    mutationFn: () => cancelRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(id) }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="text-gray-400" />
      </div>
    );
  }

  if (!run) {
    return <p className="text-gray-400">Run not found.</p>;
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
        <Link to="/history" search={{ page: 1, group: '' }} className="hover:text-white">
          History
        </Link>
        <span>/</span>
        <span>Run #{run.id}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Run #{run.id}</h1>
          <p className="text-sm text-gray-400">{run.group_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} />
          {run.status === 'running' && (
            <button
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
              className="rounded border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
            >
              {cancel.isPending ? 'Stopping…' : 'Stop'}
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Started" value={formatDate(run.started_at)} />
        <Metric label="Duration" value={formatDuration(run.started_at, run.ended_at)} />
        <Metric label="Success" value={run.success_count !== null ? String(run.success_count) : '…'} />
        <Metric label="Failed" value={run.failure_count !== null ? String(run.failure_count) : '…'} />
      </div>

      {run.visits.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-400">
          {run.status === 'running' && <Spinner className="h-4 w-4" />}
          <span className="text-sm">
            {run.status === 'running' ? 'Waiting for first visit…' : 'No visits recorded.'}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900 text-left text-xs text-gray-400">
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">TTFB</th>
                <th className="px-4 py-3">Load</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {run.visits.map((visit) => (
                <tr
                  key={visit.id}
                  className={`border-b border-gray-800 ${visit.error ? 'bg-red-950/20' : 'bg-gray-950'}`}
                >
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-300">
                    <a
                      href={visit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white hover:underline"
                    >
                      {visit.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{visit.status_code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{formatMs(visit.ttfb_ms)}</td>
                  <td className="px-4 py-3 text-gray-300">{formatMs(visit.load_time_ms)}</td>
                  <td className="px-4 py-3 text-xs text-red-400">{visit.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 font-medium text-white">{value}</p>
    </div>
  );
}
