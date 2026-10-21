import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import type { FeatureFlag } from '../../infra/db/models.js';
import type { Mongo } from '../../infra/db/mongo.js';

// Feature flags and module kill switches.
//   module.*   - one per API module. Switching one off returns a friendly 503 for that module
//                only; the rest of the app keeps running. Used for incidents and for staged
//                launches of new modules.
//   feature.*  - smaller behaviours inside a module (anonymous posting, snaps, sign-in alerts).
// Flags are cached in memory and refreshed every few seconds. If the database is unreachable the
// last known values (or the defaults below) are used, so a database blip cannot flip features.

export interface FlagContext {
  userId?: string;
  role?: string;
  collegeId?: string;
}

export interface FlagRow {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  allowedRoles: string[];
  allowedCollegeIds: string[];
  updatedAt: Date;
}

const toRow = (f: FeatureFlag): FlagRow => ({ key: f._id, description: f.description, enabled: f.enabled, rolloutPercent: f.rolloutPercent, allowedRoles: f.allowedRoles, allowedCollegeIds: f.allowedCollegeIds, updatedAt: f.updatedAt });

export const FLAG_DEFAULTS: Record<string, { enabled: boolean; description: string }> = {
  'module.auth': { enabled: true, description: 'Sign in, sign up and sessions' },
  'module.registration': { enabled: true, description: 'New account sign-ups' },
  'module.feed': { enabled: true, description: 'Home feed, posts, comments and polls' },
  'module.chats': { enabled: true, description: 'Chats and messages' },
  'module.realtime': { enabled: true, description: 'Live updates over WebSockets' },
  'module.spaces': { enabled: true, description: 'Spaces, boards and threads' },
  'module.events': { enabled: true, description: 'Events and RSVPs' },
  'module.announcements': { enabled: true, description: 'Notices and news' },
  'module.opportunities': { enabled: true, description: 'Opportunities and applications' },
  'module.resources': { enabled: true, description: 'Shelf: notes and papers' },
  'module.lectures': { enabled: true, description: 'Lecture library' },
  'module.hush': { enabled: true, description: 'Hush anonymous Q&A' },
  'module.lost_found': { enabled: true, description: 'Lost & found' },
  'module.marketplace': { enabled: true, description: 'Student marketplace' },
  'module.search': { enabled: true, description: 'Search across the campus' },
  'module.uploads': { enabled: true, description: 'File uploads' },
  'module.notifications': { enabled: true, description: 'In-app notifications' },
  'module.reports': { enabled: true, description: 'Reporting content and people' },
  'module.contact': { enabled: true, description: 'Contact form' },
  'module.surveys': { enabled: true, description: 'Surveys from the college' },
  'module.feedback': { enabled: true, description: 'App feedback from Settings' },
  'feature.anonymous_posts': { enabled: true, description: 'Allow anonymous feed posts' },
  'feature.chat_snaps': { enabled: true, description: 'View-once snaps in chats' },
  'feature.sign_in_alerts': { enabled: true, description: 'Email on sign-in from a new device' },
};

export class FlagsService {
  private flags = new Map<string, FlagRow>();
  private loadedAt = 0;
  private loading?: Promise<void>;

  constructor(
    private readonly db: Mongo,
    private readonly logger: Logger,
    private readonly ttlMs = 5_000,
  ) {}

  private async refresh(force = false): Promise<void> {
    if (!force && Date.now() - this.loadedAt < this.ttlMs) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const rows = await this.db.col('feature_flags').find({}).toArray();
        this.flags = new Map(rows.map((r) => [r._id, toRow(r)]));
        this.loadedAt = Date.now();
      } catch (err) {
        // Keep the last known flags; retry soon.
        this.loadedAt = Date.now() - this.ttlMs + 1_000;
        this.logger.warn({ err: (err as Error).message }, 'feature flags refresh failed; using last known values');
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  invalidate(): void {
    this.loadedAt = 0;
  }

  async isEnabled(key: string, ctx: FlagContext = {}): Promise<boolean> {
    await this.refresh();
    const row = this.flags.get(key);
    if (!row) return FLAG_DEFAULTS[key]?.enabled ?? false;
    return this.evaluate(row, ctx);
  }

  private evaluate(row: FlagRow, ctx: FlagContext): boolean {
    if (!row.enabled) return false;
    if (row.allowedRoles.length && (!ctx.role || !row.allowedRoles.includes(ctx.role))) return false;
    if (row.allowedCollegeIds.length && (!ctx.collegeId || !row.allowedCollegeIds.includes(ctx.collegeId))) return false;
    if (row.rolloutPercent >= 100) return true;
    if (row.rolloutPercent <= 0 || !ctx.userId) return false;
    // Stable bucketing: a person stays in or out of a rollout as the percentage grows.
    const bucket = createHash('sha256').update(`${row.key}:${ctx.userId}`).digest().readUInt16BE(0) % 100;
    return bucket < row.rolloutPercent;
  }

  /** All flags resolved for one person (sent to the apps so UI and API agree). */
  async resolveAll(ctx: FlagContext): Promise<Record<string, boolean>> {
    await this.refresh();
    const out: Record<string, boolean> = {};
    for (const [key, def] of Object.entries(FLAG_DEFAULTS)) out[key] = def.enabled;
    for (const row of this.flags.values()) out[row.key] = this.evaluate(row, ctx);
    return out;
  }

  async list(): Promise<FlagRow[]> {
    await this.refresh(true);
    const keys = new Set([...Object.keys(FLAG_DEFAULTS), ...this.flags.keys()]);
    return [...keys].sort().map(
      (key) =>
        this.flags.get(key) ?? {
          key,
          description: FLAG_DEFAULTS[key]?.description ?? '',
          enabled: FLAG_DEFAULTS[key]?.enabled ?? false,
          rolloutPercent: 100,
          allowedRoles: [],
          allowedCollegeIds: [],
          updatedAt: new Date(0),
        },
    );
  }
}
