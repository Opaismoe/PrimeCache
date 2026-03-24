import { useState } from 'react';
import type { Group } from '../lib/types';
import { ApiError } from '../lib/api';
import { CronBuilder } from './CronBuilder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  initial?: Group;
  onSave: (group: Group) => Promise<void>;
  onCancel: () => void;
}

const defaultGroup: Group = {
  name: '',
  schedule: '0 * * * *',
  urls: [],
  options: { scrollToBottom: false, crawl: false },
};

export function GroupForm({ initial, onSave, onCancel }: Props) {
  const [group, setGroup] = useState<Group>(() => initial ?? defaultGroup);
  const [urlsText, setUrlsText] = useState(() => (initial?.urls ?? []).join('\n'));
  const [localStorageText, setLocalStorageText] = useState(() => {
    const entries = initial?.options.localStorage;
    if (!entries) return '';
    return Object.entries(entries).map(([k, v]) => `${k}=${v}`).join('\n');
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Group>(key: K, value: Group[K]) =>
    setGroup((g) => ({ ...g, [key]: value }));

  const setOpt = <K extends keyof Group['options']>(key: K, value: Group['options'][K]) =>
    setGroup((g) => ({ ...g, options: { ...g.options, [key]: value } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    const urls = urlsText
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    // Parse localStorage entries: KEY=VALUE lines
    const localStorageEntries = localStorageText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, line) => {
        const eq = line.indexOf('=');
        if (eq > 0) acc[line.slice(0, eq).trim()] = line.slice(eq + 1);
        return acc;
      }, {});

    const localStorageValue = Object.keys(localStorageEntries).length > 0 ? localStorageEntries : undefined;

    setSaving(true);
    try {
      await onSave({ ...group, urls, options: { ...group.options, localStorage: localStorageValue } });
    } catch (err) {
      if (err instanceof ApiError && err.issues) {
        setErrors((err.issues as { message: string }[]).map((i) => i.message));
      } else if (err instanceof Error) {
        setErrors([err.message]);
      } else {
        setErrors(['Unexpected error']);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="rounded border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
          <ul className="list-inside list-disc space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-name">Name</Label>
        <Input
          id="group-name"
          type="text"
          required
          value={group.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Schedule</Label>
        <CronBuilder value={group.schedule} onChange={(v) => set('schedule', v)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-urls">URLs (one per line)</Label>
        <Textarea
          id="group-urls"
          required
          rows={5}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          className="font-mono"
          placeholder={'https://example.com\nhttps://example.com/page'}
        />
      </div>

      <fieldset className="rounded border border-border p-4">
        <legend className="px-2 text-sm font-medium">Options</legend>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="scrollToBottom"
              checked={group.options.scrollToBottom}
              onCheckedChange={(checked) => setOpt('scrollToBottom', checked === true)}
            />
            <Label htmlFor="scrollToBottom" className="cursor-pointer">Scroll to bottom after load</Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="waitForSelector">Wait for selector (optional)</Label>
            <Input
              id="waitForSelector"
              type="text"
              value={group.options.waitForSelector ?? ''}
              onChange={(e) => setOpt('waitForSelector', e.target.value || undefined)}
              placeholder="e.g. main, #content"
              className="max-w-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="crawl"
              checked={group.options.crawl}
              onCheckedChange={(checked) => setOpt('crawl', checked === true)}
            />
            <Label htmlFor="crawl" className="cursor-pointer">Crawl internal links</Label>
          </div>

          {group.options.crawl && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crawl_depth">Crawl depth (1–10)</Label>
              <Input
                id="crawl_depth"
                type="number"
                min={1}
                max={10}
                required
                value={group.options.crawl_depth ?? 1}
                onChange={(e) => setOpt('crawl_depth', parseInt(e.target.value) || 1)}
                className="w-24"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="userAgent">User agent (optional)</Label>
            <Input
              id="userAgent"
              type="text"
              value={group.options.userAgent ?? ''}
              onChange={(e) => setOpt('userAgent', e.target.value || undefined)}
              placeholder="e.g. MyBot/1.0"
              className="max-w-xs"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="localStorage">
              localStorage entries (optional, one per line: <code className="text-xs">KEY=value</code>)
            </Label>
            <Textarea
              id="localStorage"
              rows={3}
              value={localStorageText}
              onChange={(e) => setLocalStorageText(e.target.value)}
              className="font-mono"
              placeholder={'cookieConsent=accepted\nsome_flag=true'}
            />
            <p className="text-xs text-muted-foreground">
              Set before page load — useful for cookie consent banners that check localStorage.
            </p>
          </div>
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
