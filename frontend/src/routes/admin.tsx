import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminSkeleton } from '../components/AdminSkeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';
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

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type FormMode = { mode: 'add' } | { mode: 'edit'; index: number } | null;
type PendingConfirm =
  | { type: 'delete-group'; name: string }
  | { type: 'delete-history'; group?: string }
  | null;

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery(configQueryOptions);
  const { data: latestRuns } = useQuery(latestRunsQueryOptions);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const groups = config?.groups ?? [];
  const runningRuns = (latestRuns ?? []).filter((r) => r.status === 'running');
  const editingGroup = formMode?.mode === 'edit' ? config?.groups[formMode.index] : undefined;

  const saveConfig = useMutation({
    mutationFn: ({
      config,
      renames,
    }: {
      config: Config;
      renames?: { from: string; to: string }[];
    }) => putConfig(config, renames),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config.all() });
      toast.success('Configuration saved');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save config'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      toast.success('Run cancelled');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to cancel run'),
  });

  const deleteMutation = useMutation({
    mutationFn: (group?: string) => deleteRuns(group),
    onSuccess: (_, group) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      toast.success(group ? `Run history cleared for "${group}"` : 'All run history cleared');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete history'),
  });

  const handleSaveGroup = async (group: Group) => {
    if (!config) return;
    const renames: { from: string; to: string }[] = [];
    const updated =
      formMode?.mode === 'edit'
        ? config.groups.map((g, i) => {
            if (i !== formMode.index) return g;
            if (g.name !== group.name) renames.push({ from: g.name, to: group.name });
            return group;
          })
        : [...config.groups, group];
    await saveConfig.mutateAsync({ config: { groups: updated } as Config, renames });
    toast.success(formMode?.mode === 'edit' ? 'Group updated' : 'Group added');
    setFormMode(null);
  };

  const handleDeleteGroup = (name: string) => setPendingConfirm({ type: 'delete-group', name });
  const handleDeleteHistory = (group?: string) =>
    setPendingConfirm({ type: 'delete-history', group });

  const handleConfirm = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.type === 'delete-group') {
      saveConfig.mutate({
        config: { groups: groups.filter((g) => g.name !== pendingConfirm.name) } as Config,
      });
      toast.success(`Group "${pendingConfirm.name}" deleted`);
    } else {
      deleteMutation.mutate(pendingConfirm.group);
    }
    setPendingConfirm(null);
  };

  const confirmTitle =
    pendingConfirm?.type === 'delete-group'
      ? `Delete group "${pendingConfirm.name}"?`
      : pendingConfirm?.type === 'delete-history'
        ? `Delete ${pendingConfirm.group ? `all runs for "${pendingConfirm.group}"` : 'all run history'}?`
        : '';

  const confirmDescription =
    pendingConfirm?.type === 'delete-group'
      ? 'This will remove the group and all its configuration. This cannot be undone.'
      : 'This will permanently remove all run records. This cannot be undone.';

  return (
    <>
      <ConfirmDialog
        open={pendingConfirm !== null}
        title={confirmTitle}
        description={confirmDescription}
        onConfirm={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
      />
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Admin</h1>

        <Section
          title="Groups"
          description="Add, edit, or remove URL groups."
          action={
            <Button size="sm" onClick={() => setFormMode({ mode: 'add' })}>
              Add group
            </Button>
          }
        >
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups configured.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((g, i) => (
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
              ))}
            </div>
          )}
        </Section>

        <Dialog
          open={formMode !== null}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
        >
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {formMode?.mode === 'add' ? 'New group' : `Edit: ${editingGroup?.name}`}
              </DialogTitle>
            </DialogHeader>
            <GroupForm
              initial={editingGroup}
              onSave={handleSaveGroup}
              onCancel={() => setFormMode(null)}
            />
          </DialogContent>
        </Dialog>

        <Section title="Active Runs" description="Stop any currently executing runs.">
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
        </Section>

        <Section
          title="Delete Run History"
          description="Permanently delete run records. This cannot be undone."
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => handleDeleteHistory()}
              >
                {deleteMutation.isPending && !deleteMutation.variables
                  ? 'Deleting…'
                  : 'Delete all history'}
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
                      onClick={() => handleDeleteHistory(g.name)}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === g.name
                        ? 'Deleting…'
                        : `Delete "${g.name}"`}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}
