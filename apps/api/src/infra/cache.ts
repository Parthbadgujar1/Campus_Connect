import { Redis } from 'ioredis';
import type { Logger } from 'pino';

// Cache with graceful degradation.
// Redis is used when it is reachable (shared across API processes). If Redis is down or not
// configured, the same calls fall back to a bounded in-process memory cache, so the API keeps
// working (slightly less efficiently) instead of failing. Nothing correctness-critical lives
// only in the cache: sessions, votes and messages are always in MongoDB.

export interface CacheStatus {
  backend: 'redis' | 'memory';
  redisConfigured: boolean;
  redisConnected: boolean;
}

class MemoryCache {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly maxEntries = 10_000) {}

  get(key: string): string | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    if (this.store.size >= this.maxEntries) {
      // Evict the oldest entry (Map preserves insertion order).
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  incr(key: string, ttlSeconds: number): number {
    const current = Number(this.get(key) ?? 0) + 1;
    const existing = this.store.get(key);
    this.store.set(key, { value: String(current), expiresAt: existing?.expiresAt ?? Date.now() + ttlSeconds * 1000 });
    return current;
  }
}

export class Cache {
  readonly redis?: Redis;
  private readonly memory = new MemoryCache();

  constructor(
    redisUrl: string | undefined,
    private readonly logger: Logger,
    private readonly prefix = 'cc:',
  ) {
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        // Fail fast while disconnected instead of queueing commands in memory.
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
        commandTimeout: 500,
        retryStrategy: (times) => Math.min(times * 500, 10_000),
      });
      let lastLogged = 0;
      this.redis.on('error', (err) => {
        // Log at most once every 30 s; the retry strategy reconnects in the background.
        if (Date.now() - lastLogged > 30_000) {
          lastLogged = Date.now();
          this.logger.warn({ err: err.message }, 'redis unavailable; using in-memory cache');
        }
      });
      this.redis.on('ready', () => this.logger.info('redis connected'));
      this.redis.connect().catch(() => undefined);
    }
  }

  get connected(): boolean {
    return this.redis?.status === 'ready';
  }

  status(): CacheStatus {
    return {
      backend: this.connected ? 'redis' : 'memory',
      redisConfigured: Boolean(this.redis),
      redisConnected: this.connected,
    };
  }

  async get<T>(key: string): Promise<T | null> {
    const k = this.prefix + key;
    let raw: string | null = null;
    if (this.connected) {
      try {
        raw = await this.redis!.get(k);
      } catch {
        raw = this.memory.get(k);
      }
    } else {
      raw = this.memory.get(k);
    }
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const k = this.prefix + key;
    const raw = JSON.stringify(value);
    if (this.connected) {
      try {
        await this.redis!.set(k, raw, 'EX', ttlSeconds);
        return;
      } catch {
        // fall through to memory
      }
    }
    this.memory.set(k, raw, ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    const full = keys.map((k) => this.prefix + k);
    for (const k of full) this.memory.del(k);
    if (this.connected && full.length) {
      await this.redis!.del(...full).catch(() => undefined);
    }
  }

  /** Atomic counter with expiry (used for per-account throttles). */
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const k = this.prefix + key;
    if (this.connected) {
      try {
        const results = await this.redis!.multi().incr(k).ttl(k).exec();
        const value = results?.[0]?.[1];
        const ttl = results?.[1]?.[1];
        // Set the expiry on the first increment only (TTL -1 means "no expiry yet").
        if (ttl === -1) await this.redis!.expire(k, ttlSeconds);
        if (typeof value === 'number') return value;
      } catch {
        // fall through to memory
      }
    }
    return this.memory.incr(k, ttlSeconds);
  }

  /** Read-through helper: returns the cached value or computes, caches and returns it. */
  async remember<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async ping(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    if (!this.redis) return { ok: false, error: 'not configured' };
    const started = performance.now();
    try {
      await this.redis.ping();
      return { ok: true, latencyMs: Math.round(performance.now() - started) };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async close(): Promise<void> {
    if (this.redis) await this.redis.quit().catch(() => this.redis?.disconnect());
  }
}
