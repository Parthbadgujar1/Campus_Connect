import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { randomToken, sha256Hex } from '../../core/crypto.js';
import { Errors } from '../../core/errors.js';
import { requireAuth } from '../../core/guards.js';
import { verifyUnsubscribe } from '../../core/unsubscribe.js';
import { email, optionalText } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { User, UserSettings } from '../../infra/db/models.js';
import { limits } from '../../plugins/traffic.js';
import { verifyPassword } from '../auth/password.js';
import { fileView } from '../files/files.service.js';
import { defaultSettings } from '../users/defaults.js';
import { DELETION_GRACE_DAYS } from './privacy.service.js';

// /v1/me/settings, /v1/me/deletion, /v1/me/exports, /v1/privacy/* — the person's control over
// how the app looks and over their data. This module has no kill switch: privacy rights and
// account deletion must always work.

/** The current guided-tour version. Raise it to show a short "what's new" tour once. */
export const TOUR_VERSION = 1;

function settingsView(s: UserSettings | undefined) {
  const r = { ...defaultSettings(), ...(s ?? {}) };
  return {
    theme: r.theme,
    // "classic" (Inter) was retired; people who chose it get the default Kalam look.
    font: r.font === 'classic' ? 'handwritten' : r.font,
    textSize: r.textSize,
    reduceMotion: r.reduceMotion,
    highContrast: r.highContrast,
    onboarding: { completed: Boolean(r.onboardingCompletedAt), skipped: r.onboardingSkipped, completedAt: r.onboardingCompletedAt?.toISOString() ?? null },
    tour: { completed: Boolean(r.tourCompletedAt), skipped: r.tourSkipped, version: r.tourVersion, current: TOUR_VERSION },
    seen: r.seen,
  };
}

