import { db } from './db/client'
import { buildServer } from './api/server'
import { registerJobs } from './scheduler/index'
import { disconnect } from './browser/connection'
import { loadConfig, watchConfig } from './config/urls'
import { logger } from './utils/logger'
import { env } from './config/env'

async function main() {
  // 1. Load and validate config
  const config = loadConfig(env.CONFIG_PATH)
  logger.info({ groups: config.groups.length }, 'config loaded')

  // 2. Run DB migrations — must complete before anything else starts
  await db.migrate.latest()
  logger.info('migrations complete')

  // 3. Start API server
  const server = await buildServer({ db, config })
  await server.listen({ port: env.PORT, host: '0.0.0.0' })
  logger.info({ port: env.PORT }, 'API server listening')

  // 4. Register cron jobs
  registerJobs(config.groups, db)

  // 5. Watch config for live changes
  const stopWatcher = watchConfig(env.CONFIG_PATH, (newConfig) => {
    logger.info('config reloaded — re-registering cron jobs')
    registerJobs(newConfig.groups, db)
  })

  // 6. Graceful shutdown
  async function shutdown() {
    logger.info('shutting down...')
    stopWatcher()
    await server.close()
    await disconnect()
    await db.destroy()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  logger.error({ err }, 'fatal error during boot')
  process.exit(1)
})
