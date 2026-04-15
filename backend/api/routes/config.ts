import { writeFileSync } from 'node:fs';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import yaml from 'js-yaml';
import { z } from 'zod';
import { env } from '../../config/env';
import { ConfigSchema } from '../../config/urls';
import type { Db } from '../../db/client';
import { renameGroup } from '../../db/queries/runs';
import { renameGroupWebhookTokens } from '../../db/queries/webhookTokens';

const RenameSchema = z.array(z.object({ from: z.string(), to: z.string() })).optional();

export function putConfigRoute(db: Db): FastifyPluginAsync {
  return async (app) => {
    app.put('/config', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const { renames: rawRenames, ...rest } = body;

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
        await Promise.all([renameGroup(db, from, to), renameGroupWebhookTokens(db, from, to)]);
      }

      const yamlContent = yaml.dump(configResult.data);
      writeFileSync(env.CONFIG_PATH, yamlContent, 'utf-8');
      return { ok: true };
    });
  };
}
