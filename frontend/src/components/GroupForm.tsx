import { useState } from 'react';
import type { Group } from '../lib/types';
import { ApiError } from '../lib/api';
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
  options: { scrollToBottom: false, crawl: false },
};

export function GroupForm({ initial, onSave, onCancel }: Props) {
  const [group, setGroup] = useState<Group>(() => initial ?? defaultGroup);
  const [urlsText, setUrlsText] = useState(() => (initial?.urls ?? []).join('\n'));
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
    setSaving(true);
    try {
      await onSave({ ...group, urls });
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

  const inputCls =
    'rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none';

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

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-300">Name</span>
        <input
          type="text"
          required
          value={group.name}
          onChange={(e) => set('name', e.target.value)}
          className={inputCls}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-300">Schedule</span>
        <CronBuilder value={group.schedule} onChange={(v) => set('schedule', v)} />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-300">URLs (one per line)</span>
        <textarea
          required
          rows={5}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          className={`font-mono ${inputCls}`}
          placeholder={'https://example.com\nhttps://example.com/page'}
        />
      </label>

      <fieldset className="rounded border border-gray-700 p-4">
        <legend className="px-2 text-sm font-medium text-gray-300">Options</legend>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={group.options.scrollToBottom}
              onChange={(e) => setOpt('scrollToBottom', e.target.checked)}
            />
            Scroll to bottom after load
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-300">Wait for selector (optional)</span>
            <input
              type="text"
              value={group.options.waitForSelector ?? ''}
              onChange={(e) => setOpt('waitForSelector', e.target.value || undefined)}
              placeholder="e.g. main, #content"
              className={`max-w-xs ${inputCls}`}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={group.options.crawl}
              onChange={(e) => setOpt('crawl', e.target.checked)}
            />
            Crawl internal links
          </label>

          {group.options.crawl && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">Crawl depth (1–10)</span>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={group.options.crawl_depth ?? 1}
                onChange={(e) => setOpt('crawl_depth', parseInt(e.target.value) || 1)}
                className={`w-24 ${inputCls}`}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-300">User agent (optional)</span>
            <input
              type="text"
              value={group.options.userAgent ?? ''}
              onChange={(e) => setOpt('userAgent', e.target.value || undefined)}
              placeholder="e.g. MyBot/1.0"
              className={`max-w-xs ${inputCls}`}
            />
          </label>
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
