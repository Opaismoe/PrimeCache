import { describe, expect, it } from 'vitest';
import { normaliseGroupDetailSearch } from './groupDetailSearch';

describe('normaliseGroupDetailSearch', () => {
  // ── New valid values pass through ────────────────────────────────────────────
  it('passes through valid new tab values', () => {
    expect(normaliseGroupDetailSearch({ tab: 'health' })).toEqual({ tab: 'health', qtab: 'seo' });
    expect(normaliseGroupDetailSearch({ tab: 'quality' })).toEqual({ tab: 'quality', qtab: 'seo' });
    expect(normaliseGroupDetailSearch({ tab: 'history' })).toEqual({ tab: 'history', qtab: 'seo' });
    expect(normaliseGroupDetailSearch({ tab: 'settings' })).toEqual({
      tab: 'settings',
      qtab: 'seo',
    });
  });

  it('preserves a valid qtab when tab is also valid', () => {
    expect(normaliseGroupDetailSearch({ tab: 'quality', qtab: 'links' })).toEqual({
      tab: 'quality',
      qtab: 'links',
    });
    expect(normaliseGroupDetailSearch({ tab: 'quality', qtab: 'accessibility' })).toEqual({
      tab: 'quality',
      qtab: 'accessibility',
    });
    expect(normaliseGroupDetailSearch({ tab: 'quality', qtab: 'lighthouse' })).toEqual({
      tab: 'quality',
      qtab: 'lighthouse',
    });
  });

  // ── Legacy tab → new tab remapping ──────────────────────────────────────────
  it('remaps legacy "overview" → health', () => {
    expect(normaliseGroupDetailSearch({ tab: 'overview' })).toEqual({
      tab: 'health',
      qtab: 'seo',
    });
  });

  it('remaps legacy "seo" → quality/seo', () => {
    expect(normaliseGroupDetailSearch({ tab: 'seo' })).toEqual({ tab: 'quality', qtab: 'seo' });
  });

  it('remaps legacy "links" → quality/links', () => {
    expect(normaliseGroupDetailSearch({ tab: 'links' })).toEqual({
      tab: 'quality',
      qtab: 'links',
    });
  });

  it('remaps legacy "accessibility" → quality/accessibility', () => {
    expect(normaliseGroupDetailSearch({ tab: 'accessibility' })).toEqual({
      tab: 'quality',
      qtab: 'accessibility',
    });
  });

  it('remaps legacy "lighthouse" → quality/lighthouse', () => {
    expect(normaliseGroupDetailSearch({ tab: 'lighthouse' })).toEqual({
      tab: 'quality',
      qtab: 'lighthouse',
    });
  });

  it('remaps legacy "history" → history', () => {
    expect(normaliseGroupDetailSearch({ tab: 'history' })).toEqual({
      tab: 'history',
      qtab: 'seo',
    });
  });

  it('remaps legacy "webhooks" → settings', () => {
    expect(normaliseGroupDetailSearch({ tab: 'webhooks' })).toEqual({
      tab: 'settings',
      qtab: 'seo',
    });
  });

  it('remaps legacy "config" → settings', () => {
    expect(normaliseGroupDetailSearch({ tab: 'config' })).toEqual({
      tab: 'settings',
      qtab: 'seo',
    });
  });

  // ── Unknown / missing values fall back to defaults ───────────────────────────
  it('defaults to health tab when tab is missing', () => {
    expect(normaliseGroupDetailSearch({})).toEqual({ tab: 'health', qtab: 'seo' });
  });

  it('defaults to health tab for unknown tab values', () => {
    expect(normaliseGroupDetailSearch({ tab: 'gibberish' })).toEqual({
      tab: 'health',
      qtab: 'seo',
    });
  });

  it('ignores invalid qtab values and falls back to seo', () => {
    expect(normaliseGroupDetailSearch({ tab: 'quality', qtab: 'nope' })).toEqual({
      tab: 'quality',
      qtab: 'seo',
    });
  });

  it('handles non-string tab/qtab gracefully', () => {
    expect(normaliseGroupDetailSearch({ tab: 42, qtab: null })).toEqual({
      tab: 'health',
      qtab: 'seo',
    });
  });
});
