import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import type { WarmGroup } from '../config/urls';
import type { Db } from '../db/client';
import { deleteExpiredSessions } from '../db/queries/sessions';
import { logger } from '../utils/logger';
import { runGroup } from '../warmer/runner';

const jobs: ScheduledTask[] = [];

export function registerJobs(groups: WarmGroup[], db: Db): void {
  // Tear down existing jobs first
  for (const j of jobs) j.destroy();
  jobs.length = 0;

  for (const group of groups) {
    const task = cron.schedule(
      group.schedule,
      () => {
        logger.info({ group: group.name }, 'cron triggered warm run');
        runGroup(db, group).catch((err) =>
          logger.error({ group: group.name, err }, 'scheduled run failed'),
        );
      },
      { timezone: env.TIMEZONE },
    );
    jobs.push(task);
    logger.info({ group: group.name, schedule: group.schedule }, 'cron job registered');
  }
}

export function registerSessionSweep(db: Db): void {
  cron.schedule('0 * * * *', () => {
    deleteExpiredSessions(db)
      .then((n) => n > 0 && logger.info({ deleted: n }, 'expired sessions swept'))
      .catch((err) => logger.warn({ err }, 'session sweep failed'));
  });
  logger.info('session sweep job registered');
}