export const privacyRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const users = () => db.col('users');

  // ---------------------------------------------------------------- experience settings
  async function loadSettings(userId: string) {
    const u = await users().findOne({ _id: userId }, { projection: { settings: 1 } });
    return settingsView(u?.settings);
  }

  app.get('/me/settings', { schema: { tags: ['me'], summary: 'Theme, font, text size, onboarding and tour state' } }, async (request) => {
    const auth = requireAuth(request);
    return loadSettings(auth.userId);
  });

  app.patch(
    '/me/settings',
    {
      schema: {
        tags: ['me'],
        summary: 'Change appearance, or record onboarding/tour progress',
        body: z.object({
          theme: z.enum(['system', 'pro', 'day', 'night', 'paper']).optional(),
          font: z.enum(['pro', 'handwritten', 'system', 'readable']).optional(),
          textSize: z.enum(['sm', 'md', 'lg']).optional(),
          reduceMotion: z.boolean().optional(),
          highContrast: z.boolean().optional(),
          onboarding: z.enum(['completed', 'skipped', 'reset']).optional(),
          tour: z.enum(['completed', 'skipped', 'reset']).optional(),
          // Sections opened, for the "new" dots. Paths like /campus/careers.
          seenAdd: z.array(z.string().regex(/^[a-z0-9/_:.-]{1,80}$/)).max(50).optional(),
        }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const b = request.body;
      const u = await users().findOne({ _id: auth.userId }, { projection: { settings: 1 } });
      if (!u) throw Errors.unauthenticated();
      const current = { ...defaultSettings(), ...(u.settings ?? {}) };
      const now = new Date();
      const next: UserSettings = { ...current };
      if (b.theme) next.theme = b.theme;
      if (b.font) next.font = b.font;
      if (b.textSize) next.textSize = b.textSize;
      if (b.reduceMotion !== undefined) next.reduceMotion = b.reduceMotion;
      if (b.highContrast !== undefined) next.highContrast = b.highContrast;
      if (b.onboarding === 'completed' || b.onboarding === 'skipped') {
        next.onboardingCompletedAt = current.onboardingCompletedAt ?? now;
        next.onboardingSkipped = b.onboarding === 'skipped';
      }
      if (b.onboarding === 'reset') Object.assign(next, { onboardingCompletedAt: null, onboardingSkipped: false });
      if (b.tour === 'completed' || b.tour === 'skipped') Object.assign(next, { tourCompletedAt: now, tourSkipped: b.tour === 'skipped', tourVersion: TOUR_VERSION });
      if (b.tour === 'reset') Object.assign(next, { tourCompletedAt: null, tourSkipped: false, tourVersion: 0 });
      // Newest first, de-duplicated, capped at 500 entries.
      if (b.seenAdd?.length) next.seen = [...new Set([...b.seenAdd, ...current.seen])].slice(0, 500);
      await users().updateOne({ _id: auth.userId }, { $set: { settings: next, updatedAt: now } });
      return settingsView(next);
    },
  );

  // ---------------------------------------------------------------- account deletion
  app.post(
    '/me/deletion',
    {
      config: limits.emailAction,
      schema: {
        tags: ['privacy'],
        summary: `Delete my account (permanent after ${DELETION_GRACE_DAYS} days; sign in before then to cancel)`,
        // Being signed in is the verification; the app shows a confirmation pop-up first.
        body: z.object({ reason: optionalText(500) }),
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request);
      const user = await users().findOne({ _id: auth.userId }, { projection: { email: 1, 'profile.displayName': 1, deletionScheduledFor: 1 } });
      if (!user) throw Errors.unauthenticated();
      if (user.deletionScheduledFor) return { status: 'scheduled', scheduledFor: user.deletionScheduledFor.toISOString() };
      const scheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * 86_400_000);
      const now = new Date();
      await db.tx(async (session) => {
        await users().updateOne({ _id: auth.userId }, { $set: { deletionScheduledFor: scheduledFor, deletionReason: request.body.reason ?? null, updatedAt: now } }, { session });
        await db.col('data_requests').updateOne(
          { email: user.email, kind: 'deletion', isActive: true },
          { $setOnInsert: { _id: uuidv7(), userId: auth.userId, email: user.email, kind: 'deletion', status: 'pending', isActive: true, scheduledFor, verifiedAt: now, completedAt: null, resultFileId: null, note: request.body.reason ?? null, attempts: 0, lastError: null, createdAt: now, updatedAt: now } },
          { upsert: true, session },
        );
        await app.sessions.revokeAll(auth.userId, 'deleted', undefined, session);
        await app.deps.mailer.enqueue(
          { to: user.email, template: 'account_deletion_scheduled', category: 'security', userId: auth.userId, payload: { name: user.profile.displayName.split(' ')[0], when: scheduledFor.toUTCString() } },
          session,
        );
        await audit(db, { action: 'account.deletion_scheduled', actorId: auth.userId, collegeId: auth.collegeId, entityType: 'user', entityId: auth.userId, ipHash: request.ipHash, requestId: request.id }, session);
      });
      app.sessions.clearCookies(reply);
      return {
        status: 'scheduled',
        scheduledFor: scheduledFor.toISOString(),
        message: `Your account is hidden now and will be permanently deleted on ${scheduledFor.toDateString()}. Sign in before then if you change your mind.`,
      };
    },
  );

  app.delete('/me/deletion', { schema: { tags: ['privacy'], summary: 'Cancel my scheduled account deletion' } }, async (request) => {
    const auth = requireAuth(request);
    const cancelled = await db.tx(async (session) => {
      const res = await users().updateOne({ _id: auth.userId, deletionScheduledFor: { $ne: null } }, { $set: { deletionScheduledFor: null, deletionReason: null, updatedAt: new Date() } }, { session });
      if (!res.modifiedCount) return false;
      await db.col('data_requests').updateMany({ userId: auth.userId, kind: 'deletion', status: { $in: ['pending', 'pending_verification'] } }, { $set: { status: 'cancelled', isActive: false, updatedAt: new Date() } }, { session });
      await audit(db, { action: 'account.deletion_cancelled', actorId: auth.userId, collegeId: auth.collegeId, entityType: 'user', entityId: auth.userId, requestId: request.id }, session);
      return true;
    });
    if (!cancelled) throw Errors.notFound('A scheduled deletion');
    return { status: 'cancelled' };
  });

  // ---------------------------------------------------------------- data export
  app.post('/me/exports', { config: { rateLimit: { max: 3, timeWindow: '1 day' } }, schema: { tags: ['privacy'], summary: 'Prepare a copy of all my data (ready in a few minutes)' } }, async (request, reply) => {
    const auth = requireAuth(request);
    const active = await db.col('data_requests').findOne({ userId: auth.userId, kind: 'export', status: { $in: ['pending', 'processing'] } }, { projection: { status: 1 } });
    if (active) return reply.status(202).send({ id: active._id, status: active.status });
    const recent = await db.col('data_requests').findOne({ userId: auth.userId, kind: 'export', status: 'completed', completedAt: { $gt: new Date(Date.now() - 86_400_000) } }, { projection: { _id: 1 } });
    if (recent) throw Errors.tooMany(3600, 'You already have a recent export. You can request a new one tomorrow.');
    const me = await users().findOne({ _id: auth.userId }, { projection: { email: 1 } });
    if (!me) throw Errors.unauthenticated();
    const now = new Date();
    const id = uuidv7();
    try {
      await db.col('data_requests').insertOne({ _id: id, userId: auth.userId, email: me.email, kind: 'export', status: 'pending', isActive: true, scheduledFor: null, verifiedAt: now, completedAt: null, resultFileId: null, note: null, attempts: 0, lastError: null, createdAt: now, updatedAt: now });
    } catch (err) {
      // An export request from the email form is still waiting for confirmation: replace it.
      if ((err as { code?: number }).code !== 11000) throw err;
      await db.col('data_requests').updateOne({ email: me.email, kind: 'export', isActive: true }, { $set: { status: 'pending', userId: auth.userId, verifiedAt: now, updatedAt: now } });
    }
    return reply.status(202).send({ id, status: 'pending', message: 'We are preparing your data. We will email you when it is ready to download.' });
  });

  app.get('/me/exports', { schema: { tags: ['privacy'], summary: 'My data exports and their download links' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await db.col('data_requests').find({ userId: auth.userId, kind: 'export' }).sort({ createdAt: -1 }).limit(10).toArray();
    const now = new Date();
    const files = await db.col('files').find({ _id: { $in: rows.map((r) => r.resultFileId).filter((x): x is string => Boolean(x)) }, deletedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).toArray();
    const fileBy = new Map(files.map((f) => [f._id, f]));
    return {
      items: await Promise.all(
        rows.map(async (r) => {
          const f = r.resultFileId ? fileBy.get(r.resultFileId) : undefined;
          const view = f ? await fileView(app.deps, f, 900) : null;
          return {
            id: r._id,
            status: r.status,
            requestedAt: r.createdAt.toISOString(),
            completedAt: r.completedAt?.toISOString() ?? null,
            download: view ? { url: view.url, size: view.size, expiresAt: f?.expiresAt?.toISOString() ?? null } : null,
          };
        }),
      ),
    };
  });

  // ---------------------------------------------------------------- requests without signing in
  app.post(
    '/privacy/requests',
    {
      config: limits.emailAction,
      schema: {
        tags: ['privacy'],
        summary: 'Ask for a copy or deletion of data without signing in (confirmed by email)',
        body: z.object({ email, kind: z.enum(['export', 'deletion']), details: optionalText(500) }),
      },
    },
    async (request, reply) => {
      const b = request.body;
      const user = await users().findOne({ email: b.email, status: { $ne: 'deleted' } }, { projection: { _id: 1 } });
      // Same answer whether or not the address has an account.
      if (user) {
        await db.tx(async (session) => {
          const requests = db.col('data_requests');
          await requests.updateMany({ email: b.email, kind: b.kind, status: 'pending_verification' }, { $set: { status: 'cancelled', isActive: false, updatedAt: new Date() } }, { session });
          const active = await requests.findOne({ email: b.email, kind: b.kind, isActive: true }, { session, projection: { _id: 1 } });
          if (active) return;
          const now = new Date();
          await requests.insertOne({ _id: uuidv7(), userId: user._id, email: b.email, kind: b.kind, status: 'pending_verification', isActive: true, scheduledFor: null, verifiedAt: null, completedAt: null, resultFileId: null, note: b.details ?? null, attempts: 0, lastError: null, createdAt: now, updatedAt: now }, { session });
          const tokens = db.col('email_tokens');
          await tokens.updateMany({ email: b.email, purpose: 'data_request', consumedAt: null }, { $set: { consumedAt: now } }, { session });
          const token = randomToken('cce');
          const expiresAt = new Date(now.getTime() + 24 * 3600_000);
          await tokens.insertOne({ _id: uuidv7(), userId: user._id, email: b.email, purpose: 'data_request', tokenHash: sha256Hex(token), expiresAt, consumedAt: null, ipHash: request.ipHash, createdAt: now, expireAt: new Date(expiresAt.getTime() + 86_400_000) }, { session });
          await app.deps.mailer.enqueue(
            { to: b.email, template: 'data_request_confirm', category: 'security', userId: user._id, payload: { kind: b.kind, url: `${app.deps.config.webUrl}/privacy/confirm?token=${token}` } },
            session,
          );
        });
      }
      return reply.status(202).send({ status: 'check_email', message: 'If that address has an account, we have sent a link to confirm the request.' });
    },
  );

  app.post('/privacy/requests/confirm', { config: limits.tokenAction, schema: { tags: ['privacy'], summary: 'Confirm a data request from the emailed link', body: z.object({ token: z.string().min(10).max(200) }) } }, async (request) => {
    if (!/^cce_[A-Za-z0-9_-]{43}$/.test(request.body.token)) throw Errors.gone();
    const result = await db.tx(async (session) => {
      const now = new Date();
      const t = await db.col('email_tokens').findOneAndUpdate(
        { tokenHash: sha256Hex(request.body.token), purpose: 'data_request', consumedAt: null, expiresAt: { $gt: now } },
        { $set: { consumedAt: now } },
        { session },
      );
      if (!t) throw Errors.gone();
      const r = await db.col('data_requests').findOneAndUpdate({ email: t.email, status: 'pending_verification' }, { $set: { status: 'pending', verifiedAt: now, updatedAt: now } }, { session, returnDocument: 'after' });
      if (!r) throw Errors.gone();
      if (r.kind === 'deletion' && t.userId) {
        // Same 30-day grace as deleting from Settings; signing in cancels it.
        const u = await users().findOneAndUpdate(
          { _id: t.userId },
          [{ $set: { deletionScheduledFor: { $ifNull: ['$deletionScheduledFor', new Date(now.getTime() + DELETION_GRACE_DAYS * 86_400_000)] }, updatedAt: '$$NOW' } }],
          { session, returnDocument: 'after', projection: { deletionScheduledFor: 1 } },
        );
        const when = (u as Pick<User, 'deletionScheduledFor'> | null)?.deletionScheduledFor ?? new Date(now.getTime() + DELETION_GRACE_DAYS * 86_400_000);
        await db.col('data_requests').updateOne({ _id: r._id }, { $set: { scheduledFor: when } }, { session });
        await app.sessions.revokeAll(t.userId, 'deleted', undefined, session);
        await app.deps.mailer.enqueue({ to: t.email, template: 'account_deletion_scheduled', category: 'security', userId: t.userId, payload: { when: when.toUTCString() } }, session);
      }
      await audit(db, { action: 'privacy.request_confirmed', actorId: t.userId, entityType: 'data_request', entityId: r._id, ipHash: request.ipHash, requestId: request.id, meta: { kind: r.kind } }, session);
      return r;
    });
    return {
      status: 'confirmed',
      kind: result.kind,
      message: result.kind === 'deletion'
        ? `Confirmed. The account will be permanently deleted in ${DELETION_GRACE_DAYS} days. Signing in before then cancels it.`
        : 'Confirmed. We will email you a download link when your data is ready.',
    };
  });

  const unsubscribeBody = z.object({ e: z.string().min(4).max(400), s: z.enum(['marketing', 'notification', 'all']), t: z.string().min(20).max(100) });
  app.post('/privacy/unsubscribe', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } }, schema: { tags: ['privacy'], summary: 'One-click unsubscribe from the link in an email', body: unsubscribeBody } }, async (request) => {
    const addr = verifyUnsubscribe(app.deps.config.secrets.session, request.body.e, request.body.s, request.body.t);
    if (!addr) throw Errors.gone('This unsubscribe link is not valid. Manage emails from Settings instead.');
    const scope = request.body.s;
    await db.col('email_suppressions').updateOne({ _id: `${addr}:${scope}` }, { $setOnInsert: { email: addr, scope, reason: 'unsubscribed', createdAt: new Date() } }, { upsert: true });
    if (scope !== 'notification') await users().updateOne({ email: addr }, { $set: { 'notificationPrefs.marketingEmails': false } });
    return { status: 'unsubscribed', scope };
  });
};
