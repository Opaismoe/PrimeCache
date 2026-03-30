import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { cancelRun, deleteRuns, getConfig, getLatestRuns, putConfig } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { Config } from '../lib/types';

const configQueryOptions = queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig });
const latestRunsQueryOptions = queryOptions({
  queryKey: queryKeys.runs.latest(),
  queryFn: getLatestRuns,
  refetchInterval: 5_000,
});

export const Route = createFileRoute('/admin')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(configQueryOptions),
      queryClient.ensureQueryData(latestRunsQueryOptions),
    ]),
  pendingComponent: AdminSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
  component: AdminPage,
});

function AdminSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-24" />
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-9 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery(configQueryOptions);
  const { data: latestRuns } = useQuery(latestRunsQueryOptions);
  const [deleteTarget, setDeleteTarget] = useState<string>('');

  const groups = config?.groups ?? [];
  const runningRuns = (latestRuns ?? []).filter((r) => r.status === 'running');

  // ── Delete history ──────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (group?: string) => deleteRuns(group),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() }),
  });

  const handleDeleteHistory = (group?: string) => {
    const label = group ? `all runs for "${group}"` : 'all run history';
    if (confirm(`Delete ${label}? This cannot be undone.`)) {
      deleteMutation.mutate(group);
    }
  };

  // ── Stop active runs ─────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() }),
  });

  // ── Delete group ─────────────────────────────────────────────
  const deleteGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!config) return;
      const groups = config.groups.filter((g) => g.name !== name);
      await putConfig({ groups } as Config);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.config.all() }),
  });

  const handleDeleteGroup = (name: string) => {
    if (confirm(`Delete group "${name}" and all its configuration? This cannot be undone.`)) {
      deleteGroupMutation.mutate(name);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Admin</h1>

      {/* ── Stop active runs ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <h2 className="font-medium">Active Runs</h2>
          <p className="text-sm text-muted-foreground">Stop any currently executing runs.</p>
        </CardHeader>
        <CardContent>
          {runningRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs currently active.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {runningRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} />
                    <span className="text-sm font-medium">{run.group_name}</span>
                    <span className="text-xs text-muted-foreground">Run #{run.id}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={cancelMutation.isPending && cancelMutation.variables === run.id}
                    onClick={() => cancelMutation.mutate(run.id)}
                  >
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete history ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <h2 className="font-medium">Delete Run History</h2>
          <p className="text-sm text-muted-foreground">
            Permanently delete run records. This cannot be undone.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => handleDeleteHistory(undefined)}
            >
              {deleteMutation.isPending && !deleteTarget ? 'Deleting…' : 'Delete all history'}
            </Button>
          </div>
          {groups.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                Or delete history for a specific group:
              </p>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <Button
                    key={g.name}
                    variant="outline"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      setDeleteTarget(g.name);
                      handleDeleteHistory(g.name);
                    }}
                  >
                    {deleteMutation.isPending && deleteTarget === g.name
                      ? 'Deleting…'
                      : `Delete "${g.name}"`}
                  </Button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Delete groups ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <h2 className="font-medium">Delete Projects</h2>
          <p className="text-sm text-muted-foreground">
            Remove a project/group and its configuration permanently.
          </p>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups configured.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((g) => (
                <div
                  key={g.name}
                  className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-2"
                >
                  <div>
                    <span className="text-sm font-medium">{g.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {g.urls.length} URL{g.urls.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteGroupMutation.isPending}
                    onClick={() => handleDeleteGroup(g.name)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
