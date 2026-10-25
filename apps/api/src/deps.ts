import type { Logger } from 'pino';
import type { Config } from './config/env.js';
import { Cache } from './infra/cache.js';
import { Mongo } from './infra/db/mongo.js';
import { Mailer } from './infra/mail/mailer.js';
import { RealtimeHub } from './infra/realtime.js';
import { Scanner } from './infra/scanner.js';
import { Scheduler } from './infra/scheduler.js';
import { Storage } from './infra/storage.js';
import { FlagsService } from './modules/flags/flags.service.js';
import { Notifier } from './modules/notifications/notifier.js';

// The dependency container. Every external system is created here once and handed to modules,
// which keeps modules free of global state and lets tests swap any dependency.

export interface Deps {
  config: Config;
  logger: Logger;
  db: Mongo;
  cache: Cache;
  storage: Storage;
  scanner: Scanner;
  mailer: Mailer;
  realtime: RealtimeHub;
  flags: FlagsService;
  scheduler: Scheduler;
  notifier: Notifier;
}

export function createDeps(config: Config, logger: Logger): Deps {
  const db = new Mongo({
    url: config.db.url,
    dbName: config.db.name,
    maxPoolSize: config.db.poolMax,
    operationTimeoutMs: config.db.operationTimeoutMs,
    appName: 'campusconnect-api',
    logger,
  });
  void db.connect();
  const deps: Omit<Deps, 'notifier'> & { notifier?: Notifier } = {
    config,
    logger,
    db,
    cache: new Cache(config.redisUrl, logger),
    storage: new Storage(config),
    scanner: new Scanner(config.scanner),
    mailer: new Mailer(config, db, logger),
    realtime: new RealtimeHub(config.redisUrl, logger),
    flags: new FlagsService(db, logger),
    scheduler: new Scheduler(db, logger),
  };
  // The notifier uses the other dependencies, so it is created last.
  deps.notifier = new Notifier(deps as Deps);
  return deps as Deps;
}

export async function closeDeps(deps: Deps): Promise<void> {
  await deps.scheduler.stop();
  await deps.realtime.close();
  deps.mailer.close();
  await Promise.allSettled([deps.cache.close(), deps.db.close()]);
}
