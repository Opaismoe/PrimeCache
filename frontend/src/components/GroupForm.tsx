import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ApiError } from '../lib/api';
import type { Group } from '../lib/types';
import { CronBuilder } from './CronBuilder';

interface Props {
  initial?: Group;
  onSave: (group: Group) => Promise<void>;
  onCancel: () => void;
}

const defaultGroup: Group = {
  name: '',
  schedule: '0 * * * *',
  urls: [],
  options: { scrollToBottom: false, crawl: false, stealth: true, fetchAssets: true, retryCount: 3 },
};

export function GroupForm({ initial, onSave, onCancel }: Props) {
  const [group, setGroup] = useState<Group>(() => initial ?? defaultGroup);
  const [urlsText, setUrlsText] = useState(() => (initial?.urls ?? []).join('\n'));
  const [localStorageText, setLocalStorageText] = useState(() => {
    const entries = initial?.options.localStorage;
    if (!entries) return '';
    return Object.entries(entries)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
  });
  const [cookiesText, setCookiesText] = useState(() => {
    const cookies = initial?.options.cookies;
    if (!cookies?.length) return '';
    return JSON.stringify(cookies, null, 2);
  });
  const [basicAuthUsername, setBasicAuthUsername] = useState(
    initial?.options.basicAuth?.username ?? '',
  );
  const [basicAuthPassword, setBasicAuthPassword] = useState(
    initial?.options.basicAuth?.password ?? '',
  );
  const [advancedOpen, setAdvancedOpen] = useState(!!initial);
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

    const localStorageEntries = localStorageText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, line) => {
        const eq = line.indexOf('=');
        if (eq > 0) acc[line.slice(0, eq).trim()] = line.slice(eq + 1);
        return acc;
      }, {});
    const localStorageValue =
      Object.keys(localStorageEntries).length > 0 ? localStorageEntries : undefined;

    let cookiesValue: Group['options']['cookies'];
    if (cookiesText.trim()) {
      try {
        cookiesValue = JSON.parse(cookiesText.trim());
      } catch {
        setErrors(['Cookies must be valid JSON (array of cookie objects)']);
        return;
      }
    }

    setSaving(true);
    try {
      const basicAuthValue =
        basicAuthUsername.trim() && basicAuthPassword
          ? { username: basicAuthUsername.trim(), password: basicAuthPassword }
          : undefined;

      await onSave({
        ...group,
        urls,
        options: {
          ...group.options,
          localStorage: localStorageValue,
          cookies: cookiesValue,
          basicAuth: basicAuthValue,
        },
      });
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

      {/* ── Basic ── */}
      <div className="flex flex-col gap-4">
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
          <Label htmlFor="group-urls">
            URLs <span className="text-muted-foreground font-normal">(one per line)</span>
          </Label>
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
      </div>

      {/* ── Advanced ── */}
      <Collapsible open={advancedOpen} onOpenChange={(open) => setAdvancedOpen(open)}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              advancedOpen && 'rotate-180',
            )}
          />
          Advanced settings
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 flex flex-col gap-4 rounded border border-border p-4">
            {/* Behaviour */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Behaviour
              </p>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="scrollToBottom"
                    checked={group.options.scrollToBottom}
                    onCheckedChange={(v) => setOpt('scrollToBottom', v === true)}
                  />
                  <Label htmlFor="scrollToBottom" className="cursor-pointer">
                    Scroll to bottom after load
                  </Label>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="crawl"
                    checked={group.options.crawl}
                    onCheckedChange={(v) => setOpt('crawl', v === true)}
                  />
                  <Label htmlFor="crawl" className="cursor-pointer">
                    Crawl internal links
                  </Label>
                </div>
              </div>

              {group.options.crawl && (
                <div className="flex flex-col gap-1.5 pl-6">
                  <Label htmlFor="crawl_depth">Crawl depth (1–10)</Label>
                  <Input
                    id="crawl_depth"
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={group.options.crawl_depth ?? 1}
                    onChange={(e) => setOpt('crawl_depth', parseInt(e.target.value, 10) || 1)}
                    className="w-24"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="waitForSelector">
                  Wait for selector{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="waitForSelector"
                  type="text"
                  value={group.options.waitForSelector ?? ''}
                  onChange={(e) => setOpt('waitForSelector', e.target.value || undefined)}
                  placeholder="e.g. main, #content"
                  className="max-w-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="waitUntil">Wait until</Label>
                <Select
                  value={group.options.waitUntil ?? 'networkidle'}
                  onValueChange={(v) =>
                    setOpt('waitUntil', v as 'networkidle' | 'load' | 'domcontentloaded')
                  }
                >
                  <SelectTrigger id="waitUntil" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="networkidle">networkidle (default)</SelectItem>
                    <SelectItem value="load">load</SelectItem>
                    <SelectItem value="domcontentloaded">domcontentloaded</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use <code>load</code> if pages time out due to endless background requests.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="retryCount">Retry attempts on failure</Label>
                <Input
                  id="retryCount"
                  type="number"
                  min={0}
                  max={10}
                  value={group.options.retryCount ?? 3}
                  onChange={(e) => setOpt('retryCount', parseInt(e.target.value, 10) || 0)}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Number of times to retry a failed URL visit before marking it as failed. Default:
                  3.
                </p>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Performance */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Performance
              </p>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fetchAssets"
                    checked={group.options.fetchAssets !== false}
                    onCheckedChange={(v) => setOpt('fetchAssets', v === true)}
                  />
                  <Label htmlFor="fetchAssets" className="cursor-pointer">
                    Fetch static assets
                  </Label>
                </div>
                <p className="pl-6 text-xs text-muted-foreground">
                  When unchecked, fonts and images are aborted before download — reduces bandwidth
                  and visit duration. CSS and JS are always fetched.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="stealth"
                    checked={group.options.stealth !== false}
                    onCheckedChange={(v) => setOpt('stealth', v === true)}
                  />
                  <Label htmlFor="stealth" className="cursor-pointer">
                    Stealth mode
                  </Label>
                </div>
                <p className="pl-6 text-xs text-muted-foreground">
                  Applies browser evasions to reduce bot-detection signals (e.g. hides{' '}
                  <code>navigator.webdriver</code>).
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="screenshot"
                    checked={group.options.screenshot === true}
                    onCheckedChange={(v) => setOpt('screenshot', v === true)}
                  />
                  <Label htmlFor="screenshot" className="cursor-pointer">
                    Capture screenshots
                  </Label>
                </div>
                <p className="pl-6 text-xs text-muted-foreground">
                  Saves a JPEG thumbnail after each visit (increases storage usage).
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="checkBrokenLinks"
                    checked={group.options.checkBrokenLinks === true}
                    onCheckedChange={(v) => setOpt('checkBrokenLinks', v === true)}
                  />
                  <Label htmlFor="checkBrokenLinks" className="cursor-pointer">
                    Check broken links
                  </Label>
                </div>
                <p className="pl-6 text-xs text-muted-foreground">
                  HEAD-checks all discovered links after crawling; requires <strong>crawl</strong>{' '}
                  enabled.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="navigationTimeout">Navigation timeout (ms)</Label>
                <Input
                  id="navigationTimeout"
                  type="number"
                  min={5000}
                  step={1000}
                  value={group.options.navigationTimeout ?? 30000}
                  onChange={(e) =>
                    setOpt('navigationTimeout', parseInt(e.target.value, 10) || 30000)
                  }
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Default: 30 000 ms. Increase for slow sites.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Delay between URLs (ms)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="delayMinMs"
                    type="number"
                    min={0}
                    step={500}
                    value={group.options.delayMinMs ?? ''}
                    onChange={(e) =>
                      setOpt(
                        'delayMinMs',
                        e.target.value ? parseInt(e.target.value, 10) : undefined,
                      )
                    }
                    placeholder="min (default 2000)"
                    className="w-40"
                  />
                  <span className="text-sm text-muted-foreground">–</span>
                  <Input
                    id="delayMaxMs"
                    type="number"
                    min={0}
                    step={500}
                    value={group.options.delayMaxMs ?? ''}
                    onChange={(e) =>
                      setOpt(
                        'delayMaxMs',
                        e.target.value ? parseInt(e.target.value, 10) : undefined,
                      )
                    }
                    placeholder="max (default 5000)"
                    className="w-40"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the global env defaults.
                </p>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Identity & state */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Identity & state
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="userAgent">
                  User agent <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
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
                  localStorage entries{' '}
                  <span className="font-normal text-muted-foreground">
                    (optional, one per line: <code className="text-xs">KEY=value</code>)
                  </span>
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
                  Injected before page load — useful for consent banners that read localStorage.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cookies">
                  Cookies{' '}
                  <span className="font-normal text-muted-foreground">(optional, JSON array)</span>
                </Label>
                <Textarea
                  id="cookies"
                  rows={4}
                  value={cookiesText}
                  onChange={(e) => setCookiesText(e.target.value)}
                  className="font-mono"
                  placeholder={`[{"name":"session","value":"abc123","domain":"example.com"}]`}
                />
                <p className="text-xs text-muted-foreground">
                  Injected before page load. Each object supports <code>name</code>,{' '}
                  <code>value</code>, <code>domain</code>, <code>path</code>, <code>httpOnly</code>,{' '}
                  <code>secure</code>, <code>sameSite</code>.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  HTTP Basic Auth{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="basicAuthUsername"
                    type="text"
                    autoComplete="off"
                    value={basicAuthUsername}
                    onChange={(e) => setBasicAuthUsername(e.target.value)}
                    placeholder="Username"
                    className="max-w-48"
                  />
                  <Input
                    id="basicAuthPassword"
                    type="password"
                    autoComplete="new-password"
                    value={basicAuthPassword}
                    onChange={(e) => setBasicAuthPassword(e.target.value)}
                    placeholder="Password"
                    className="max-w-48"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Handles <code>WWW-Authenticate</code> challenges automatically for all requests in
                  the visit.
                </p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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
