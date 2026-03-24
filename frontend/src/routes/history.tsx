import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRuns, getConfig, deleteRuns } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { formatDate, formatDuration } from '../lib/formatters';

const PAGE_SIZE = 20;

export const Route = createFileRoute('/history')({
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === 'number' ? search.page : Number(search.page) || 1,
    group: typeof search.group === 'string' ? search.group : '',
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { page, group } = Route.useSearch();
  const navigate = useNavigate({ from: '/history' });
  const queryClient = useQueryClient();

  const { data: runs, isLoading } = useQuery({
    queryKey: queryKeys.runs.list(page, group),
    queryFn: () => getRuns({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  });

  const { data: config } = useQuery({
    queryKey: queryKeys.config.all(),
    queryFn: getConfig,
  });

  const deleteMutation = useMutation({
    mutationFn: (g?: string) => deleteRuns(g),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      navigate({ search: { page: 1, group } });
    },
  });

  const groups = config?.groups.map((g) => g.name) ?? [];

  const handleClear = () => {
    const label = group ? `all runs for "${group}"` : 'all run history';
    if (confirm(`Delete ${label}? This cannot be undone.`)) {
      deleteMutation.mutate(group || undefined);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Run History</h1>
        <div className="flex items-center gap-2">
          <select
            value={group}
            onChange={(e) => navigate({ search: { page: 1, group: e.target.value } })}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white"
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <button
            onClick={handleClear}
            disabled={deleteMutation.isPending}
            className="rounded border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Clearing…' : 'Clear'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-gray-400" />
        </div>
      ) : !runs?.length ? (
        <p className="text-gray-400">No runs found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900 text-left text-xs text-gray-400">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Results</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="cursor-pointer border-b border-gray-800 bg-gray-950 hover:bg-gray-900"
                    onClick={() =>
                      navigate({ to: '/history/$runId', params: { runId: String(run.id) } })
                    }
                  >
                    <td className="px-4 py-3 text-gray-400">{run.id}</td>
                    <td className="px-4 py-3 font-medium text-white">{run.group_name}</td>
                    <td className="px-4 py-3 text-gray-300">{formatDate(run.started_at)}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {formatDuration(run.started_at, run.ended_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {run.success_count !== null ? (
                        <span>
                          <span className="text-green-400">{run.success_count} ok</span>
                          {run.failure_count ? (
                            <span className="ml-2 text-red-400">{run.failure_count} failed</span>
                          ) : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
            <button
              onClick={() => navigate({ search: { page: page - 1, group } })}
              disabled={page <= 1}
              className="rounded border border-gray-700 px-3 py-1.5 hover:bg-gray-800 disabled:opacity-30"
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              onClick={() => navigate({ search: { page: page + 1, group } })}
              disabled={runs.length < PAGE_SIZE}
              className="rounded border border-gray-700 px-3 py-1.5 hover:bg-gray-800 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
