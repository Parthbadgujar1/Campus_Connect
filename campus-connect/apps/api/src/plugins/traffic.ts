import { createHash } from 'node:crypto';
import { getHeapStatistics } from 'node:v8';
import rateLimit from '@fastify/rate-limit';
import underPressure from '@fastify/under-pressure';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AppError, Errors } from '../core/errors.js';
import { sendError } from './error-handler.js';

// Overload protection, in two layers:
//   1. Load shedding: when the event loop lags or memory runs high, new requests get an
//      immediate 503 with Retry-After instead of queueing until everything times out. The
//      process stays healthy and recovers as soon as the pressure drops.
//   2. Rate limiting: per signed-in person (or per IP for anonymous traffic), with stricter
//      limits on sensitive routes (sign-in, sign-up, password reset, contact form, uploads).
//      With Redis the limits are shared by all API processes; if Redis is down, limiting is
//      skipped rather than blocking everyone (availability over strictness), and the sign-in
//      lockout still works because it is stored in Postgres.

export default fp(
  async function traffic(app: FastifyInstance) {
    const { config, cache } = app.deps;
    const heapLimit = getHeapStatistics().heap_size_limit;

    await app.register(underPressure, {
      maxEventLoopDelay: 1_000,
      maxEventLoopUtilization: 0.98,
      maxHeapUsedBytes: Math.floor(heapLimit * 0.9),
      retryAfter: 10,
      exposeStatusRoute: false,
      pressureHandler: (request, reply, type, value) => {
        request.log.warn({ type, value }, 'load shedding: server under pressure');
        void sendError(request, reply, new AppError(503, 'OVERLOADED', 'CampusConnect is very busy right now. Please try again in a few seconds.', { retryAfterSeconds: 10 }));
      },
    });

    await app.register(rateLimit, {
      global: true,
      max: config.rateLimitPerMinute,
      timeWindow: '1 minute',
      hook: 'preHandler', // runs after auth, so signed-in people are limited per account
      redis: cache.redis,
      skipOnError: true,
      nameSpace: 'cc:rl:',
      keyGenerator: (request) => (request.auth ? `u:${request.auth.userId}` : `ip:${request.ipHash ?? request.ip}`),
      allowList: (request) => request.url.startsWith('/health'),
      errorResponseBuilder: (_request, context) => Errors.tooMany(Math.ceil(context.ttl / 1000)),
      addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true },
    });
  },
  { name: 'traffic', dependencies: ['auth'] },
);

// A whole campus usually reaches us through one public IP (college Wi-Fi NAT), so limits on
// account actions are per network AND email address: one attacker cannot lock every student out,
// and nobody can flood one person's inbox. Runs after validation, so the email is normalised.
function byNetworkAndEmail(request: FastifyRequest): string {
  const body = request.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email : request.auth?.userId ?? '-';
  return `acct:${request.ipHash ?? request.ip}:${email}`;
}

// Links from emails carry a 256-bit random token that cannot be guessed, so they are limited per
// token (stops hammering one link) rather than per network (which would block a whole campus
// verifying at the same time).
function byToken(request: FastifyRequest): string {
  const body = request.body as { token?: unknown } | undefined;
  const token = typeof body?.token === 'string' ? body.token : '';
  return token ? `tok:${createHash('sha256').update(token).digest('base64url').slice(0, 24)}` : `ip:${request.ipHash ?? request.ip}`;
}

/** Per-route limits for sensitive endpoints (spread into a route's `config`). */
export const limits = {
  signIn: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: byNetworkAndEmail } },
  signUp: { rateLimit: { max: 5, timeWindow: '10 minutes', keyGenerator: byNetworkAndEmail } },
  emailAction: { rateLimit: { max: 5, timeWindow: '15 minutes', keyGenerator: byNetworkAndEmail } },
  tokenAction: { rateLimit: { max: 10, timeWindow: '15 minutes', keyGenerator: byToken } },
  contact: { rateLimit: { max: 5, timeWindow: '1 hour', keyGenerator: byNetworkAndEmail } },
  upload: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
  write: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  report: { rateLimit: { max: 20, timeWindow: '1 hour' } },
} as const;
