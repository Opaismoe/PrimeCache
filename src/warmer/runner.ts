import type { Knex } from 'knex'
import { visitUrl } from './visitor'
import { randomDelay } from '../browser/stealth'
import { insertRun, finalizeRun } from '../db/queries/runs'
import { insertVisit } from '../db/queries/visits'
import { registerRun, unregisterRun } from './registry'
import { logger } from '../utils/logger'
import { env } from '../config/env'
import type { WarmGroup } from '../config/urls'

export async function runGroup(db: Knex, group: WarmGroup): Promise<number> {
  const runId = await insertRun(db, { groupName: group.name, totalUrls: group.urls.length })
  const signal = registerRun(runId)
  const log = logger.child({ runId, group: group.name })
  log.info({ totalUrls: group.urls.length }, 'warm run started')

  let successCount = 0
  let failureCount = 0
  const visited = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = group.urls.map((url) => ({ url, depth: 0 }))
  const maxDepth = group.options.crawl ? (group.options.crawl_depth ?? 0) : 0

  try {
    while (queue.length > 0) {
      if (signal.aborted) {
        log.info('warm run cancelled')
        break
      }

      const { url, depth } = queue.shift()!
      if (visited.has(url)) continue
      visited.add(url)

      log.info({ url, depth }, 'visiting')
      const result = await visitUrl(url, group.options)

      await insertVisit(db, runId, {
        url: result.url,
        statusCode: result.statusCode,
        finalUrl: result.finalUrl,
        ttfbMs: result.ttfbMs,
        loadTimeMs: result.loadTimeMs,
        consentFound: result.consentFound,
        consentStrategy: result.consentStrategy,
        error: result.error,
      })

      if (result.error === null) successCount++
      else failureCount++

      if (group.options.crawl && depth < maxDepth) {
        for (const link of result.discoveredLinks) {
          if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 })
        }
      }

      if (queue.length > 0 && !signal.aborted) {
        await randomDelay(env.BETWEEN_URLS_MIN_MS, env.BETWEEN_URLS_MAX_MS)
      }
    }
  } finally {
    unregisterRun(runId)
  }

  const status = signal.aborted
    ? 'cancelled'
    : failureCount === 0 ? 'completed'
    : successCount === 0 ? 'failed'
    : 'partial_failure'

  await finalizeRun(db, runId, { status, successCount, failureCount })
  log.info({ status, successCount, failureCount, totalVisited: visited.size }, 'warm run finished')

  return runId
}
