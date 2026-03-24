import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRuns, getConfig, deleteRuns } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { formatDate, formatDuration } from '../lib/formatters';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
          <Select
            value={group || '__all__'}
            onValueChange={(v) => navigate({ search: { page: 1, group: !v || v === '__all__' ? '' : v } })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClear}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Clearing…' : 'Clear'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-muted-foreground" />
        </div>
      ) : !runs?.length ? (
        <p className="text-muted-foreground">No runs found.</p>
      ) : (
        <>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate({ to: '/history/$runId', params: { runId: String(run.id) } })
                    }
                  >
                    <TableCell className="text-muted-foreground">{run.id}</TableCell>
                    <TableCell className="font-medium">{run.group_name}</TableCell>
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

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ search: { page: page - 1, group } })}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ search: { page: page + 1, group } })}
              disabled={runs.length < PAGE_SIZE}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
