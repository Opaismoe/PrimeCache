import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { getRuns, getConfig, deleteRuns, cancelRun } from '../lib/api';
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
import type { Run } from '../lib/types';

const PAGE_SIZE = 20;

const columnHelper = createColumnHelper<Run>();

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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const { data: runs, isLoading } = useQuery({
    queryKey: queryKeys.runs.list(page, group),
    queryFn: () => getRuns({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, group: group || undefined }),
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

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() }),
  });

  const groups = config?.groups.map((g) => g.name) ?? [];

  const handleClear = () => {
    const label = group ? `all runs for "${group}"` : 'all run history';
    if (confirm(`Delete ${label}? This cannot be undone.`)) {
      deleteMutation.mutate(group || undefined);
    }
  };

  const columns = [
    columnHelper.accessor('id', {
      header: 'Run ID',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.accessor('group_name', {
      header: 'Group',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('started_at', {
      header: 'Started',
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.display({
      id: 'duration',
      header: 'Duration',
      cell: (info) => formatDuration(info.row.original.started_at, info.row.original.ended_at),
      enableSorting: false,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
      filterFn: 'equals',
    }),
    columnHelper.display({
      id: 'results',
      header: 'Results',
      cell: (info) => {
        const run = info.row.original;
        return run.success_count !== null ? (
          <span>
            <span className="text-green-500">{run.success_count} ok</span>
            {run.failure_count ? (
              <span className="ml-2 text-destructive">{run.failure_count} failed</span>
            ) : null}
          </span>
        ) : (
          '—'
        );
      },
      enableSorting: false,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const run = info.row.original;
        return run.status === 'running' ? (
          <div className="text-right">
            <Button
              variant="destructive"
              size="sm"
              disabled={cancelMutation.isPending && cancelMutation.variables === run.id}
              onClick={(e) => {
                e.stopPropagation();
                cancelMutation.mutate(run.id);
              }}
            >
              Stop
            </Button>
          </div>
        ) : null;
      },
      enableSorting: false,
    }),
  ];

  const table = useReactTable({
    data: runs ?? [],
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

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
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Groups</SelectItem>
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
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="hover:bg-transparent">
                  {table.getHeaderGroups()[0].headers.map((header) => (
                    <TableHead key={`filter-${header.id}`} className="py-1">
                      {header.column.getCanFilter() ? (
                        <Select
                          value={(header.column.getFilterValue() as string) ?? '__all__'}
                          onValueChange={(v) =>
                            header.column.setFilterValue(v === '__all__' ? undefined : v)
                          }
                        >
                          <SelectTrigger className="h-7 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All statuses</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="partial_failure">Partial failure</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="running">Running</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate({ to: '/history/$runId', params: { runId: String(row.original.id) } })
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
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
