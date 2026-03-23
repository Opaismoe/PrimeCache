// In-memory registry of active run AbortControllers.
// Allows the cancel endpoint to signal a running runGroup() to stop early.
const registry = new Map<number, AbortController>()

export function registerRun(runId: number): AbortSignal {
  const ac = new AbortController()
  registry.set(runId, ac)
  return ac.signal
}

export function cancelRun(runId: number): boolean {
  const ac = registry.get(runId)
  if (!ac) return false
  ac.abort()
  return true
}

export function unregisterRun(runId: number): void {
  registry.delete(runId)
}
