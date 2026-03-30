import { writeFileSync } from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import yaml from 'js-yaml';
import { z } from 'zod';
import { env } from '../../config/env';
import { ConfigSchema } from '../../config/urls';
import type { Db } from '../../db/client';
import { renameGroup } from '../../db/queries/runs';

const RenameSchema = z.array(z.object({ from: z.string(), to: z.string() })).optional();

export function putConfigRoute(db: Db): FastifyPluginAsync {
  return async (app) => {
    app.put('/config', async (request: any, reply: any) => {
      const { renames: rawRenames, ...rest } = request.body ?? {};

      const configResult = ConfigSchema.safeParse(rest);
      if (!configResult.success) {
        return reply.code(400).send({ error: 'Invalid config', issues: configResult.error.issues });
      }

      const renamesResult = RenameSchema.safeParse(rawRenames);
      if (!renamesResult.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid renames', issues: renamesResult.error.issues });
      }

      for (const { from, to } of renamesResult.data ?? []) {
        await renameGroup(db, from, to);
      }

      const yamlContent = yaml.dump(configResult.data);
      writeFileSync(env.CONFIG_PATH, yamlContent, 'utf-8');
      return { ok: true };
    });
  };
}
