import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { Config } from '../../config/urls';
import type { Db } from '../../db/client';
import { getGroupCwv } from '../../db/queries/groupCwv';
import { getGroupOverview } from '../../db/queries/groupOverview';
import { getGroupPerformance } from '../../db/queries/groupPerformance';
import { getGroupSeo } from '../../db/queries/groupSeo';
import { getGroupsHealth } from '../../db/queries/groupsHealth';
import { getGroupUptime } from '../../db/queries/groupUptime';
import { getGroupLighthouse, insertLighthouseReport } from '../../db/queries/lighthouse';
import { getGroupAccessibility } from '../../db/queries/visitAccessibility';
import { getGroupBrokenLinks } from '../../db/queries/visitBrokenLinks';
import { runLighthouseAudit } from '../../services/lighthouseAudit';

export function groupRoutes(db: Db, getConfig?: () => Config): FastifyPluginAsync {
  return async (app) => {
    app.get('/groups-health', async () => {
      return getGroupsHealth(db);
    });

    app.get<{ Params: { name: string } }>('/groups/:name/overview', async (request) => {
      const name = decodeURIComponent(request.params.name);
      return getGroupOverview(db, name);
    });

    app.get<{ Params: { name: string }; Querystring: { threshold?: string } }>(
      '/groups/:name/performance',
      async (request) => {
        const name = decodeURIComponent(request.params.name);
        const threshold = Number(request.query.threshold ?? 3000);
        return getGroupPerformance(db, name, threshold);
      },
    );

    app.get<{ Params: { name: string } }>('/groups/:name/uptime', async (request) => {
      const name = decodeURIComponent(request.params.name);
      return getGroupUptime(db, name);
    });

    app.get<{ Params: { name: string } }>('/groups/:name/seo', async (request) => {
      const name = decodeURIComponent(request.params.name);
      return getGroupSeo(db, name);
    });

    app.get<{ Params: { name: string } }>('/groups/:name/cwv', async (request) => {
      const name = decodeURIComponent(request.params.name);
      return getGroupCwv(db, name);
    });

    app.get<{ Params: { name: string } }>('/groups/:name/broken-links', async (request) => {
      const name = decodeURIComponent(request.params.name);
      return getGroupBrokenLinks(db, name);
    });

    app.get<{ Params: { name: string } }>('/groups/:name/accessibility', async (request) => {
      const name = decodeURIComponent(request.params.name);
      return getGroupAccessibility(db, name);
    });

    // GET /groups/:name/lighthouse?formFactor=desktop|mobile
    app.get<{ Params: { name: string }; Querystring: { formFactor?: string } }>(
      '/groups/:name/lighthouse',
      async (request) => {
        const name = decodeURIComponent(request.params.name);
        const ff = request.query.formFactor === 'mobile' ? 'mobile' : 'desktop';
        return getGroupLighthouse(db, name, ff);
      },
    );

    // POST /groups/:name/lighthouse/trigger  body: { formFactor?: 'desktop'|'mobile' }
    app.post<{ Params: { name: string }; Body: { formFactor?: string } }>(
      '/groups/:name/lighthouse/trigger',
      async (request, reply) => {
        const name = decodeURIComponent(request.params.name);
        const config = getConfig ? getConfig() : null;
        const group = config?.groups.find((g) => g.name === name);
        if (!group) return reply.code(404).send({ ok: false, error: 'Group not found' });

        const ff: 'mobile' | 'desktop' =
          request.body?.formFactor === 'mobile' ? 'mobile' : 'desktop';

        // Run audits in series to avoid 429 from Browserless rate limiting
        (async () => {
          for (const url of group.urls) {
            try {
              const result = await runLighthouseAudit(url, ff);
              await insertLighthouseReport(db, name, 'manual', result);
            } catch {
              // fire-and-forget — a single URL failure must not stop the rest
            }
          }
        })();
        return { ok: true };
      },
    );

    // CSV export — ?tab=performance|uptime|seo|links
    app.get<{ Params: { name: string }; Querystring: { tab?: string } }>(
      '/groups/:name/export',
      async (request, reply: FastifyReply) => {
        const name = decodeURIComponent(request.params.name);
        const tab = request.query.tab ?? 'performance';

        let csv = '';
        const filename = `${name}-${tab}.csv`;

        if (tab === 'performance') {
          const data = await getGroupPerformance(db, name);
          csv = 'url,p50_load_ms,p95_load_ms,p50_ttfb_ms,p95_ttfb_ms,is_slow,sample_count\n';
          csv += data.urls
            .map((u) =>
              [
                u.url,
                u.p50LoadTimeMs,
                u.p95LoadTimeMs,
                u.p50TtfbMs ?? '',
                u.p95TtfbMs ?? '',
                u.isSlow,
                u.sampleCount,
              ].join(','),
            )
            .join('\n');
        } else if (tab === 'uptime') {
          const data = await getGroupUptime(db, name);
          csv = 'url,uptime_pct,total_checks,down_count,last_status,last_checked_at\n';
          csv += data.urls
            .map((u) =>
              [u.url, u.uptimePct, u.totalChecks, u.downCount, u.lastStatus, u.lastCheckedAt].join(
                ',',
              ),
            )
            .join('\n');
        } else if (tab === 'seo') {
          const data = await getGroupSeo(db, name);
          csv = 'url,score,issues,title,meta_description,h1,canonical_url\n';
          csv += data.urls
            .map((u) => {
              const seo = u.latestSeo;
              return [
                `"${u.url}"`,
                u.score,
                `"${u.issues.join('; ')}"`,
                `"${seo?.title ?? ''}"`,
                `"${seo?.metaDescription ?? ''}"`,
                `"${seo?.h1 ?? ''}"`,
                `"${seo?.canonicalUrl ?? ''}"`,
              ].join(',');
            })
            .join('\n');
        } else if (tab === 'links') {
          const data = await getGroupBrokenLinks(db, name);
          csv = 'url,status_code,error,occurrences,last_seen_at\n';
          csv += data
            .map((l) =>
              [
                `"${l.url}"`,
                l.statusCode ?? '',
                `"${l.error ?? ''}"`,
                l.occurrences,
                l.lastSeenAt,
              ].join(','),
            )
            .join('\n');
        }

        reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(csv);
      },
    );
  };
}
