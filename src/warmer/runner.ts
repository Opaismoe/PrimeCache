import type { Knex } from 'knex'
import { visitUrl } from './visitor'
import { randomDelay } from '../browser/stealth'
import { insertRun, finalizeRun } from '../db/queries/runs'
import { insertVisits } from '../db/queries/visits'
import { logger } from '../utils/logger'
import { env } from '../config/env'
import type { WarmGroup } from '../config/urls'

export async function runGroup(db: Knex, group: WarmGroup): Promise<number> {
  const runId = await insertRun(db, { groupName: group.name, totalUrls: group.urls.length })
  const log = logger.child({ runId, group: group.name })
  log.info({ totalUrls: group.urls.length }, 'warm run started')

  const results = []

  for (let i = 0; i < group.urls.length; i++) {
    const url = group.urls[i]
    log.info({ url }, 'visiting')
    const result = await visitUrl(url, group.options)
    results.push(result)

    // Delay between URLs (skip after last one)
    if (i < group.urls.length - 1) {
      await randomDelay(env.BETWEEN_URLS_MIN_MS, env.BETWEEN_URLS_MAX_MS)
    }
  }

  await insertVisits(db, runId, results.map((r) => ({
    url: r.url,
    statusCode: r.statusCode,
    finalUrl: r.finalUrl,
    ttfbMs: r.ttfbMs,
    loadTimeMs: r.loadTimeMs,
    consentFound: r.consentFound,
    consentStrategy: r.consentStrategy,
    error: r.error,
  })))

  const successCount = results.filter((r) => r.error === null).length
  const failureCount = results.length - successCount
  const status =
    failureCount === 0 ? 'completed' :
    successCount === 0 ? 'failed' :
    'partial_failure'

  await finalizeRun(db, runId, { status, successCount, failureCount })
  log.info({ status, successCount, failureCount }, 'warm run finished')

  return runId
}
