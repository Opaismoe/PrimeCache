/**
 * Module-level store for in-flight Lighthouse audits.
 * Lives outside React so state survives component unmounts (tab switches, navigation).
 */

export interface AuditEntry {
  url: string;
  groupName: string;
  formFactor: 'mobile' | 'desktop';
  startedAt: number;
  /** Set to true when the component unmounted while this audit was still running */
  toastShown: boolean;
}

const _audits = new Map<string, AuditEntry>();
const _listeners = new Set<() => void>();
// Timeouts managed here so they fire even when the component is unmounted
const _timeouts = new Map<string, ReturnType<typeof setTimeout>>();
// Per-url finish callbacks (query invalidation etc.) — replaced on remount
const _onFinish = new Map<string, (url: string) => void>();

const AUDIT_TIMEOUT_MS = 120_000;

function _notify() {
  for (const fn of _listeners) fn();
}

export const auditStore = {
  start(
    url: string,
    groupName: string,
    formFactor: 'mobile' | 'desktop',
    onFinish: (url: string) => void,
  ) {
    // Clear any previous entry for this URL
    const prev = _timeouts.get(url);
    if (prev) clearTimeout(prev);

    _audits.set(url, { url, groupName, formFactor, startedAt: Date.now(), toastShown: false });
    _onFinish.set(url, onFinish);

    const t = setTimeout(() => auditStore.finish(url), AUDIT_TIMEOUT_MS);
    _timeouts.set(url, t);
    _notify();
  },

  finish(url: string) {
    const t = _timeouts.get(url);
    if (t) clearTimeout(t);
    _timeouts.delete(url);

    const cb = _onFinish.get(url);
    cb?.(url);
    _onFinish.delete(url);

    _audits.delete(url);
    _notify();
  },

  /** Replace the finish callback when the component remounts */
  setOnFinish(url: string, cb: (url: string) => void) {
    _onFinish.set(url, cb);
  },

  markToastShown(url: string) {
    const entry = _audits.get(url);
    if (entry) entry.toastShown = true;
  },

  clearToast(url: string) {
    const entry = _audits.get(url);
    if (entry) entry.toastShown = false;
  },

  forGroup(groupName: string, formFactor: 'mobile' | 'desktop'): AuditEntry[] {
    return [..._audits.values()].filter(
      (e) => e.groupName === groupName && e.formFactor === formFactor,
    );
  },

  getAll(): AuditEntry[] {
    return [..._audits.values()];
  },

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
