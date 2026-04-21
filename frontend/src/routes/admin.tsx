import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminSkeleton } from '../components/AdminSkeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GroupForm } from '../components/GroupForm';
import { StatusBadge } from '../components/StatusBadge';
import {
  cancelRun,
  createWebhookToken,
  deleteRuns,
  deleteWebhookToken,
  getApiKey,
  getConfig,
  getLatestRuns,
  getWebhookTokens,
  putConfig,
  setWebhookTokenActive,
} from '../lib/api';
import { describeCron } from '../lib/cronUtils';
import { formatDate } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';
import type { Config, Group, Run, WebhookToken } from '../lib/types';

// ── Route search param ────────────────────────────────────────────────────────

type AdminSection = 'groups' | 'webhooks' | 'api' | 'settings';

function validateAdminSearch(raw: Record<string, unknown>): { section: AdminSection } {
  const valid: AdminSection[] = ['groups', 'webhooks', 'api', 'settings'];
  const section =
    typeof raw.section === 'string' && valid.includes(raw.section as AdminSection)
      ? (raw.section as AdminSection)
      : 'groups';
  return { section };
}

// ── Query options ─────────────────────────────────────────────────────────────

const configQueryOptions = queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig });
const latestRunsQueryOptions = queryOptions({
  queryKey: queryKeys.runs.latest(),
  queryFn: getLatestRuns,
  refetchInterval: 5_000,
});

