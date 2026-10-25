import type { FastifyPluginAsync } from 'fastify';
import { moduleHealth } from '../../plugins/module-guard.js';

// Health endpoints for load balancers, orchestrators and the admin System page.
//   /health/live   - the process is up (never touches dependencies, so a database outage
//                    does not get healthy processes killed and restarted in a loop)
//   /health/ready  - the process can serve traffic: database reachable
//   /health/status - every dependency and module, with "degraded" when an optional service
//                    (Redis, email, storage, scanner, replica) is down but the API still works

const startedAt = new Date();

export const healthRoutes: FastifyPluginAsync = async (app) => {
  const { db, cache, mailer, storage, scanner, realtime, config } = app.deps;

  // A friendly answer for anyone who opens the API address in a browser.
  app.get('/', { config: { rateLimit: false }, schema: { hide: true } }, async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return {
      name: 'CampusConnect API',
      version: 'v1',
      docs: config.enableApiDocs ? `${config.publicApiUrl}/docs` : null,
      health: `${config.publicApiUrl}/health/status`,
      app: config.webUrl,
    };
  });

  app.get('/health/live', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get('/health/ready', { config: { rateLimit: false } }, async (_request, reply) => {
    const dbPing = await db.ping();
    if (!dbPing.ok) return reply.status(503).send({ status: 'unavailable', database: dbPing });
    return { status: 'ready', database: dbPing };
  });

  app.get('/health/status', async (request) => {
    const [database, redis, mail, files, virus] = await Promise.all([
      db.ping(),
      cache.ping(),
      mailer.ping(),
      storage.ping(),
      scanner.ping(),
    ]);
    const optionalDown = [
      Boolean(cache.redis) && !redis.ok,
      !mail.ok,
      !files.ok,
      scanner.enabled && !virus.ok,
    ].some(Boolean);
    const modules = moduleHealth();
    const status = !database.ok ? 'down' : optionalDown || modules.some((m) => m.status !== 'ok') ? 'degraded' : 'ok';

    // Details are for staff; everyone else gets the overall status only.
    const isStaff = request.auth?.role === 'admin' || request.auth?.role === 'moderator';
    if (!isStaff) return { status, checkedAt: new Date().toISOString() };

    return {
      status,
      checkedAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      environment: config.env,
      pid: process.pid,
      memory: { rssMb: Math.round(process.memoryUsage().rss / 1e6), heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1e6) },
      dependencies: {
        database: { ...database, ...db.stats() },
        redis: { configured: Boolean(cache.redis), ...redis, cache: cache.status() },
        email: { ...mail, circuit: mailer.breaker.snapshot() },
        storage: { driver: storage.driverName, ...files, circuit: storage.breaker.snapshot() },
        scanner: { enabled: scanner.enabled, ...virus },
        realtime: realtime.stats(),
      },
      modules,
    };
  });
};
