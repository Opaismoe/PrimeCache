import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getConfig, putConfig } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { GroupForm } from '../components/GroupForm';
import { Spinner } from '../components/Spinner';
import { describeCron } from '../lib/cronUtils';
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
        <Spinner className="text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Config</h1>
        {!formMode && (
          <button
            onClick={() => setFormMode({ mode: 'add' })}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Add group
          </button>
        )}
      </div>

      {formMode && (
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-900 p-5">
          <h2 className="mb-4 font-medium text-white">
            {formMode.mode === 'add'
              ? 'New group'
              : `Edit: ${config?.groups[formMode.index]?.name}`}
          </h2>
          <GroupForm
            initial={formMode.mode === 'edit' ? config?.groups[formMode.index] : undefined}
            onSave={handleSave}
            onCancel={() => setFormMode(null)}
          />
        </div>
      )}

      {!config?.groups.length ? (
        <p className="text-gray-400">No groups configured.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {config.groups.map((group, i) => (
            <div
              key={group.name}
              className="flex items-start justify-between rounded-lg border border-gray-800 bg-gray-900 p-4"
            >
              <div>
                <h3 className="font-medium text-white">{group.name}</h3>
                <p className="text-sm text-gray-400">{describeCron(group.schedule)}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {group.urls.length} URL{group.urls.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormMode({ mode: 'edit', index: i })}
                  disabled={formMode !== null}
                  className="rounded border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(i)}
                  disabled={saveConfig.isPending}
                  className="rounded border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/50 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
