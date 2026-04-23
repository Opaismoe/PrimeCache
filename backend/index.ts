import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { buildServer } from './api/server';
import { disconnect } from './browser/connection';
import { env } from './config/env';
import { resolveConfigSecrets } from './config/secrets';
import { loadConfig, watchConfig } from './config/urls';
import { db, destroyDb } from './db/client';
import { registerJobs, registerSessionSweep } from './scheduler/index';
import { logger } from './utils/logger';

async function main() {
  // 1. Run DB migrations — must complete before anything else starts
  const migrationsPath = path.resolve(__dirname, 'db', 'migrations');
  logger.info({ migrationsPath }, 'attempting migrations');

  // List migration files to debug
  const fs = await import('node:fs/promises');
  try {
    const files = await fs.readdir(migrationsPath);
    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();
    logger.info({ sqlFiles, count: sqlFiles.length }, 'found migration files');
  } catch (err) {
    logger.warn({ err }, 'failed to list migration files');
  }

  await migrate(db, { migrationsFolder: migrationsPath });
  logger.info('migrations complete');

  // 2. Load and validate config, then resolve secret: references
  let config = await resolveConfigSecrets(loadConfig(env.CONFIG_PATH), db);
  logger.info({ groups: config.groups.length }, 'config loaded');

  // 3. Start API server
  const server = await buildServer({ db, getConfig: () => config });
  await server.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'API server listening');

  // 4. Register cron jobs
  registerJobs(config.groups, db);
  registerSessionSweep(db);

  // 5. Watch config for live changes
  const stopWatcher = watchConfig(env.CONFIG_PATH, async (newConfig) => {
    try {
      config = await resolveConfigSecrets(newConfig, db);
      logger.info('config reloaded — re-registering cron jobs');
      registerJobs(config.groups, db);
    } catch (err) {
      logger.error({ err }, 'config reload failed — keeping previous config');
    }
  });

  // 6. Graceful shutdown
  async function shutdown() {
    logger.info('shutting down...');
    stopWatcher();
    await server.close();
    await disconnect();
    await destroyDb();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'fatal error during boot');
  process.exit(1);
});
