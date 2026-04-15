import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../../config/urls';
import type { Db } from '../../db/client';
import {
  createWebhookToken,
  deleteWebhookToken,
  findWebhookToken,
  listWebhookTokens,
  setWebhookTokenActive,
  touchWebhookToken,
} from '../../db/queries/webhookTokens';
import { logger } from '../../utils/logger';
import { startRunGroup } from '../../warmer/runner';

// ── Protected management routes: /api/groups/:name/webhooks ──────────────────

export function webhookManagementRoutes(db: Db, getConfig: () => Config): FastifyPluginAsync {
  return async (app) => {
    // GET /api/groups/:name/webhooks — list tokens (no token values returned)
    app.get<{ Params: { name: string } }>(
      '/groups/:name/webhooks',
      async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
        const { name } = request.params;
        const group = getConfig().groups.find((g) => g.name === name);
        if (!group) return reply.code(404).send({ error: `Unknown group "${name}"` });
        return listWebhookTokens(db, name);
      },
    );

    // POST /api/groups/:name/webhooks — create a token (returned once)
    app.post<{ Params: { name: string }; Body: { description?: string } }>(
      '/groups/:name/webhooks',
      async (
        request: FastifyRequest<{ Params: { name: string }; Body: { description?: string } }>,
        reply: FastifyReply,
      ) => {
        const { name } = request.params;
        const group = getConfig().groups.find((g) => g.name === name);
        if (!group) return reply.code(404).send({ error: `Unknown group "${name}"` });
        const row = await createWebhookToken(db, {
          groupName: name,
          description: request.body?.description,
        });
        return row;
      },
    );

    // DELETE /api/groups/:name/webhooks/:id — remove a token
    app.delete<{ Params: { name: string; id: string } }>(
      '/groups/:name/webhooks/:id',
      async (
        request: FastifyRequest<{ Params: { name: string; id: string } }>,
        reply: FastifyReply,
      ) => {
        const id = Number(request.params.id);
        const deleted = await deleteWebhookToken(db, id);
        if (!deleted) return reply.code(404).send({ error: 'Webhook token not found' });
        return { deleted: true };
      },
    );

    // PATCH /api/groups/:name/webhooks/:id — toggle active
    app.patch<{ Params: { name: string; id: string }; Body: { active: boolean } }>(
      '/groups/:name/webhooks/:id',
      async (
        request: FastifyRequest<{
          Params: { name: string; id: string };
          Body: { active: boolean };
        }>,
        reply: FastifyReply,
      ) => {
        const id = Number(request.params.id);
        const { active } = request.body ?? {};
        if (typeof active !== 'boolean')
          return reply.code(400).send({ error: '"active" must be a boolean' });
        const updated = await setWebhookTokenActive(db, id, active);
        if (!updated) return reply.code(404).send({ error: 'Webhook token not found' });
        return { id, active };
      },
    );
  };
}

// ── Public inbound trigger route: POST /webhook/trigger/:token ────────────────

export function webhookTriggerRoute(db: Db, getConfig: () => Config): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Params: { token: string } }>(
      '/webhook/trigger/:token',
      async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
        const { token } = request.params;

        const row = await findWebhookToken(db, token);

        // Return 404 for both unknown and inactive tokens to avoid enumeration
        if (!row?.active) return reply.code(404).send({ error: 'Not found' });

        const group = getConfig().groups.find((g) => g.name === row.group_name);
        if (!group) return reply.code(404).send({ error: 'Not found' });

        // Update last_used_at without blocking the response
        touchWebhookToken(db, row.id).catch((err) =>
          logger.warn({ err, tokenId: row.id }, 'failed to update webhook token last_used_at'),
        );

        const { runId, promise } = await startRunGroup(db, group);
        promise
          .then(() =>
            logger.info(
              { group: group.name, runId, tokenId: row.id },
              'webhook trigger run complete',
            ),
          )
          .catch((err) =>
            logger.error(
              { group: group.name, runId, tokenId: row.id, err },
              'webhook trigger run failed',
            ),
          );

        return { queued: true, runId };
      },
    );
  };
}
