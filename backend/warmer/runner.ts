import { randomDelay } from '../browser/stealth';
import { env } from '../config/env';
import type { WarmGroup } from '../config/urls';
import type { Db } from '../db/client';
import { insertLighthouseReport } from '../db/queries/lighthouse';
import { finalizeRun, insertRun } from '../db/queries/runs';
import { insertVisitAccessibility } from '../db/queries/visitAccessibility';
import { insertVisitBrokenLinks } from '../db/queries/visitBrokenLinks';
import { insertVisitCwv } from '../db/queries/visitCwv';
import { insertVisitHeaders } from '../db/queries/visitHeaders';
import { insertVisitScreenshot } from '../db/queries/visitScreenshot';
import { insertVisitSeo } from '../db/queries/visitSeo';
import { insertVisit } from '../db/queries/visits';
import { runLighthouseAudit } from '../services/lighthouseAudit';
import { logger } from '../utils/logger';
import { cancelRun, registerRun, unregisterRun } from './registry';
import { visitUrl } from './visitor';

export async function startRunGroup(
  db: Db,
  group: WarmGroup,
): Promise<{ runId: number; promise: Promise<void> }> {
  const runId = await insertRun(db, { groupName: group.name, totalUrls: group.urls.length });
  const promise = _executeRun(runId, db, group);
  return { runId, promise };
}

export async function runGroup(db: Db, group: WarmGroup): Promise<number> {
  const runId = await insertRun(db, { groupName: group.name, totalUrls: group.urls.length });
  await _executeRun(runId, db, group);
  return runId;
}

async function _executeRun(runId: number, db: Db, group: WarmGroup): Promise<void> {
  const signal = registerRun(runId);
  const log = logger.child({ runId, group: group.name });
  log.info({ totalUrls: group.urls.length }, 'warm run started');

  const timeoutId = setTimeout(
    () => {
      log.warn({ runId }, 'run exceeded 60-minute timeout — auto-cancelling');
      cancelRun(runId);
    },
    60 * 60 * 1000,
  );

  let successCount = 0;
  let failureCount = 0;
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = group.urls.map((url) => ({ url, depth: 0 }));
  const maxDepth = group.options.crawl ? (group.options.crawl_depth ?? 0) : 0;

  try {
    while (queue.length > 0) {
      if (signal.aborted) {
        log.info('warm run cancelled');
        break;
      }

      const next = queue.shift();
      if (next === undefined) break;
      const { url, depth } = next;
      if (visited.has(url)) continue;
      visited.add(url);

      log.info({ url, depth }, 'visiting');
      let result = await visitUrl(url, group.options);
      let usedRetries = 0;

      for (
        let attempt = 1;
        attempt <= group.options.retryCount && result.error !== null && !signal.aborted;
        attempt++
      ) {
        log.warn(
          { url, attempt, maxRetries: group.options.retryCount, error: result.error },
          'visit failed — retrying',
        );
        await randomDelay(1000, 2000);
        result = await visitUrl(url, group.options);
        usedRetries = attempt;
      }

      const visitId = await insertVisit(db, runId, {
        url: result.url,
        statusCode: result.statusCode,
        finalUrl: result.finalUrl,
        ttfbMs: result.ttfbMs,
        loadTimeMs: result.loadTimeMs,
        redirectCount: result.redirectCount,
        retryCount: usedRetries,
        consentFound: result.consentFound,
        consentStrategy: result.consentStrategy,
        error: result.error,
      });

      // Persist Phase 2 + Phase 3 data — each wrapped so one failure doesn't abort the run
      if (result.seo) await insertVisitSeo(db, visitId, result.seo).catch(() => {});
      if (result.headers) await insertVisitHeaders(db, visitId, result.headers).catch(() => {});
      if (result.cwv) await insertVisitCwv(db, visitId, result.cwv).catch(() => {});
      if (result.screenshotBase64)
        await insertVisitScreenshot(db, visitId, result.screenshotBase64).catch(() => {});
      if (result.brokenLinks?.length > 0)
        await insertVisitBrokenLinks(db, visitId, result.brokenLinks).catch(() => {});
      if (result.accessibility)
        await insertVisitAccessibility(db, visitId, {
          violationCount: result.accessibility.violationCount,
          criticalCount: result.accessibility.criticalCount,
          seriousCount: result.accessibility.seriousCount,
          violations: result.accessibility.violations,
          collectedAt: new Date(),
        }).catch(() => {});

      if (result.error === null) successCount++;
      else failureCount++;

      if (group.options.crawl && depth < maxDepth) {
        for (const link of result.discoveredLinks) {
          if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 });
        }
      }

      if (queue.length > 0 && !signal.aborted) {
        const minMs = group.options.delayMinMs ?? env.BETWEEN_URLS_MIN_MS;
        const maxMs = group.options.delayMaxMs ?? env.BETWEEN_URLS_MAX_MS;
        await randomDelay(minMs, maxMs);
      }
    }
  } finally {
    clearTimeout(timeoutId);
    unregisterRun(runId);
  }

  const status = signal.aborted
    ? 'cancelled'
    : failureCount === 0
      ? 'completed'
      : successCount === 0
        ? 'failed'
        : 'partial_failure';

  await finalizeRun(db, runId, { status, successCount, failureCount });
  log.info({ status, successCount, failureCount, totalVisited: visited.size }, 'warm run finished');

  // Lighthouse audit — run after warm run if enabled (fire-and-forget per URL)
  if (group.options.checkLighthouse) {
    const uniqueUrls = [...visited];
    for (const visitedUrl of uniqueUrls) {
      runLighthouseAudit(visitedUrl)
        .then((result) => insertLighthouseReport(db, group.name, 'schedule', result))
        .catch(() => {}); // fire-and-forget, never crash the runner
    }
  }
}
