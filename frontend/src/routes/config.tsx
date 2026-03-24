import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getConfig, putConfig } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { GroupForm } from '../components/GroupForm';
import { Spinner } from '../components/Spinner';
import { describeCron } from '../lib/cronUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Config, Group } from '../lib/types';

export const Route = createFileRoute('/config')({
  component: ConfigPage,
});

type FormMode = { mode: 'add' } | { mode: 'edit'; index: number } | null;

function ConfigPage() {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<FormMode>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.config.all(),
    queryFn: getConfig,
  });

  const saveConfig = useMutation({
    mutationFn: putConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.config.all() }),
  });

  const handleSave = async (group: Group) => {
    if (!config) return;
    const groups: Group[] =
      formMode?.mode === 'edit'
        ? config.groups.map((g, i) => (i === formMode.index ? group : g))
        : [...config.groups, group];
    await saveConfig.mutateAsync({ groups } as Config);
    setFormMode(null);
  };

  const handleDelete = async (index: number) => {
    if (!config) return;
    const name = config.groups[index]?.name ?? '';
    if (!confirm(`Delete group "${name}"?`)) return;
    const groups = config.groups.filter((_, i) => i !== index);
    await saveConfig.mutateAsync({ groups } as Config);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="text-muted-foreground" />
      </div>
    );
  }

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
