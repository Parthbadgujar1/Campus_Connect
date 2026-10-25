import type { Deps } from '../deps.js';
import { completeExport, purgeAccount } from '../modules/privacy/privacy.service.js';

// Background jobs. Each runs on its own timer under a lease in job_locks (so with several API
// processes, only one runs a given job at a time) and records its last run in job_runs (admin
// System page). A failing job is logged and retried on its next tick; it never affects requests
// or the other jobs.
//
// Expired sessions, email tokens, sign-in history (30 days), notifications (180 days) and audit
// entries (365 days) need no job: TTL indexes make MongoDB delete them by itself.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function registerJobs(deps: Deps): void {
  const { scheduler, db, mailer, storage, logger, config } = deps;

  scheduler.register({
    name: 'email-outbox',
    intervalMs: 3_000,
    runOnStart: true,
    run: async () => {
      const n = await mailer.processDue();
      return n ? `sent ${n}` : undefined;
    },
  });

  // Data exports requested from Settings: build, store, email the link.
  scheduler.register({
    name: 'data-exports',
    intervalMs: MINUTE,
    runOnStart: true,
    run: async () => {
      let done = 0;
      for (let i = 0; i < 5; i++) {
        // Claim one request at a time, so two workers never build the same export.
        const r = await db.col('data_requests').findOneAndUpdate(
          { kind: 'export', status: 'pending', userId: { $ne: null } },
          { $set: { status: 'processing', updatedAt: new Date() }, $inc: { attempts: 1 } },
          { sort: { createdAt: 1 }, returnDocument: 'after' },
        );
        if (!r?.userId) break;
        const u = await db.col('users').findOne({ _id: r.userId }, { projection: { collegeId: 1 } });
        try {
          if (!u) throw new Error('account no longer exists');
          await completeExport(deps, r._id, r.userId, u.collegeId);
          await mailer.enqueue({ to: r.email, template: 'data_export_ready', userId: r.userId, payload: { url: `${config.webUrl}/settings/data#exports` }, dedupeKey: `export-ready:${r._id}` });
          done++;
        } catch (err) {
          await db.col('data_requests').updateOne({ _id: r._id }, { $set: { status: r.attempts >= 3 ? 'failed' : 'pending', isActive: r.attempts < 3, lastError: (err as Error).message.slice(0, 1000), updatedAt: new Date() } });
        }
      }
      return done ? `exported ${done}` : undefined;
    },
  });

  // Accounts whose 30-day grace period has ended are deleted permanently, one at a time.
  scheduler.register({
    name: 'account-deletion',
    intervalMs: 15 * MINUTE,
    runOnStart: true,
    run: async () => {
      const due = await db.col('users').find({ deletionScheduledFor: { $lte: new Date() }, status: { $ne: 'deleted' } }, { projection: { _id: 1 } }).sort({ deletionScheduledFor: 1 }).limit(20).toArray();
      let done = 0;
      for (const u of due) {
        try {
          if (await purgeAccount(deps, u._id)) done++;
        } catch (err) {
          logger.error({ err, userId: u._id }, 'account deletion failed; will retry');
          // purgeAccount marks the account first; put it back so the next run retries it.
          await db.col('users').updateOne({ _id: u._id, status: 'deleted' }, { $set: { status: 'suspended' } }).catch(() => undefined);
        }
      }
      return done ? `deleted ${done}` : undefined;
    },
  });

  // Surveys past their closing date stop accepting answers.
  scheduler.register({
    name: 'surveys',
    intervalMs: 10 * MINUTE,
    runOnStart: true,
    run: async () => {
      const res = await db.col('surveys').updateMany({ status: 'published', closesAt: { $ne: null, $lte: new Date() } }, { $set: { status: 'closed', updatedAt: new Date() } });
      return res.modifiedCount ? `closed ${res.modifiedCount}` : undefined;
    },
  });

  // Housekeeping that TTL indexes cannot do on their own.
  scheduler.register({
    name: 'cleanup',
    intervalMs: HOUR,
    runOnStart: true,
    run: async () => {
      const counts: string[] = [];
      const note = (label: string, n: number) => {
        if (n) counts.push(`${label} ${n}`);
      };
      const now = Date.now();

      // Never-verified sign-ups are removed after 14 days (data minimisation).
      const stale = await db.col('users').find({ status: 'pending', emailVerifiedAt: null, createdAt: { $lt: new Date(now - 14 * DAY) } }, { projection: { _id: 1, email: 1 } }).limit(500).toArray();
      if (stale.length) {
        const ids = stale.map((u) => u._id);
        const emails = stale.map((u) => u.email);
        await Promise.all([
          db.col('consents').deleteMany({ userId: { $in: ids } }),
          db.col('email_tokens').deleteMany({ $or: [{ userId: { $in: ids } }, { email: { $in: emails } }] }),
          db.col('verification_requests').deleteMany({ userId: { $in: ids } }),
          db.col('sessions').deleteMany({ userId: { $in: ids } }),
        ]);
        note('unverified accounts', (await db.col('users').deleteMany({ _id: { $in: ids }, status: 'pending' })).deletedCount);
      }

      // Rendered bodies can contain links; keep delivery metadata only.
      note('email bodies', (await db.col('email_outbox').updateMany({ status: 'sent', sentAt: { $lt: new Date(now - 14 * DAY) }, renderedHtml: { $ne: null } }, { $set: { renderedHtml: null, renderedText: null, payload: {} } })).modifiedCount);
      note('old emails', (await db.col('email_outbox').deleteMany({ status: { $in: ['sent', 'suppressed', 'dead'] }, createdAt: { $lt: new Date(now - 90 * DAY) } })).deletedCount);

      // Disappearing chats: messages older than the chat's timer are wiped.
      const timed = await db.col('chats').find({ disappearingSeconds: { $ne: null } }, { projection: { disappearingSeconds: 1 } }).toArray();
      let wiped = 0;
      for (const c of timed) {
        const res = await db.col('messages').updateMany(
          { chatId: c._id, deletedAt: null, createdAt: { $lt: new Date(now - (c.disappearingSeconds ?? 0) * 1000) } },
          { $set: { deletedAt: new Date(), body: null, payload: {}, fileId: null } },
        );
        wiped += res.modifiedCount;
      }
      note('disappearing messages', wiped);
      note('stale identity requests', (await db.col('identity_reveals').updateMany({ status: 'pending', createdAt: { $lt: new Date(now - 7 * DAY) } }, { $set: { status: 'expired' } })).modifiedCount);

      // Expired, deleted and abandoned files: remove the bytes, then the record.
      const files = await db
        .col('files')
        .find({
          $or: [
            { expiresAt: { $ne: null, $lt: new Date(now) } },
            { status: 'deleted', deletedAt: { $lt: new Date(now - DAY) } },
            { status: 'pending', createdAt: { $lt: new Date(now - 2 * DAY) }, scanResult: { $not: /^retry:/ } },
          ],
        })
        .limit(200)
        .toArray();
      let removed = 0;
      for (const f of files) {
        try {
          await storage.delete(f.storageKey);
          if (f.hasThumbnail) await storage.delete(`${f.storageKey}.thumb.webp`);
          await db.col('files').deleteOne({ _id: f._id });
          removed++;
        } catch (err) {
          logger.warn({ err: (err as Error).message, fileId: f._id }, 'file cleanup failed');
        }
      }
      note('files', removed);
      return counts.join(', ') || undefined;
    },
  });

  // Files waiting because the malware scanner was unreachable are scanned again.
  scheduler.register({
    name: 'scan-retry',
    intervalMs: 5 * MINUTE,
    run: async () => {
      if (!deps.scanner.enabled) return undefined;
      const pending = await db.col('files').find({ status: 'pending', scanResult: /^retry:/ }, { projection: { storageKey: 1 } }).sort({ createdAt: 1 }).limit(20).toArray();
      let ok = 0;
      for (const f of pending) {
        const obj = await storage.get(f.storageKey);
        const chunks: Buffer[] = [];
        for await (const c of obj.stream) chunks.push(c as Buffer);
        const result = await deps.scanner.scan(Buffer.concat(chunks));
        if (result.status === 'unavailable') break; // still down; try again later
        await db.col('files').updateOne(
          { _id: f._id },
          { $set: { status: result.status === 'clean' ? 'ready' : 'quarantined', scanResult: result.status === 'clean' ? 'clean' : `infected: ${result.signature}`.slice(0, 200) } },
        );
        ok++;
      }
      return ok ? `scanned ${ok}` : undefined;
    },
  });
}
