import type { ClientSession } from 'mongodb';
import type { Logger } from 'pino';
import { uuidv7 } from '../infra/db/ids.js';
import type { Mongo } from '../infra/db/mongo.js';

// Audit trail for security-relevant and administrative actions (who did what, when, to what).
// Use audit() with the transaction session of an admin change so the change and its record are
// saved together; use auditBestEffort() for events such as sign-ins where a logging failure must
// not block the person. Entries expire after a year (TTL index).

export interface AuditEntry {
  action: string; // e.g. auth.login, admin.user_update
  actorId?: string | null;
  actorRole?: string | null;
  collegeId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  ipHash?: string | null;
  requestId?: string | null;
  meta?: Record<string, unknown>;
}

export async function audit(db: Mongo, e: AuditEntry, session?: ClientSession): Promise<void> {
  await db.col('audit_logs').insertOne(
    {
      _id: uuidv7(),
      action: e.action,
      actorId: e.actorId ?? null,
      actorRole: e.actorRole ?? null,
      collegeId: e.collegeId ?? null,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      ipHash: e.ipHash ?? null,
      requestId: e.requestId ?? null,
      meta: e.meta ?? {},
      createdAt: new Date(),
    },
    { session },
  );
}

export async function auditBestEffort(db: Mongo, e: AuditEntry, logger: Logger): Promise<void> {
  try {
    await audit(db, e);
  } catch (err) {
    logger.warn({ err: (err as Error).message, action: e.action }, 'audit write failed');
  }
}
