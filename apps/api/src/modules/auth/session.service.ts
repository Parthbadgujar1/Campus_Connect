import type { FastifyReply } from 'fastify';
import type { ClientSession } from 'mongodb';
import { hmac, randomToken, safeEqual, sha256Hex } from '../../core/crypto.js';
import type { Deps } from '../../deps.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { AuthContext, Role } from '../../types/fastify.js';

// Server-side sessions.
//   * the client holds an opaque random token (cookie for the web, bearer token for mobile);
//     the database stores only its SHA-256 hash
//   * two expiries: idle (renewed while the person is active) and absolute (hard limit)
//   * staff accounts get shorter sessions than students
//   * a resolved session is cached for a few seconds to spare the database; revoking deletes the
//     cache entry, so sign-out and "sign out everywhere" take effect immediately
//   * a TTL index removes session documents a week after they can no longer be used

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const CACHE_TTL_SECONDS = 15;
const TOUCH_INTERVAL_MS = MINUTE;

interface Policy {
  idleMs: number;
  absoluteMs: number;
  persistent: boolean;
}

export function sessionPolicy(role: Role, kind: 'web' | 'mobile', rememberMe: boolean): Policy {
  if (role === 'admin' || role === 'moderator') {
    return { idleMs: 2 * HOUR, absoluteMs: 12 * HOUR, persistent: false };
  }
  if (kind === 'mobile') return { idleMs: 30 * DAY, absoluteMs: 90 * DAY, persistent: true };
  return rememberMe ? { idleMs: 14 * DAY, absoluteMs: 30 * DAY, persistent: true } : { idleMs: 12 * HOUR, absoluteMs: 7 * DAY, persistent: false };
}

interface CachedSession {
  sessionId: string;
  userId: string;
  collegeId: string;
  role: Role;
  status: AuthContext['status'];
  kind: 'web' | 'mobile';
  displayName: string;
  username: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  persistent: boolean;
}

export interface CreatedSession {
  token: string;
  sessionId: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  persistent: boolean;
}

export class SessionService {
  constructor(private readonly deps: Deps) {}

  private cacheKey(tokenHash: string): string {
    return `session:${tokenHash}`;
  }

  csrfTokenFor(sessionId: string): string {
    return hmac(this.deps.config.secrets.session, `csrf:${sessionId}`);
  }

  verifyCsrf(sessionId: string, provided: string | undefined): boolean {
    return Boolean(provided) && safeEqual(provided!, this.csrfTokenFor(sessionId));
  }

  async create(
    input: { userId: string; role: Role; kind: 'web' | 'mobile'; rememberMe: boolean; ipHash: string | null; userAgent?: string },
    session?: ClientSession,
  ): Promise<CreatedSession> {
    const policy = sessionPolicy(input.role, input.kind, input.rememberMe);
    const token = randomToken('ccs');
    const now = Date.now();
    const absolute = new Date(now + policy.absoluteMs);
    const idle = new Date(Math.min(now + policy.idleMs, absolute.getTime()));
    const id = uuidv7();
    await this.deps.db.col('sessions').insertOne(
      {
        _id: id,
        userId: input.userId,
        tokenHash: sha256Hex(token),
        kind: input.kind,
        persistent: policy.persistent,
        ipHash: input.ipHash,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        deviceLabel: describeDevice(input.userAgent),
        createdAt: new Date(now),
        lastSeenAt: new Date(now),
        idleExpiresAt: idle,
        absoluteExpiresAt: absolute,
        revokedAt: null,
        revokeReason: null,
        expireAt: new Date(absolute.getTime() + 7 * DAY),
      },
      { session },
    );
    return { token, sessionId: id, idleExpiresAt: idle, absoluteExpiresAt: absolute, persistent: policy.persistent };
  }

