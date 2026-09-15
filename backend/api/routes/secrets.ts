import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env';
import { listSecretRefs } from '../../config/secrets';
import type { Config } from '../../config/urls';
import type { Db } from '../../db/client';
import { deleteSecret, listSecrets, upsertSecret } from '../../db/queries/secrets';
import { encrypt } from '../../secrets/crypto';

export function secretsRoutes(db: Db, getConfig: () => Config): FastifyPluginAsync {
  return async (app) => {
    // GET /api/secrets — list names and timestamps, never values
    app.get(
      '/secrets',
      { config: { rateLimit: { max: 120, timeWindow: '1 minute' }, rateLimitCategory: 'read' } },
      async () => listSecrets(db),
    );

    // POST /api/secrets — upsert { name, value }
    app.post<{ Body: { name: string; value: string } }>(
      '/secrets',
      { config: { rateLimit: { max: 30, timeWindow: '1 minute' }, rateLimitCategory: 'write' } },
      async (
        request: FastifyRequest<{ Body: { name: string; value: string } }>,
        reply: FastifyReply,
      ) => {
        const { name, value } = request.body ?? {};
        if (!name || !value) return reply.code(400).send({ error: 'name and value are required' });
        const encrypted = encrypt(value, env.SECRET_ENCRYPTION_KEY);
        await upsertSecret(db, name, encrypted);
        return { name };
      },
    );

    // DELETE /api/secrets/:name — refused while the current config references it
    app.delete<{ Params: { name: string } }>(
      '/secrets/:name',
      { config: { rateLimit: { max: 30, timeWindow: '1 minute' }, rateLimitCategory: 'write' } },
      async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
        const { name } = request.params;
        const referencedBy = [
          ...new Set(
            listSecretRefs(getConfig())
              .filter((r) => r.name === name)
              .map((r) => r.group),
          ),
        ];
        if (referencedBy.length > 0) {
          return reply.code(409).send({
            error: `Secret "${name}" is referenced by group(s): ${referencedBy.join(', ')}`,
            referencedBy,
          });
        }
        const deleted = await deleteSecret(db, name);
        return { deleted };
      },
    );
  };
}
