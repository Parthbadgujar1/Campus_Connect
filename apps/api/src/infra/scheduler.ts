import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { Mongo } from './db/mongo.js';

// Background jobs on timers. Each job takes a lease (a document in job_locks with an expiry) before
// running, so with several API processes only one runs a given job at a time; if that process
// dies, the lease simply expires and another process takes over. Each run is recorded in job_runs
// for the admin System page. A failing job is logged and retried on its next tick.

export interface JobContext {
  logger: Logger;
  signal: AbortSignal;
}

export interface JobDefinition {
  name: string;
  intervalMs: number;
  /** Run shortly after start-up instead of waiting a full interval. */
  runOnStart?: boolean;
  /** Longest a run may take before another process may take over (default: 5 minutes). */
  leaseMs?: number;
  run: (ctx: JobContext) => Promise<string | void>;
}

export class Scheduler {
  private readonly jobs: JobDefinition[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly controller = new AbortController();
  private readonly owner = `${process.pid}:${randomUUID().slice(0, 8)}`;
  private stopped = false;

  constructor(
    private readonly db: Mongo,
    private readonly logger: Logger,
  ) {}

  register(job: JobDefinition): void {
    this.jobs.push(job);
  }

  list(): Array<{ name: string; intervalMs: number }> {
    return this.jobs.map((j) => ({ name: j.name, intervalMs: j.intervalMs }));
  }

  start(): void {
    for (const job of this.jobs) {
      // Jitter spreads processes so they do not all wake at once.
      const first = (job.runOnStart ? 2_000 : job.intervalMs) + Math.floor(Math.random() * 1_000);
      this.schedule(job, first);
    }
  }

  private schedule(job: JobDefinition, delay: number): void {
    if (this.stopped) return;
    const timer = setTimeout(() => {
      const p = this.execute(job).finally(() => {
        this.running.delete(job.name);
        this.schedule(job, job.intervalMs);
      });
      this.running.set(job.name, p);
    }, delay);
    timer.unref();
    this.timers.set(job.name, timer);
  }

  /** Runs a job once now (used by tests and the admin "run now" action). */
  async runNow(name: string): Promise<boolean> {
    const job = this.jobs.find((j) => j.name === name);
    if (!job) return false;
    await this.execute(job, true);
    return true;
  }

  private async acquire(job: JobDefinition): Promise<boolean> {
    const now = new Date();
    try {
      const res = await this.db.col('job_locks').findOneAndUpdate(
        { _id: job.name, $or: [{ lockedUntil: { $lt: now } }, { owner: this.owner }] },
        { $set: { owner: this.owner, lockedUntil: new Date(now.getTime() + (job.leaseMs ?? 5 * 60_000)) } },
        { upsert: true, returnDocument: 'after' },
      );
      return res?.owner === this.owner;
    } catch (err) {
      // Duplicate key on upsert: another process holds a live lease.
      if ((err as { code?: number }).code === 11000) return false;
      throw err;
    }
  }

  private async release(name: string): Promise<void> {
    await this.db.col('job_locks').updateOne({ _id: name, owner: this.owner }, { $set: { lockedUntil: new Date(0) } }).catch(() => undefined);
  }

  private async execute(job: JobDefinition, manual = false): Promise<void> {
    if (this.stopped) return;
    let locked = false;
    const started = Date.now();
    try {
      locked = await this.acquire(job);
      if (!locked) return; // another process is running it
      await this.record(job.name, 'start');
      const note = await job.run({ logger: this.logger.child({ job: job.name }), signal: this.controller.signal });
      await this.record(job.name, 'ok', Date.now() - started);
      if (note) this.logger[manual ? 'info' : 'debug']({ job: job.name, note }, 'job finished');
    } catch (err) {
      this.logger.error({ err, job: job.name }, 'job failed');
      await this.record(job.name, 'error', Date.now() - started, (err as Error).message);
    } finally {
      if (locked) await this.release(job.name);
    }
  }

  private async record(job: string, status: 'start' | 'ok' | 'error', durationMs?: number, error?: string): Promise<void> {
    try {
      const runs = this.db.col('job_runs');
      if (status === 'start') {
        await runs.updateOne({ _id: job }, { $set: { lastStartedAt: new Date() }, $inc: { runCount: 1 }, $setOnInsert: { lastFinishedAt: null, lastStatus: null, lastError: null, lastDurationMs: null } }, { upsert: true });
      } else {
        await runs.updateOne({ _id: job }, { $set: { lastFinishedAt: new Date(), lastStatus: status, lastError: error?.slice(0, 1000) ?? null, lastDurationMs: durationMs ?? null } });
      }
    } catch {
      // bookkeeping must never break a job
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.controller.abort();
    for (const t of this.timers.values()) clearTimeout(t);
    await Promise.allSettled([...this.running.values()]);
  }
}
