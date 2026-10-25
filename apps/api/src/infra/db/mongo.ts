import { MongoClient, MongoNetworkError, MongoServerError, MongoServerSelectionError, type ClientSession, type Collection, type Db, type Document, type TransactionOptions } from 'mongodb';
import type { Logger } from 'pino';
import { Errors } from '../../core/errors.js';
import type { CollectionName, Models } from './models.js';

// MongoDB access for the whole API.
//
//   * one client with a bounded connection pool, short server-selection and per-operation
//     timeouts (a slow or unreachable database fails fast instead of piling up requests)
//   * the API starts even while the database is down; /health/ready reports it and every request
//     that needs data answers a clear 503 until it is back (the driver reconnects by itself)
//   * reads may go to secondaries when a replica set has them; writes always go to the primary
//   * tx() runs a function in a multi-document transaction on a replica set (MongoDB Atlas, or a
//     local single-node replica set). On a standalone server it runs the same function without a
//     transaction: every write in this codebase is ordered so a partial run is safe to retry.

export interface MongoOptions {
  url: string;
  dbName: string;
  maxPoolSize: number;
  operationTimeoutMs: number;
  appName: string;
  logger: Logger;
}

const NETWORK_LABELS = new Set(['TransientTransactionError', 'RetryableWriteError', 'ResetPool']);

export function isConnectionError(err: unknown): boolean {
  if (err instanceof MongoServerSelectionError || err instanceof MongoNetworkError) return true;
  if (err instanceof MongoServerError && [...NETWORK_LABELS].some((l) => err.hasErrorLabel(l)) && err.code !== 112) return true;
  const name = (err as { name?: string })?.name ?? '';
  return /MongoNetworkTimeoutError|MongoPoolClearedError|MongoTopologyClosedError|MongoOperationTimeoutError/.test(name);
}

export class Mongo {
  readonly client: MongoClient;
  readonly db: Db;
  private readonly logger: Logger;
  private available = true;
  private replicaSet = false;
  private connecting?: Promise<void>;
  private checkedOut = 0;

  constructor(private readonly options: MongoOptions) {
    this.logger = options.logger;
    this.client = new MongoClient(options.url, {
      appName: options.appName,
      maxPoolSize: options.maxPoolSize,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 3_000,
      connectTimeoutMS: 3_000,
      // A socket timeout rather than the driver's client-wide timeoutMS: with timeoutMS set, mongodb 7.x
      // rejects insertMany/bulkWrite inside withTransaction ("An operation cannot be given a timeoutMS
      // setting..."), which broke sign-up on replica sets such as MongoDB Atlas.
      socketTimeoutMS: options.operationTimeoutMs,
      retryWrites: true,
      retryReads: true,
      readPreference: 'primaryPreferred',
      writeConcern: { w: 'majority', wtimeoutMS: 5_000 },
      ignoreUndefined: true,
    });
    this.db = this.client.db(options.dbName);
    this.client.on('serverHeartbeatFailed', () => this.setAvailable(false));
    this.client.on('serverHeartbeatSucceeded', () => this.setAvailable(true));
    this.client.on('connectionCheckedOut', () => (this.checkedOut += 1));
    this.client.on('connectionCheckedIn', () => (this.checkedOut = Math.max(0, this.checkedOut - 1)));
  }

  private setAvailable(ok: boolean) {
    if (ok === this.available) return;
    this.available = ok;
    if (ok) this.logger.info('database reachable again');
    else this.logger.error('database unreachable; answering 503 until it returns');
  }

  /** Connects in the background; safe to call many times. Never throws. */
  connect(): Promise<void> {
    this.connecting ??= this.client
      .connect()
      .then(async () => {
        const hello = await this.db.admin().command({ hello: 1 });
        this.replicaSet = Boolean(hello.setName);
        this.setAvailable(true);
        this.logger.info({ replicaSet: hello.setName ?? null }, this.replicaSet ? 'database connected (transactions on)' : 'database connected (standalone: no multi-document transactions)');
      })
      .catch((err) => {
        this.setAvailable(false);
        this.connecting = undefined;
        this.logger.error({ err: (err as Error).message }, 'database connection failed; will retry');
        setTimeout(() => void this.connect(), 5_000).unref();
      });
    return this.connecting;
  }

  get supportsTransactions(): boolean {
    return this.replicaSet;
  }

  col<N extends CollectionName>(name: N): Collection<Models[N]> {
    return this.db.collection<Models[N]>(name);
  }

  /** Raw collection access for migrations and admin scripts. */
  raw<T extends Document = Document>(name: string): Collection<T> {
    return this.db.collection<T>(name);
  }

  /**
   * Runs fn in a transaction when the server supports it (retrying transient errors), otherwise
   * directly. Pass the session to every operation inside: { session }.
   */
  async tx<T>(fn: (session: ClientSession | undefined) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    if (!this.replicaSet) return fn(undefined);
    const session = this.client.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await fn(session);
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, ...options });
      return result as T;
    } finally {
      await session.endSession();
    }
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const started = performance.now();
    try {
      await this.db.command({ ping: 1 }, { timeoutMS: 2_000 });
      this.setAvailable(true);
      return { ok: true, latencyMs: Math.round(performance.now() - started) };
    } catch (err) {
      this.setAvailable(false);
      return { ok: false, latencyMs: Math.round(performance.now() - started), error: (err as Error).message };
    }
  }

  stats() {
    return { available: this.available, replicaSet: this.replicaSet, transactions: this.replicaSet, connectionsInUse: this.checkedOut, maxPoolSize: this.options.maxPoolSize };
  }

  /** Converts driver errors into API errors (used by the global error handler). */
  static toAppError(err: unknown) {
    if (isConnectionError(err)) return Errors.unavailable('database');
    return null;
  }

  async close(): Promise<void> {
    await this.client.close().catch(() => undefined);
  }
}
