import type { FastifyPluginAsync } from 'fastify'
import { writeFileSync, renameSync } from 'node:fs'
import yaml from 'js-yaml'
import { env } from '../../config/env'
import { ConfigSchema } from '../../config/urls'

export const putConfigRoute: FastifyPluginAsync = async (app) => {
  app.put('/config', async (request: any, reply: any) => {
    const result = ConfigSchema.safeParse(request.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Invalid config', issues: result.error.issues })
    }
    const yamlContent = yaml.dump(result.data)
    const tmpPath = env.CONFIG_PATH + '.tmp'
    writeFileSync(tmpPath, yamlContent, 'utf-8')
    renameSync(tmpPath, env.CONFIG_PATH)
    return { ok: true }
  })
}
