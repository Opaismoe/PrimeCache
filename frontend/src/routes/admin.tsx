import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { AdminSkeleton } from '../components/AdminSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { GroupForm } from '../components/GroupForm';
import { StatusBadge } from '../components/StatusBadge';
import { cancelRun, deleteRuns, getApiKey, getConfig, getLatestRuns, putConfig } from '../lib/api';
import { describeCron } from '../lib/cronUtils';
import { queryKeys } from '../lib/queryKeys';
import type { Config, Group } from '../lib/types';

const configQueryOptions = queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig });
const latestRunsQueryOptions = queryOptions({
  queryKey: queryKeys.runs.latest(),
  queryFn: getLatestRuns,
  refetchInterval: 5_000,
});

export const Route = createFileRoute('/admin')({
  loader: ({ context: { queryClient } }) => {
    if (!getApiKey()) return;
    return Promise.all([
      queryClient.ensureQueryData(configQueryOptions),
      queryClient.ensureQueryData(latestRunsQueryOptions),
    ]);
  },
  pendingComponent: AdminSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
  component: AdminPage,
});

type FormMode = { mode: 'add' } | { mode: 'edit'; index: number } | null;

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery(configQueryOptions);
  const { data: latestRuns } = useQuery(latestRunsQueryOptions);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<string>('');

  const groups = config?.groups ?? [];
  const runningRuns = (latestRuns ?? []).filter((r) => r.status === 'running');

  // ── Config mutations ──────────────────────────────────────────
  const saveConfig = useMutation({
    mutationFn: ({ config, renames }: { config: Config; renames?: { from: string; to: string }[] }) =>
      putConfig(config, renames),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.config.all() }),
  });

  const handleSaveGroup = async (group: Group) => {
    if (!config) return;
    const renames: { from: string; to: string }[] = [];
    const updated: Group[] =
      formMode?.mode === 'edit'
        ? config.groups.map((g, i) => {
            if (i !== formMode.index) return g;
            if (g.name !== group.name) renames.push({ from: g.name, to: group.name });
            return group;
          })
        : [...config.groups, group];
    await saveConfig.mutateAsync({ config: { groups: updated } as Config, renames });
    setFormMode(null);
  };

  const handleDeleteGroup = (name: string) => {
    if (!confirm(`Delete group "${name}" and all its configuration? This cannot be undone.`)) return;
    saveConfig.mutate({ config: { groups: groups.filter((g) => g.name !== name) } as Config });
  };

  // ── Run mutations ─────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() }),
  });

  const deleteMutation = useMutation({
    mutationFn: (group?: string) => deleteRuns(group),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() }),
  });

  const handleDeleteHistory = (group?: string) => {
    const label = group ? `all runs for "${group}"` : 'all run history';
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleteTarget(group ?? '');
    deleteMutation.mutate(group);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Admin</h1>

      {/* ── Groups ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Groups</h2>
              <p className="text-sm text-muted-foreground">Add, edit, or remove URL groups.</p>
            </div>
            {!formMode && (
              <Button size="sm" onClick={() => setFormMode({ mode: 'add' })}>
                Add group
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {formMode && (
            <div className="rounded-md border border-border p-4">
              <h3 className="mb-4 text-sm font-medium">
                {formMode.mode === 'add' ? 'New group' : `Edit: ${config?.groups[formMode.index]?.name}`}
              </h3>
              <GroupForm
                initial={formMode.mode === 'edit' ? config?.groups[formMode.index] : undefined}
                onSave={handleSaveGroup}
                onCancel={() => setFormMode(null)}
              />
            </div>
          )}
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups configured.</p>
          ) : (
            groups.map((g, i) => (
              <div
                key={g.name}
                className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-2"
              >
                <div>
                  <span className="text-sm font-medium">{g.name}</span>
                  <p className="text-xs text-muted-foreground">{describeCron(g.schedule)}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.urls.length} URL{g.urls.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={formMode !== null}
                    onClick={() => setFormMode({ mode: 'edit', index: i })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={saveConfig.isPending}
                    onClick={() => handleDeleteGroup(g.name)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Active runs ───────────────────────────────────── */}
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

      {/* ── Delete history ────────────────────────────────── */}
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
              <p className="text-xs text-muted-foreground">Or delete history for a specific group:</p>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <Button
                    key={g.name}
                    variant="outline"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDeleteHistory(g.name)}
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
    </div>
  );
}
