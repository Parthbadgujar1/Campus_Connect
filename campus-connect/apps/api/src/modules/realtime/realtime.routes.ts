import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { hmac, safeEqual } from '../../core/crypto.js';
import { requireAuth } from '../../core/guards.js';

// /v1/realtime — live updates over a WebSocket.
//
// 1. GET /v1/realtime/ticket (normal authenticated request) returns a ticket valid for 60 s.
// 2. The client opens ws(s)://.../v1/realtime?ticket=... and subscribes to the chats it shows.
// Tickets avoid sending session cookies or tokens in WebSocket URLs (they end up in logs), and a
// page on another site cannot open an authenticated socket because it cannot get a ticket.
// If the socket drops, clients reconnect with a new ticket and catch up through the REST API.

const TICKET_TTL_SECONDS = 60;

export const realtimeRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { config, db, realtime } = app.deps;
  const allowedOrigins = new Set(config.webOrigins);

  app.get('/ticket', { schema: { tags: ['realtime'], summary: 'A short-lived ticket to open the live connection' } }, async (request) => {
    const auth = requireAuth(request);
    const exp = Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS;
    const body = `${auth.userId}.${auth.sessionId}.${exp}`;
    const ticket = `${body}.${hmac(config.secrets.session, `ws:${body}`)}`;
    const url = `${config.publicApiUrl.replace(/^http/, 'ws')}/v1/realtime?ticket=${encodeURIComponent(ticket)}`;
    return { ticket, url, expiresAt: new Date(exp * 1000).toISOString() };
  });

  app.get(
    '/',
    { websocket: true, config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, schema: { hide: true, querystring: z.object({ ticket: z.string().max(300) }) } },
    async (socket, request) => {
      const reject = (code: number, reason: string) => socket.close(code, reason);
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.has(origin)) return reject(4403, 'origin not allowed');
      const parts = request.query.ticket.split('.');
      if (parts.length !== 4) return reject(4401, 'invalid ticket');
      const [userId, sessionId, expRaw, sig] = parts as [string, string, string, string];
      const exp = Number(expRaw);
      if (!Number.isFinite(exp) || exp < Date.now() / 1000) return reject(4401, 'ticket expired');
      if (!safeEqual(sig, hmac(config.secrets.session, `ws:${userId}.${sessionId}.${exp}`))) return reject(4401, 'invalid ticket');
      // The session must still be valid (not signed out or expired since the ticket was issued).
      const now = new Date();
      const s = await db.col('sessions').findOne({ _id: sessionId, userId, revokedAt: null, idleExpiresAt: { $gt: now }, absoluteExpiresAt: { $gt: now } }, { projection: { _id: 1 } });
      const u = s ? await db.col('users').findOne({ _id: userId, status: 'active' }, { projection: { 'profile.displayName': 1 } }) : null;
      if (!s || !u) return reject(4401, 'session ended');
      realtime.attach(socket, { id: userId, name: u.profile.displayName });
    },
  );

  // Online / last seen: remember when someone was last active, and tell others when they come
  // and go, unless they turned off "last seen & online" (Settings → Privacy).
  realtime.onPresence((userId, online) => {
    const at = new Date();
    void db
      .col('users')
      .findOneAndUpdate({ _id: userId }, { $set: { lastActiveAt: at } }, { projection: { 'profile.visibility.showOnline': 1 } })
      .then((u) => {
        if (u && u.profile?.visibility?.showOnline !== false) realtime.toAll({ type: 'presence', userId, online, at: at.toISOString() });
      })
      .catch(() => undefined);
  });
};
