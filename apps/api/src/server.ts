import { buildApp } from './app.js';
import { loadEnvFile, parseConfig } from './config/env.js';
import { createLogger } from './core/logger.js';
import { closeDeps, createDeps } from './deps.js';
import { applySchema, schemaIsCurrent } from './infra/db/migrate.js';
import { ensureSharedCommunity } from './infra/db/platform.js';
import { registerJobs } from './jobs/index.js';

// Process entry point: configuration -> dependencies -> app -> listen, plus graceful shutdown.
// On SIGINT/SIGTERM the server stops accepting connections, lets in-flight requests finish
// (up to 15 s), closes WebSockets with "server restarting" so clients reconnect elsewhere,
// stops background jobs and closes database and Redis connections.

async function main() {
  loadEnvFile();
  const config = parseConfig();
  const logger = createLogger(config);
  const deps = createDeps(config, logger);

  // Collections, validators and indexes are applied on start-up when schema.ts changed (each step
  // is idempotent, so several processes starting together is safe). If the database is not
  // reachable yet, the server still starts; health checks report it and requests answer 503.
  try {
    await deps.db.connect();
    if (!(await schemaIsCurrent(deps.db.db))) {
      const result = await applySchema(deps.db.db, (m) => logger.debug(m));
      logger.info({ checksum: result.checksum, created: result.created.length, indexes: result.indexesCreated }, 'database schema applied');
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'could not check the database schema (database unreachable?)');
  }

  // Email confirmation is off, so accounts an earlier sign-up left waiting for it can never be
  // confirmed: activate them as students (they could not sign in or appear in people lists), and close
  // any faculty/expert requests, since sign-up is student-only for now.
  if (!config.requireEmailVerification) {
    try {
      const now = new Date();
      const activated = await deps.db.col('users').updateMany({ status: 'pending' }, { $set: { status: 'active', pendingRole: null, updatedAt: now } });
      await deps.db.col('verification_requests').updateMany(
        { status: 'pending', kind: { $in: ['faculty_role', 'expert_role'] } },
        { $set: { status: 'rejected', reviewerNote: 'Sign-up is student-only for now.', reviewedAt: now, updatedAt: now } },
      );
      if (activated.modifiedCount) logger.info({ count: activated.modifiedCount }, 'activated accounts that were waiting for email confirmation');
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'could not activate pending accounts');
    }
  }

  // One shared community: everyone sees everyone (see platform.ts).
  try {
    await ensureSharedCommunity(deps.db, logger);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'could not merge colleges into the shared community');
  }

  // Spaces go live as soon as they are created now, so release any that were waiting for approval.
  try {
    const released = await deps.db.col('spaces').updateMany({ status: 'pending' }, { $set: { status: 'active', updatedAt: new Date() } });
    if (released.modifiedCount) logger.info({ count: released.modifiedCount }, 'released spaces that were waiting for approval');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'could not release pending spaces');
  }

  const app = await buildApp(deps);
  if (config.jobsEnabled) {
    registerJobs(deps);
    deps.scheduler.start();
  }

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => {
      logger.error('forced exit after shutdown timeout');
      process.exit(1);
    }, 15_000);
    force.unref();
    try {
      await app.close();
      await closeDeps(deps);
    } finally {
      clearTimeout(force);
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandled promise rejection'));
  process.on('uncaughtException', (err) => {
    // State may be corrupt: log, close cleanly, and let the supervisor start a fresh process.
    logger.fatal({ err }, 'uncaught exception');
    void shutdown('uncaughtException');
  });

  await app.listen({ host: config.host, port: config.port });
  logger.info(`CampusConnect API listening on http://${config.host}:${config.port} (docs: ${config.enableApiDocs ? '/docs' : 'off'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
