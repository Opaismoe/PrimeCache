import type { FastifyPluginAsync } from 'fastify'
import type { Db } from '../../db/client'
import { getGroupOverview } from '../../db/queries/groupOverview'
import { getGroupPerformance } from '../../db/queries/groupPerformance'
import { getGroupUptime } from '../../db/queries/groupUptime'
import { getGroupSeo } from '../../db/queries/groupSeo'

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
  }
}
