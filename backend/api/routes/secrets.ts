import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env';
import type { Db } from '../../db/client';
import { deleteSecret, listSecrets, upsertSecret } from '../../db/queries/secrets';
import { encrypt } from '../../secrets/crypto';

export function secretsRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // GET /api/secrets — list names and timestamps, never values
    app.get('/secrets', async () => listSecrets(db));

    // POST /api/secrets — upsert { name, value }
    app.post<{ Body: { name: string; value: string } }>(
      '/secrets',
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

    // DELETE /api/secrets/:name
    app.delete<{ Params: { name: string } }>(
      '/secrets/:name',
      async (request: FastifyRequest<{ Params: { name: string } }>) => {
        const deleted = await deleteSecret(db, request.params.name);
        return { deleted };
      },
    );
  };
}