export const Route = createFileRoute('/admin')({
  validateSearch: validateAdminSearch,
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

// ── Admin page ────────────────────────────────────────────────────────────────

type FormMode = { mode: 'add' } | { mode: 'edit'; index: number } | null;
type PendingConfirm =
  | { type: 'delete-group'; name: string }
  | { type: 'delete-history'; group?: string }
  | null;

function AdminPage() {
  const { section } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: config } = useQuery(configQueryOptions);
  const { data: latestRuns } = useQuery(latestRunsQueryOptions);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const groups = config?.groups ?? [];
  const runningRuns: Run[] = (latestRuns ?? []).filter((r) => r.status === 'running');
  const editingGroup = formMode?.mode === 'edit' ? config?.groups[formMode.index] : undefined;

  const saveConfig = useMutation({
    mutationFn: ({
      config: cfg,
      renames,
    }: {
      config: Config;
      renames?: { from: string; to: string }[];
    }) => putConfig(cfg, renames),
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
      : `Delete ${pendingConfirm?.type === 'delete-history' && pendingConfirm.group ? `all runs for "${pendingConfirm.group}"` : 'all run history'}?`;

  return (
    <>
      <ConfirmDialog
        open={pendingConfirm !== null}
        title={confirmTitle}
        description="This cannot be undone."
        onConfirm={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
      />

      <Dialog
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) setFormMode(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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

      {section === 'groups' && (
        <GroupsSection
          groups={groups}
          runningRuns={runningRuns}
          cancelIsPending={cancelMutation.isPending}
          cancelVariables={cancelMutation.variables}
          onCancelRun={(id) => cancelMutation.mutate(id)}
          saveConfigPending={saveConfig.isPending}
          onAddGroup={() => setFormMode({ mode: 'add' })}
          onEditGroup={(i) => setFormMode({ mode: 'edit', index: i })}
          onDeleteGroup={(name) => setPendingConfirm({ type: 'delete-group', name })}
        />
      )}
      {section === 'webhooks' && <WebhooksSection groups={groups} />}
      {section === 'api' && <APISection />}
      {section === 'settings' && (
        <SettingsSection
          runningRuns={runningRuns}
          cancelIsPending={cancelMutation.isPending}
          cancelVariables={cancelMutation.variables}
          onCancelRun={(id) => cancelMutation.mutate(id)}
          deleteIsPending={deleteMutation.isPending}
          onDeleteHistory={() => setPendingConfirm({ type: 'delete-history' })}
        />
      )}
    </>
  );
}

// ── Groups section ────────────────────────────────────────────────────────────

function GroupsSection({
  groups,
  runningRuns,
  cancelIsPending,
  cancelVariables,
  onCancelRun,
  saveConfigPending,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
}: {
  groups: Group[];
  runningRuns: Run[];
  cancelIsPending: boolean;
  cancelVariables: number | undefined;
  onCancelRun: (id: number) => void;
  saveConfigPending: boolean;
  onAddGroup: () => void;
  onEditGroup: (i: number) => void;
  onDeleteGroup: (name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin · Groups"
        title="URL Groups"
        description="Configure the groups of URLs that PrimeCache visits on schedule."
        action={
          <Button size="sm" onClick={onAddGroup}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add group
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Configured groups</h2>
            <span className="text-xs text-muted-foreground">{groups.length} total</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {groups.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">No groups configured.</p>
          ) : (
            <div className="divide-y divide-border">
              {groups.map((g, i) => (
                <div key={g.name} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <span className="text-sm font-medium">{g.name}</span>
                    <p className="text-xs text-muted-foreground">
                      {describeCron(g.schedule)} · {g.urls.length} URL
                      {g.urls.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEditGroup(i)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={saveConfigPending}
                      onClick={() => onDeleteGroup(g.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {runningRuns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-medium">Active runs</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {runningRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} />
                    <span className="text-sm font-medium">{run.group_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">#{run.id}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={cancelIsPending && cancelVariables === run.id}
                    onClick={() => onCancelRun(run.id)}
                  >
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Webhooks section ──────────────────────────────────────────────────────────

function WebhooksSection({ groups }: { groups: Group[] }) {
  const queryClient = useQueryClient();
  const [newTokenGroup, setNewTokenGroup] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const tokenQueries = useQueries({
    queries: groups.map((g) => ({
      queryKey: queryKeys.groups.webhooks(g.name),
      queryFn: () => getWebhookTokens(g.name),
      enabled: !!getApiKey(),
    })),
  });

  const tokensByGroup = new Map<string, WebhookToken[]>(
    groups.map((g, i) => [g.name, tokenQueries[i]?.data ?? []]),
  );
  const totalTokens = [...tokensByGroup.values()].reduce((s, t) => s + t.length, 0);

  const createToken = useMutation({
    mutationFn: ({ group }: { group: string }) => createWebhookToken(group),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.webhooks(vars.group) });
      setRevealedToken(data.token);
      setNewTokenGroup(null);
      toast.success("Webhook token created — copy it now, it won't be shown again");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create token'),
  });

  const deleteToken = useMutation({
    mutationFn: ({ group, id }: { group: string; id: number }) => deleteWebhookToken(group, id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.webhooks(vars.group) });
      toast.success('Token deleted');
    },
  });

  const toggleToken = useMutation({
    mutationFn: ({ group, id, active }: { group: string; id: number; active: boolean }) =>
      setWebhookTokenActive(group, id, active),
    onSuccess: (_, vars) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.webhooks(vars.group) }),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin · Webhooks"
        title="Inbound webhooks"
        description="Trigger a warming run from any CMS publish hook. POST to the per-group URL — no auth headers required."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard label="Webhooks defined" value={String(totalTokens)} />
        <KpiCard
          label="Groups with webhooks"
          value={String([...tokensByGroup.entries()].filter(([, t]) => t.length > 0).length)}
        />
      </div>

      {revealedToken && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4">
            <p className="mb-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              New token — copy it now, it will not be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
                {revealedToken}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedToken);
                  toast.success('Copied');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRevealedToken(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.map((g) => {
        const tokens = tokensByGroup.get(g.name) ?? [];
        return (
          <Card key={g.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium">{g.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {tokens.length} token{tokens.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setNewTokenGroup(g.name)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New token
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {tokens.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">No tokens yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {tokens.map((token) => (
                    <div key={token.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${token.active ? 'bg-green-500' : 'bg-muted-foreground'}`}
                      />
                      <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                        {token.description || `Token #${token.id}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {token.last_used_at
                          ? `last used ${formatDate(token.last_used_at)}`
                          : 'never used'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          toggleToken.mutate({ group: g.name, id: token.id, active: !token.active })
                        }
                      >
                        {token.active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => deleteToken.mutate({ group: g.name, id: token.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={newTokenGroup !== null}
        onOpenChange={(open) => {
          if (!open) setNewTokenGroup(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create webhook token for &ldquo;{newTokenGroup}&rdquo;</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The token will be shown once after creation. Store it securely.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNewTokenGroup(null)}>
              Cancel
            </Button>
            <Button
              disabled={createToken.isPending}
              onClick={() => newTokenGroup && createToken.mutate({ group: newTokenGroup })}
            >
              {createToken.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── API section ───────────────────────────────────────────────────────────────

const API_ENDPOINTS: [string, string, string][] = [
  ['GET', '/health', 'Liveness check — no auth'],
  ['GET', '/api/public/status', 'Per-group uptime · no auth'],
  ['POST', '/api/auth/login', 'Exchange credentials for token'],
  ['GET', '/api/runs', 'Paginated run history'],
  ['GET', '/api/runs/latest', 'Latest run per group'],
  ['GET', '/api/runs/:id', 'Run detail with visits'],
  ['POST', '/api/trigger', 'Sync trigger — blocks until done'],
  ['POST', '/api/trigger/async', 'Async trigger — returns runId immediately'],
  ['POST', '/api/runs/:id/cancel', 'Cancel a running execution'],
  ['DELETE', '/api/runs', 'Clear run history (?group=name)'],
  ['GET', '/api/config', 'Current loaded config'],
  ['PUT', '/api/config', 'Update config and rename groups'],
  ['GET', '/api/groups/:name/overview', 'Summary stats and trend series'],
  ['GET', '/api/groups/:name/performance', 'P50/P95 load time & TTFB per URL'],
  ['GET', '/api/groups/:name/uptime', 'Uptime % per URL over last 30 days'],
  ['GET', '/api/groups/:name/seo', 'SEO scores and metadata per URL'],
  ['GET', '/api/groups/:name/cwv', 'Core Web Vitals at P75 per URL'],
  ['GET', '/api/groups/:name/broken-links', 'Broken links discovered during visits'],
  ['GET', '/api/groups/:name/export', 'CSV export (?tab=performance|uptime|seo|links)'],
  ['GET', '/api/stats', 'Global stats: run status breakdown, visits per day'],
  ['GET', '/api/secrets', 'List secret names (values never returned)'],
  ['POST', '/api/secrets', 'Upsert secret { name, value }'],
  ['DELETE', '/api/secrets/:name', 'Remove a secret'],
  ['GET', '/api/groups/:name/webhooks', 'List webhook tokens'],
  ['POST', '/api/groups/:name/webhooks', 'Create webhook token { description? }'],
  ['DELETE', '/api/groups/:name/webhooks/:id', 'Delete a webhook token'],
  ['PATCH', '/api/groups/:name/webhooks/:id', 'Toggle active { active: boolean }'],
  ['POST', '/webhook/warm', 'Async webhook trigger { group }'],
  ['POST', '/webhook/trigger/:token', 'Inbound webhook — token in URL, no auth'],
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-sky-500',
  POST: 'text-green-500',
  PUT: 'text-amber-500',
  PATCH: 'text-amber-500',
  DELETE: 'text-destructive',
};

function APISection() {
  const [copied, setCopied] = useState(false);
  const apiKey = getApiKey();

  const copyKey = () => {
    if (!apiKey) return;
    void navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const curlExample = `curl -X POST ${origin}/api/trigger/async \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"group":"<group-name>"}'`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin · API"
        title="REST API"
        description="Programmatic access to runs, groups, analytics, and configuration. All protected routes require X-API-Key."
      />

      <div className="grid gap-6 items-start lg:grid-cols-[1.3fr_1fr]">
        {/* Endpoint reference */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Endpoints</h2>
              <span className="font-mono rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
                v1
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {API_ENDPOINTS.map(([method, path, desc]) => (
                <div key={`${method}${path}`} className="flex items-start gap-3 px-4 py-2.5">
                  <span
                    className={`w-12 shrink-0 font-mono text-[11px] font-semibold ${METHOD_COLORS[method] ?? ''}`}
                  >
                    {method}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px]">{path}</div>
                    <div className="text-[11px] text-muted-foreground">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Quick example */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Quick example</h2>
                <span className="font-mono rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
                  curl
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-[11px] leading-relaxed">
                {curlExample}
              </pre>
            </CardContent>
          </Card>

          {/* API key */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-sm font-medium">API key</h2>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Send as <code className="font-mono">X-API-Key</code> header on all protected
                requests.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 overflow-hidden rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
                  {apiKey
                    ? `${apiKey.slice(0, 6)}${'•'.repeat(Math.max(0, apiKey.length - 6))}`
                    : '—'}
                </div>
                <Button size="sm" variant="outline" onClick={copyKey} disabled={!apiKey}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Settings section ──────────────────────────────────────────────────────────

function SettingsSection({
  runningRuns,
  cancelIsPending,
  cancelVariables,
  onCancelRun,
  deleteIsPending,
  onDeleteHistory,
}: {
  runningRuns: Run[];
  cancelIsPending: boolean;
  cancelVariables: number | undefined;
  onCancelRun: (id: number) => void;
  deleteIsPending: boolean;
  onDeleteHistory: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin · Settings"
        title="Instance settings"
        description="Runtime information and maintenance operations for this PrimeCache instance."
      />

      {runningRuns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-medium">Active runs</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {runningRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} />
                    <span className="text-sm font-medium">{run.group_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">#{run.id}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={cancelIsPending && cancelVariables === run.id}
                    onClick={() => onCancelRun(run.id)}
                  >
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
            <div>
              <div className="text-sm font-medium">Purge all run history</div>
              <div className="text-xs text-muted-foreground">
                Drops every row in{' '}
                <code className="font-mono">runs</code> and{' '}
                <code className="font-mono">visits</code>. Projects and config are preserved.
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteIsPending}
              onClick={onDeleteHistory}
            >
              {deleteIsPending ? 'Deleting…' : 'Purge history'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}
