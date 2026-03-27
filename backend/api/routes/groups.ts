import type { FastifyPluginAsync } from 'fastify'
import type { Db } from '../../db/client'
import { getGroupOverview } from '../../db/queries/groupOverview'
import { getGroupPerformance } from '../../db/queries/groupPerformance'
import { getGroupUptime } from '../../db/queries/groupUptime'
import { getGroupSeo } from '../../db/queries/groupSeo'
import { getGroupBrokenLinks } from '../../db/queries/visitBrokenLinks'
import { getGroupCwv } from '../../db/queries/groupCwv'

export function groupRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    app.get('/groups/:name/overview', async (request: any) => {
      const name = decodeURIComponent(request.params.name as string)
      return getGroupOverview(db, name)
    })

    app.get('/groups/:name/performance', async (request: any) => {
      const name = decodeURIComponent(request.params.name as string)
      const threshold = Number(request.query.threshold ?? 3000)
      return getGroupPerformance(db, name, threshold)
    })

    app.get('/groups/:name/uptime', async (request: any) => {
      const name = decodeURIComponent(request.params.name as string)
      return getGroupUptime(db, name)
    })

    app.get('/groups/:name/seo', async (request: any) => {
      const name = decodeURIComponent(request.params.name as string)
      return getGroupSeo(db, name)
    })

    app.get('/groups/:name/cwv', async (request: any) => {
      const name = decodeURIComponent(request.params.name as string)
      return getGroupCwv(db, name)
    })

    app.get('/groups/:name/broken-links', async (request: any) => {
      const name = decodeURIComponent(request.params.name as string)
      return getGroupBrokenLinks(db, name)
    })

    // CSV export — ?tab=performance|uptime|seo|links
    app.get('/groups/:name/export', async (request: any, reply: any) => {
      const name = decodeURIComponent(request.params.name as string)
      const tab = (request.query.tab as string) ?? 'performance'

      let csv = ''
      const filename = `${name}-${tab}.csv`

      if (tab === 'performance') {
        const data = await getGroupPerformance(db, name)
        csv = 'url,p50_load_ms,p95_load_ms,p50_ttfb_ms,p95_ttfb_ms,is_slow,sample_count\n'
        csv += data.urls.map((u) =>
          [u.url, u.p50LoadTimeMs, u.p95LoadTimeMs, u.p50TtfbMs ?? '', u.p95TtfbMs ?? '', u.isSlow, u.sampleCount].join(',')
        ).join('\n')
      } else if (tab === 'uptime') {
        const data = await getGroupUptime(db, name)
        csv = 'url,uptime_pct,total_checks,down_count,last_status,last_checked_at\n'
        csv += data.urls.map((u) =>
          [u.url, u.uptimePct, u.totalChecks, u.downCount, u.lastStatus, u.lastCheckedAt].join(',')
        ).join('\n')
      } else if (tab === 'seo') {
        const data = await getGroupSeo(db, name)
        csv = 'url,score,issues,title,meta_description,h1,canonical_url\n'
        csv += data.urls.map((u) => {
          const seo = u.latestSeo
          return [
            `"${u.url}"`,
            u.score,
            `"${u.issues.join('; ')}"`,
            `"${seo?.title ?? ''}"`,
            `"${seo?.metaDescription ?? ''}"`,
            `"${seo?.h1 ?? ''}"`,
            `"${seo?.canonicalUrl ?? ''}"`,
          ].join(',')
        }).join('\n')
      } else if (tab === 'links') {
        const data = await getGroupBrokenLinks(db, name)
        csv = 'url,status_code,error,occurrences,last_seen_at\n'
        csv += data.map((l) =>
          [`"${l.url}"`, l.statusCode ?? '', `"${l.error ?? ''}"`, l.occurrences, l.lastSeenAt].join(',')
        ).join('\n')
      }

      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(csv)
    })
  }
}
