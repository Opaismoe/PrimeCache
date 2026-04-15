import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createWebhookToken,
  deleteWebhookToken,
  getWebhookTokens,
  setWebhookTokenActive,
} from '../../lib/api';
import { formatDate } from '../../lib/formatters';
import type { WebhookTokenCreated } from '../../lib/types';

const QUERY_KEY = (groupName: string) => ['webhook-tokens', groupName];

function buildWebhookUrl(token: string): string {
  return `${window.location.origin}/webhook/trigger/${token}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button variant="ghost" size="sm" onClick={copy} className="h-7 px-2">
      <Copy className="h-3.5 w-3.5" />
      <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
    </Button>
  );
}

interface CreatedDialogProps {
  created: WebhookTokenCreated;
  onClose: () => void;
}

function CreatedDialog({ created, onClose }: CreatedDialogProps) {
  const url = buildWebhookUrl(created.token);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Webhook created</DialogTitle>
          <DialogDescription>
            Copy this URL now — the token will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Webhook URL</Label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
              <code className="flex-1 text-xs break-all">{url}</code>
              <CopyButton text={url} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            POST to this URL — no headers or body required. Your CMS can call it directly on
            content publish.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddDialogProps {
  groupName: string;
  onClose: () => void;
  onCreated: (token: WebhookTokenCreated) => void;
}

function AddDialog({ groupName, onClose, onCreated }: AddDialogProps) {
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () => createWebhookToken(groupName, description.trim() || undefined),
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(groupName) });
      onCreated(token);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create webhook'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add webhook</DialogTitle>
          <DialogDescription>
            Creates a unique URL for this group. Anyone with the URL can trigger a run — keep it
            secret.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="e.g. Contentful production"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create.mutate()}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WebhooksTab({ groupName }: { groupName: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [justCreated, setJustCreated] = useState<WebhookTokenCreated | null>(null);

  const { data: tokens, isLoading } = useQuery({
    queryKey: QUERY_KEY(groupName),
    queryFn: () => getWebhookTokens(groupName),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteWebhookToken(groupName, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY(groupName) }),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete webhook'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      setWebhookTokenActive(groupName, id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY(groupName) }),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update webhook'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            POST to a webhook URL to trigger a run for this group — no headers required. Useful for
            CMS publish hooks.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 rounded bg-muted" />
          ))}
        </div>
      ) : !tokens?.length ? (
        <p className="text-sm text-muted-foreground">
          No webhooks yet. Add one to let your CMS trigger runs.
        </p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {t.description ?? <span className="text-muted-foreground italic">No description</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.active ? 'default' : 'secondary'}>
                      {t.active ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(t.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.last_used_at ? formatDate(t.last_used_at) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => toggle.mutate({ id: t.id, active: !t.active })}
                        disabled={toggle.isPending}
                      >
                        {t.active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Delete this webhook? Existing integrations will stop working.')) {
                            remove.mutate(t.id);
                          }
                        }}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showAdd && (
        <AddDialog
          groupName={groupName}
          onClose={() => setShowAdd(false)}
          onCreated={(token) => {
            setShowAdd(false);
            setJustCreated(token);
          }}
        />
      )}

      {justCreated && (
        <CreatedDialog created={justCreated} onClose={() => setJustCreated(null)} />
      )}
    </div>
  );
}
