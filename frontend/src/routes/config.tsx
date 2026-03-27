import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { useState } from 'react';
import { getConfig, putConfig } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { GroupForm } from '../components/GroupForm';
import { Skeleton } from '@/components/ui/skeleton';
import { describeCron } from '../lib/cronUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Config, Group } from '../lib/types';

const configQueryOptions = queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig });

export const Route = createFileRoute('/config')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(configQueryOptions),
  pendingComponent: ConfigSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
  component: ConfigPage,
});

function ConfigSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-start justify-between pt-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-14" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

type FormMode = { mode: 'add' } | { mode: 'edit'; index: number } | null;

function ConfigPage() {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<FormMode>(null);

  const { data: config } = useQuery(configQueryOptions);

  const saveConfig = useMutation({
    mutationFn: ({ config, renames }: { config: Config; renames?: { from: string; to: string }[] }) =>
      putConfig(config, renames),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.config.all() }),
  });

  const handleSave = async (group: Group) => {
    if (!config) return;
    const renames: { from: string; to: string }[] = [];
    const groups: Group[] =
      formMode?.mode === 'edit'
        ? config.groups.map((g, i) => {
            if (i !== formMode.index) return g;
            if (g.name !== group.name) renames.push({ from: g.name, to: group.name });
            return group;
          })
        : [...config.groups, group];
    await saveConfig.mutateAsync({ config: { groups } as Config, renames });
    setFormMode(null);
  };

  const handleDelete = async (index: number) => {
    if (!config) return;
    const name = config.groups[index]?.name ?? '';
    if (!confirm(`Delete group "${name}"?`)) return;
    const groups = config.groups.filter((_, i) => i !== index);
    await saveConfig.mutateAsync({ config: { groups } as Config });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Config</h1>
        {!formMode && (
          <Button onClick={() => setFormMode({ mode: 'add' })}>Add group</Button>
        )}
      </div>

      {formMode && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <h2 className="mb-4 font-medium">
              {formMode.mode === 'add'
                ? 'New group'
                : `Edit: ${config?.groups[formMode.index]?.name}`}
            </h2>
            <GroupForm
              initial={formMode.mode === 'edit' ? config?.groups[formMode.index] : undefined}
              onSave={handleSave}
              onCancel={() => setFormMode(null)}
            />
          </CardContent>
        </Card>
      )}

      {!config?.groups.length ? (
        <p className="text-muted-foreground">No groups configured.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {config.groups.map((group, i) => (
            <Card key={group.name}>
              <CardContent className="flex items-start justify-between pt-4">
                <div>
                  <h3 className="font-medium">{group.name}</h3>
                  <p className="text-sm text-muted-foreground">{describeCron(group.schedule)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {group.urls.length} URL{group.urls.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormMode({ mode: 'edit', index: i })}
                    disabled={formMode !== null}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(i)}
                    disabled={saveConfig.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
