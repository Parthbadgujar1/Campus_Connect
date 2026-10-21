import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { Errors } from '../core/errors.js';
import { SessionService } from '../modules/auth/session.service.js';

// Resolves the caller on every request:
//   web    - httpOnly session cookie + X-CSRF-Token header on state-changing requests
//   mobile - "Authorization: Bearer <token>" (no cookies, so no CSRF exposure)
// An invalid or expired session simply leaves request.auth = null; routes that need a signed-in
// person call requireAuth() and get a 401 the apps turn into "please sign in again".

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

declare module 'fastify' {
  interface FastifyInstance {
    sessions: SessionService;
  }
}

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  return m?.[1];
}

export default fp(
  async function auth(app: FastifyInstance) {
    const sessions = new SessionService(app.deps);
    app.decorate('sessions', sessions);
    app.decorateRequest('auth', null);

    app.addHook('onRequest', async (request, reply) => {
      const bearer = bearerToken(request);
      const cookieToken = request.cookies[app.deps.config.cookies.sessionName];
      const token = bearer ?? cookieToken;
      if (!token) return;

      const auth = await sessions.resolve(token, bearer ? 'bearer' : 'cookie');
      if (!auth) {
        // Stale cookie: clear it so the browser stops sending it.
        if (!bearer && cookieToken) sessions.clearCookies(reply);
        return;
      }

      if (auth.via === 'cookie' && UNSAFE.has(request.method)) {
        const provided = request.headers['x-csrf-token'];
        if (!sessions.verifyCsrf(auth.sessionId, typeof provided === 'string' ? provided : undefined)) {
          throw Errors.csrf();
        }
      }
      request.auth = auth;
    });
  },
  { name: 'auth', dependencies: ['security'] },
);
