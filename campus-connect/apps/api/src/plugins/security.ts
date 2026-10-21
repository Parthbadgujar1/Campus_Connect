import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hashIp } from '../core/crypto.js';
import { Errors } from '../core/errors.js';

// HTTP hardening:
//   * security headers (HSTS in production, nosniff, frame denial, strict CSP for a JSON API)
//   * CORS limited to the configured web origins, with credentials
//   * Origin check on every state-changing request from a browser: a page on another site
//     cannot make the API act on a signed-in person's behalf (CSRF), even before the per-session
//     CSRF token check in the auth plugin
//   * keyed IP hash for rate limits and audit, so raw IP addresses are not stored

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default fp(
  async function security(app: FastifyInstance) {
    const { config } = app.deps;
    const allowed = new Set(config.webOrigins);

    await app.register(cookie, { hook: 'onRequest' });

    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
          // The interactive API docs (/docs) need scripts, styles and images from self.
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
      hsts: config.isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: false } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    });

    await app.register(cors, {
      origin: (origin, cb) => {
        // Requests without an Origin header (mobile apps, curl, server-to-server) are allowed
        // through CORS; they cannot carry a browser's cookies cross-site anyway.
        if (!origin || allowed.has(origin)) cb(null, true);
        else cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['content-type', 'x-csrf-token', 'x-request-id', 'x-client', 'authorization', 'idempotency-key'],
      exposedHeaders: ['x-request-id', 'retry-after', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset'],
      maxAge: 600,
    });

    app.decorateRequest('ipHash', null);
    app.addHook('onRequest', async (request) => {
      request.ipHash = hashIp(config.secrets.ipHash, request.ip);
      if (UNSAFE.has(request.method)) {
        const origin = request.headers.origin;
        if (origin && !allowed.has(origin)) throw Errors.csrf();
        if (!origin) {
          // Some browsers omit Origin on same-origin requests; fall back to Referer.
          const referer = request.headers.referer;
          if (referer) {
            try {
              if (!allowed.has(new URL(referer).origin)) throw Errors.csrf();
            } catch (err) {
              if (err instanceof Error && err.name === 'AppError') throw err;
              throw Errors.csrf();
            }
          }
        }
      }
    });

    app.addHook('onSend', async (_request, reply, payload) => {
      // API responses are personal: never let shared caches keep them.
      if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store');
      return payload;
    });
  },
  { name: 'security', dependencies: [] },
);