  /** Resolves a raw token to an auth context, renewing the idle expiry while it is in use. */
  async resolve(token: string, via: 'cookie' | 'bearer'): Promise<AuthContext | null> {
    if (!/^ccs_[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const tokenHash = sha256Hex(token);
    const key = this.cacheKey(tokenHash);
    let s = await this.deps.cache.get<CachedSession>(key);

    if (!s) {
      const row = await this.deps.db.col('sessions').findOne({ tokenHash, revokedAt: null });
      if (!row) return null;
      const user = await this.deps.db.col('users').findOne({ _id: row.userId }, { projection: { collegeId: 1, role: 1, status: 1, 'profile.displayName': 1, 'profile.username': 1 } });
      if (!user) return null;
      s = {
        sessionId: row._id,
        userId: row.userId,
        collegeId: user.collegeId,
        role: user.role,
        status: user.status,
        kind: row.kind,
        displayName: user.profile.displayName,
        username: user.profile.username,
        lastSeenAt: row.lastSeenAt.toISOString(),
        idleExpiresAt: row.idleExpiresAt.toISOString(),
        absoluteExpiresAt: row.absoluteExpiresAt.toISOString(),
        persistent: row.persistent,
      };
      await this.deps.cache.set(key, s, CACHE_TTL_SECONDS);
    }

    const now = Date.now();
    if (new Date(s.idleExpiresAt).getTime() <= now || new Date(s.absoluteExpiresAt).getTime() <= now) {
      await this.deps.cache.del(key);
      return null;
    }
    if (s.status === 'suspended' || s.status === 'deleted') return null;

    // Sliding expiry, written at most once a minute per session.
    if (now - new Date(s.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
      const policy = sessionPolicy(s.role, s.kind, s.persistent);
      const nextIdle = new Date(Math.min(now + policy.idleMs, new Date(s.absoluteExpiresAt).getTime()));
      s.lastSeenAt = new Date(now).toISOString();
      s.idleExpiresAt = nextIdle.toISOString();
      await this.deps.cache.set(key, s, CACHE_TTL_SECONDS);
      this.deps.db
        .col('sessions')
        .updateOne({ _id: s.sessionId, revokedAt: null }, { $set: { lastSeenAt: new Date(now), idleExpiresAt: nextIdle } })
        .catch((err) => this.deps.logger.warn({ err: (err as Error).message }, 'session touch failed'));
    }

    return {
      userId: s.userId,
      collegeId: s.collegeId,
      role: s.role,
      status: s.status,
      sessionId: s.sessionId,
      sessionKind: s.kind,
      via,
      displayName: s.displayName,
      username: s.username,
    };
  }

  async revoke(sessionId: string, reason: string, userId?: string): Promise<boolean> {
    const row = await this.deps.db.col('sessions').findOneAndUpdate(
      { _id: sessionId, revokedAt: null, ...(userId ? { userId } : {}) },
      { $set: { revokedAt: new Date(), revokeReason: reason } },
      { projection: { tokenHash: 1 } },
    );
    if (row) await this.deps.cache.del(this.cacheKey(row.tokenHash));
    return Boolean(row);
  }

  /** Revokes every session of a person (optionally keeping the current one). */
  async revokeAll(userId: string, reason: string, exceptSessionId?: string, session?: ClientSession): Promise<number> {
    const filter = { userId, revokedAt: null, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) };
    const rows = await this.deps.db.col('sessions').find(filter, { projection: { tokenHash: 1 }, session }).toArray();
    if (!rows.length) return 0;
    await this.deps.db.col('sessions').updateMany({ _id: { $in: rows.map((r) => r._id) } }, { $set: { revokedAt: new Date(), revokeReason: reason } }, { session });
    await this.deps.cache.del(...rows.map((r) => this.cacheKey(r.tokenHash)));
    return rows.length;
  }

  /** Drops cached copies after a change to the person's role, name or status. */
  async invalidateUser(userId: string): Promise<void> {
    const rows = await this.deps.db.col('sessions').find({ userId, revokedAt: null }, { projection: { tokenHash: 1 } }).toArray();
    await this.deps.cache.del(...rows.map((r) => this.cacheKey(r.tokenHash)));
  }

  setCookies(reply: FastifyReply, session: { token: string; sessionId: string; absoluteExpiresAt: Date; persistent: boolean }): void {
    const { cookies } = this.deps.config;
    const maxAge = session.persistent ? Math.floor((session.absoluteExpiresAt.getTime() - Date.now()) / 1000) : undefined;
    const base = { path: '/', secure: cookies.secure, sameSite: 'lax' as const, domain: cookies.domain, maxAge };
    reply.setCookie(cookies.sessionName, session.token, { ...base, httpOnly: true });
    // Readable by the web app, which echoes it in the X-CSRF-Token header (double submit).
    reply.setCookie(cookies.csrfName, this.csrfTokenFor(session.sessionId), { ...base, httpOnly: false });
  }

  clearCookies(reply: FastifyReply): void {
    const { cookies } = this.deps.config;
    const base = { path: '/', secure: cookies.secure, sameSite: 'lax' as const, domain: cookies.domain };
    reply.clearCookie(cookies.sessionName, base);
    reply.clearCookie(cookies.csrfName, base);
  }
}

/** A readable label such as "Chrome on Windows" for the sessions list. */
export function describeDevice(ua?: string): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : /okhttp|Expo|CampusConnect/i.test(ua)
              ? 'CampusConnect app'
              : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iOS/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown device';
  return `${browser} on ${os}`;
}
