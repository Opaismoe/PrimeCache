/**
 * Route search-param types and normalisation for the Group Detail page.
 *
 * Extracted as a pure utility so it can be unit-tested without React.
 * Used by `validateSearch` in `routes/groups_.$groupName.tsx`.
 */

export type TabValue = 'health' | 'quality' | 'history' | 'settings';
export type QTabValue = 'seo' | 'links' | 'accessibility' | 'lighthouse';

export interface GroupDetailSearch {
  tab: TabValue;
  qtab: QTabValue;
}

const VALID_TABS = new Set<string>(['health', 'quality', 'history', 'settings']);
const VALID_QTABS = new Set<string>(['seo', 'links', 'accessibility', 'lighthouse']);

/**
 * Mapping from old/legacy ?tab= values to the new (tab, qtab) pair.
 * Lets bookmarks and shared links continue to work after the IA refactor.
 */
const LEGACY_TAB: Record<string, { tab: TabValue; qtab?: QTabValue }> = {
  // Old top-level tabs
  overview: { tab: 'health' },
  seo: { tab: 'quality', qtab: 'seo' },
  links: { tab: 'quality', qtab: 'links' },
  accessibility: { tab: 'quality', qtab: 'accessibility' },
  lighthouse: { tab: 'quality', qtab: 'lighthouse' },
  history: { tab: 'history' },
  webhooks: { tab: 'settings' },
  config: { tab: 'settings' },
  // New tabs also tolerated (identity mapping covered by VALID_TABS check)
};

/**
 * Normalise raw URL search params to a valid `GroupDetailSearch`.
 * - New valid values pass through unchanged.
 * - Old/legacy values are remapped (backwards compat).
 * - Unknown values fall back to the `health` tab.
 */
export function normaliseGroupDetailSearch(raw: Record<string, unknown>): GroupDetailSearch {
  const rawTab = typeof raw.tab === 'string' ? raw.tab : '';
  const rawQtab = typeof raw.qtab === 'string' ? raw.qtab : '';

  let tab: TabValue;
  let qtab: QTabValue;

  if (VALID_TABS.has(rawTab)) {
    tab = rawTab as TabValue;
    qtab = VALID_QTABS.has(rawQtab) ? (rawQtab as QTabValue) : 'seo';
  } else {
    const legacy = LEGACY_TAB[rawTab];
    tab = legacy?.tab ?? 'health';
    // Prefer the explicit qtab if valid, else use the legacy-mapped default
    qtab = VALID_QTABS.has(rawQtab) ? (rawQtab as QTabValue) : (legacy?.qtab ?? 'seo');
  }

  return { tab, qtab };
}
