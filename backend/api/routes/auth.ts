import { randomBytes } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import '@fastify/cookie';
import { env } from '../../config/env';
import type { Db } from '../../db/client';
import { createSession, deleteSession } from '../../db/queries/sessions';
import { safeEqual } from '../../utils/crypto';

const SESSION_MAX_AGE_S = 43_200; // 12 hours

function cookieOpts(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  };
}

export function authRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // POST /api/auth/login — verify admin creds, issue session + CSRF cookies
    app.post<{ Body: { username?: string; password?: string } }>(
      '/auth/login',
      async (request, reply) => {
        const { username, password } = request.body ?? {};
        if (!username || !password)
          return reply.code(400).send({ error: 'username and password required' });

        const userOk = safeEqual(username, env.ADMIN_USERNAME);
        const passOk = safeEqual(password, env.ADMIN_PASSWORD);
        if (!(userOk && passOk)) return reply.code(401).send({ error: 'Unauthorized' });

        const sessionId = randomBytes(32).toString('hex');
        const csrfToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_S * 1000);

        await createSession(db, { id: sessionId, csrfToken, expiresAt });

        const secure = env.COOKIE_SECURE;
        reply
          .setCookie('pc_session', sessionId, cookieOpts(secure))
          .setCookie('pc_csrf', csrfToken, {
            httpOnly: false, // must be readable by JS for double-submit pattern
            secure,
            sameSite: 'strict',
            path: '/',
            maxAge: SESSION_MAX_AGE_S,
          })
          .send({ ok: true });
      },
    );

    // POST /api/auth/logout — delete session, clear cookies
    app.post('/auth/logout', async (request, reply) => {
      const sessionId = (request.cookies as Record<string, string | undefined>).pc_session;
      if (sessionId) {
        await deleteSession(db, sessionId).catch(() => {});
      }
      reply
        .clearCookie('pc_session', { path: '/' })
        .clearCookie('pc_csrf', { path: '/' })
        .send({ ok: true });
    });
  };
}
