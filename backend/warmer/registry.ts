// In-memory registry of active runs.
// - Lets the cancel endpoint signal a running runGroup() to stop early.
// - Tracks which group each run belongs to so a group never has two
//   overlapping runs (cron + webhook + manual trigger can all fire).
const controllers = new Map<number, AbortController>();
const groupRuns = new Map<string, number>();
const RESERVED = -1;

/**
 * Atomically claim a group before its run record exists. Returns the active
 * runId if the group is already busy, or null when the claim succeeded.
 */
export function reserveGroup(groupName: string): number | null {
  const active = groupRuns.get(groupName);
  if (active !== undefined) return active;
  groupRuns.set(groupName, RESERVED);
  return null;
}

export function releaseGroup(groupName: string): void {
  groupRuns.delete(groupName);
}

export function registerRun(runId: number, groupName: string): AbortSignal {
  const ac = new AbortController();
  controllers.set(runId, ac);
  groupRuns.set(groupName, runId);
  return ac.signal;
}

export function getActiveRunForGroup(groupName: string): number | null {
  const id = groupRuns.get(groupName);
  return id === undefined || id === RESERVED ? null : id;
}

export function cancelRun(runId: number): boolean {
  const ac = controllers.get(runId);
  if (!ac) return false;
  ac.abort();
  return true;
}

export function unregisterRun(runId: number): void {
  controllers.delete(runId);
  for (const [group, id] of groupRuns) {
    if (id === runId) groupRuns.delete(group);
  }
}
