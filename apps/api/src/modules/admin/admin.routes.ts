import type { FastifyPluginAsync } from 'fastify';
import type { Document, Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { MODERATION_ROLES, requireRole, STAFF_ROLES } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, newerThan, olderThan } from '../../core/query.js';
import { cleanText, idParam, optionalText, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { AuditLog, ContactMessage, EmailOutbox, Role, User, VerificationRequest } from '../../infra/db/models.js';
import { moduleHealth } from '../../plugins/module-guard.js';
import { FLAG_DEFAULTS } from '../flags/flags.service.js';
import { completeExport } from '../privacy/privacy.service.js';
import { applyTarget, lookupTarget, TARGET_TYPES, TARGETS, type TargetType } from '../reports/targets.js';
import { departmentNames, loadPeople, personOf } from '../users/people.js';
import { ageOn } from '../auth/auth.service.js';

// /v1/admin — the admin console. Everything is limited to the admin's own college.
//   admin      - everything
//   moderator  - reports, content queue, suspending students
//   faculty    - the content queue for Shelf uploads and lectures (via their own modules)
// Every change is written to the audit log together with the change itself.

const ROLES = ['student', 'faculty', 'expert', 'moderator', 'admin'] as const;
const QUEUE_TYPES = ['space', 'event', 'opportunity', 'resource', 'lecture'] as const;
type QueueType = (typeof QUEUE_TYPES)[number];
const QUEUE: Record<QueueType, { collection: string; pending: Document; approve: () => Document; reject: () => Document; title: string; owner: string; link: (id: string, slug?: string) => string }> = {
  space: { collection: 'spaces', pending: { status: 'pending' }, approve: () => ({ status: 'active' }), reject: () => ({ status: 'removed' }), title: 'name', owner: 'createdBy', link: (_id, slug) => `/spaces/${slug ?? ''}` },
  event: { collection: 'events', pending: { status: 'pending' }, approve: () => ({ status: 'published' }), reject: () => ({ status: 'rejected' }), title: 'title', owner: 'createdBy', link: (id) => `/events/${id}` },
  opportunity: { collection: 'opportunities', pending: { status: 'pending' }, approve: () => ({ status: 'published' }), reject: () => ({ status: 'rejected' }), title: 'title', owner: 'postedBy', link: (id) => `/opportunities/${id}` },
  resource: { collection: 'resources', pending: { status: 'pending', deletedAt: null }, approve: () => ({ status: 'approved', reviewedAt: new Date() }), reject: () => ({ status: 'rejected', reviewedAt: new Date() }), title: 'title', owner: 'uploaderId', link: (id) => `/resources?id=${id}` },
  lecture: { collection: 'lectures', pending: { status: 'pending', deletedAt: null }, approve: () => ({ status: 'published', publishedAt: new Date() }), reject: () => ({ status: 'rejected' }), title: 'title', owner: 'teacherId', link: (id) => `/lectures?id=${id}` },
};

type Doc = Document & { _id: string };

export const adminRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const users = () => db.col('users');

  // ---------------------------------------------------------------- overview
  app.get('/overview', { schema: { tags: ['admin'], summary: 'Numbers for the admin dashboard' } }, async (request) => {
    const auth = requireRole(request, ...STAFF_ROLES);
    const c = auth.collegeId;
    const now = new Date();
    const day = new Date(now.getTime() - 86_400_000);
    const week = new Date(now.getTime() - 7 * 86_400_000);
    const count = (name: string, filter: Document) => db.raw(name).countDocuments(filter);
    const live = { collegeId: c, status: { $ne: 'deleted' } };
    const chatIds = async () => (await db.col('chats').find({ collegeId: c }, { projection: { _id: 1 } }).limit(20_000).toArray()).map((x) => x._id);
    const [active, unverified, suspended, leaving, newThisWeek, students, faculty, experts, staff, activeToday, pendingRoles] = await Promise.all([
      count('users', { collegeId: c, status: 'active' }),
      count('users', { collegeId: c, status: 'pending' }),
      count('users', { collegeId: c, status: 'suspended' }),
      count('users', { ...live, deletionScheduledFor: { $ne: null } }),
      count('users', { ...live, createdAt: { $gt: week } }),
      count('users', { ...live, role: 'student' }),
      count('users', { ...live, role: 'faculty' }),
      count('users', { ...live, role: 'expert' }),
      count('users', { ...live, role: { $in: ['moderator', 'admin'] } }),
      count('users', { ...live, lastLoginAt: { $gt: day } }),
      count('users', { ...live, pendingRole: { $ne: null } }),
    ]);
    const [postsToday, discussionsToday, messagesToday, eventsThisWeek, activeSessions] = await Promise.all([
      count('posts', { collegeId: c, createdAt: { $gt: day } }),
      count('discussions', { collegeId: c, createdAt: { $gt: day } }),
      chatIds().then((ids) => count('messages', { chatId: { $in: ids }, createdAt: { $gt: day } })),
      count('events', { collegeId: c, status: 'published', startsAt: { $gte: now, $lte: new Date(now.getTime() + 7 * 86_400_000) } }),
      users()
        .find({ collegeId: c }, { projection: { _id: 1 } })
        .limit(50_000)
        .toArray()
        .then((list) => count('sessions', { userId: { $in: list.map((u) => u._id) }, revokedAt: null, idleExpiresAt: { $gt: now } })),
    ]);
    const [openReports, urgentReports, verifications, spaces, events, opportunities, resources, lectures, identityReveals, contact, dataRequests, surveysLive, feedbackNew] = await Promise.all([
      count('reports', { collegeId: c, isOpen: true }),
      count('reports', { collegeId: c, isOpen: true, priority: { $lte: 2 } }),
      count('verification_requests', { collegeId: c, status: 'pending' }),
      count('spaces', { collegeId: c, status: 'pending' }),
      count('events', { collegeId: c, status: 'pending' }),
      count('opportunities', { collegeId: c, status: 'pending' }),
      count('resources', { collegeId: c, status: 'pending', deletedAt: null }),
      count('lectures', { collegeId: c, status: 'pending', deletedAt: null }),
      count('identity_reveals', { collegeId: c, status: 'pending' }),
      count('contact_messages', { status: 'new' }),
      count('data_requests', { status: { $in: ['pending', 'processing'] } }),
      count('surveys', { collegeId: c, status: 'published' }),
      count('feedback', { collegeId: c, status: 'new' }),
    ]);
    const [waiting, failed, sentToday] = await Promise.all([
      count('email_outbox', { status: { $in: ['queued', 'failed'] } }),
      count('email_outbox', { status: 'dead' }),
      count('email_outbox', { status: 'sent', sentAt: { $gt: day } }),
    ]);
    return {
      people: { active, unverified, suspended, leaving, new_this_week: newThisWeek, students, faculty, experts, staff, active_today: activeToday, pending_roles: pendingRoles },
      activity: { posts_today: postsToday, discussions_today: discussionsToday, messages_today: messagesToday, events_this_week: eventsThisWeek, active_sessions: activeSessions },
      queues: { open_reports: openReports, urgent_reports: urgentReports, verifications, spaces, events, opportunities, resources, lectures, identity_reveals: identityReveals, contact, data_requests: dataRequests, surveys_live: surveysLive, feedback_new: feedbackNew },
      email: { waiting, failed, sent_today: sentToday },
      modules: moduleHealth(),
    };
  });

  // ---------------------------------------------------------------- people
  app.get(
    '/users',
    {
      schema: {
        tags: ['admin'],
        summary: 'Everyone at the college',
        querystring: pageQuery.extend({
          q: z.string().trim().max(80).optional(),
          role: z.enum(ROLES).optional(),
          status: z.enum(['active', 'pending', 'suspended']).optional(),
          departmentId: uuid.optional(),
          year: z.coerce.number().int().min(1).max(6).optional(),
          pendingRole: z.enum(['faculty', 'expert']).optional(),
        }),
      },
    },
    async (request) => {
      const auth = requireRole(request, ...MODERATION_ROLES);
      const { cursor, limit, q, role, status, departmentId, year, pendingRole } = request.query;
      const and: Filter<User>[] = [{ collegeId: auth.collegeId, status: status ?? { $ne: 'deleted' } }];
      if (q) and.push({ $or: [{ 'profile.displayName': contains(q) }, { email: contains(q) }, { 'profile.username': contains(q) }, { 'roleInfo.enrollmentNumber': contains(q) }, { 'roleInfo.employeeId': contains(q) }] });
      if (role) and.push({ role });
      if (departmentId) and.push({ 'profile.departmentId': departmentId });
      if (year) and.push({ 'profile.year': year });
      if (pendingRole) and.push({ pendingRole });
      and.push(olderThan('createdAt', decodeCursor(cursor)) as Filter<User>);
      const rows = await users()
        .find({ $and: and }, { projection: { passwordHash: 0, settings: 0, notificationPrefs: 0 } })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
      const departments = await departmentNames(db, items.map((u) => u.profile.departmentId));
      return {
        items: items.map((u) => ({
          id: u._id,
          email: u.email,
          name: u.profile.displayName,
          username: u.profile.username,
          role: u.role,
          pendingRole: u.pendingRole,
          status: u.status,
          verified: u.profile.isVerified,
          department: u.profile.departmentId ? (departments.get(u.profile.departmentId) ?? null) : null,
          year: u.profile.year,
          division: u.profile.division,
          roleInfo: u.roleInfo ?? {},
          joinedAt: u.createdAt.toISOString(),
          lastSignInAt: u.lastLoginAt?.toISOString() ?? null,
          deletionScheduledFor: u.deletionScheduledFor?.toISOString() ?? null,
        })),
        nextCursor,
      };
    },
  );

  app.get('/users/:id', { schema: { tags: ['admin'], summary: 'One person, with activity and history', params: idParam } }, async (request) => {
    const auth = requireRole(request, ...MODERATION_ROLES);
    const u = await users().findOne({ _id: request.params.id, collegeId: auth.collegeId }, { projection: { passwordHash: 0 } });
    if (!u) throw Errors.notFound('This person');
    const now = new Date();
    const [people, posts, reportsAgainst, activeSessions, actions] = await Promise.all([
      loadPeople(app.deps, [u._id]),
      db.col('posts').countDocuments({ authorId: u._id, deletedAt: null }),
      db.col('reports').countDocuments({ targetType: 'user', targetId: u._id }),
      db.col('sessions').countDocuments({ userId: u._id, revokedAt: null, idleExpiresAt: { $gt: now } }),
      db.col('moderation_actions').find({ targetType: 'user', targetId: u._id }).sort({ createdAt: -1 }).limit(20).toArray(),
    ]);
    return {
      person: personOf(people, u._id),
      email: u.email,
      role: u.role,
      pendingRole: u.pendingRole,
      roleInfo: u.roleInfo ?? {},
      phone: u.phone ?? null,
      age: u.dateOfBirth ? ageOn(u.dateOfBirth, new Date()) : null,
      status: u.status,
      emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
      joinedAt: u.createdAt.toISOString(),
      lastSignInAt: u.lastLoginAt?.toISOString() ?? null,
      deletionScheduledFor: u.deletionScheduledFor?.toISOString() ?? null,
      counts: { posts, reportsAgainst, activeSessions },
      moderationHistory: actions.map((a) => ({ action: a.action, reason: a.reason, at: a.createdAt.toISOString() })),
    };
  });

  app.patch(
    '/users/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Change role, verified badge or suspension',
        params: idParam,
        body: z.object({ role: z.enum(ROLES).optional(), verified: z.boolean().optional(), suspended: z.boolean().optional(), reason: optionalText(500) }),
      },
    },
    async (request) => {
      const auth = requireRole(request, ...MODERATION_ROLES);
      const b = request.body;
      if (request.params.id === auth.userId) throw Errors.badRequest('You cannot change your own account here.');
      const target = await users().findOne({ _id: request.params.id, collegeId: auth.collegeId }, { projection: { role: 1, status: 1, email: 1 } });
      if (!target) throw Errors.notFound('This person');
      if (b.role !== undefined && auth.role !== 'admin') throw Errors.forbidden('Only admins can change roles.');
      if (auth.role === 'moderator' && ['moderator', 'admin', 'faculty'].includes(target.role)) throw Errors.forbidden('Moderators can act on students and experts only.');
      if (b.suspended && !b.reason) throw Errors.validation([{ field: 'reason', message: 'Say why the account is suspended.' }]);
      if (b.role && target.role === 'admin' && b.role !== 'admin') {
        const admins = await users().countDocuments({ collegeId: auth.collegeId, role: 'admin', status: 'active' });
        if (admins <= 2) throw Errors.conflict('Keep at least two admins, so identity reveals can still be approved.');
      }
      await db.tx(async (session) => {
        const set: Document = { updatedAt: new Date() };
        if (b.role) Object.assign(set, { role: b.role, pendingRole: null });
        if (b.verified !== undefined) set['profile.isVerified'] = b.verified;
        await users().updateOne({ _id: target._id }, { $set: set }, { session });
        if (b.role) await db.col('verification_requests').updateMany({ userId: target._id, status: 'pending', kind: { $in: ['faculty_role', 'expert_role'] } }, { $set: { status: 'approved', reviewerId: auth.userId, reviewedAt: new Date(), updatedAt: new Date() } }, { session });
        if (b.suspended !== undefined) {
          await users().updateOne({ _id: target._id, status: { $in: ['active', 'suspended'] } }, { $set: { status: b.suspended ? 'suspended' : 'active' } }, { session });
          if (b.suspended) await app.sessions.revokeAll(target._id, 'suspended', undefined, session);
          await db.col('moderation_actions').insertOne({ _id: uuidv7(), collegeId: auth.collegeId, actorId: auth.userId, targetType: 'user', targetId: target._id, action: b.suspended ? 'suspend_user' : 'unsuspend_user', reason: b.reason ?? null, reportId: null, createdAt: new Date() }, { session });
        }
        await audit(db, { action: 'admin.user_update', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'user', entityId: target._id, requestId: request.id, meta: { role: b.role, verified: b.verified, suspended: b.suspended, reason: b.reason } }, session);
      });
      await app.sessions.invalidateUser(target._id);
      if (b.role || b.verified) {
        await app.deps.notifier.send({ userId: target._id, kind: 'verification', title: b.verified ? 'Your profile is verified' : `Your role is now ${b.role}`, body: b.role ? 'Sign in again on your other devices to see the new tabs.' : '', actorId: auth.userId });
      }
      return { status: 'saved' };
    },
  );

  // ---------------------------------------------------------------- verification and role requests
  app.get('/verifications', { schema: { tags: ['admin'], summary: 'Verification and role requests', querystring: pageQuery.extend({ status: z.enum(['pending', 'approved', 'rejected']).default('pending'), kind: z.enum(['student_id', 'faculty_role', 'expert_role']).optional() }) } }, async (request) => {
    const auth = requireRole(request, ...MODERATION_ROLES);
    const rows = await db
      .col('verification_requests')
      .find({ $and: [{ collegeId: auth.collegeId, status: request.query.status, ...(request.query.kind ? { kind: request.query.kind } : {}) }, newerThan('createdAt', decodeCursor(request.query.cursor)) as Filter<VerificationRequest>] })
      .sort({ createdAt: 1, _id: 1 })
      .limit(request.query.limit + 1)
      .toArray();
    const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(r.createdAt, r._id));
    const [people, details, files] = await Promise.all([
      loadPeople(app.deps, items.map((r) => r.userId)),
      users().find({ _id: { $in: items.map((r) => r.userId) } }, { projection: { email: 1, roleInfo: 1, pendingRole: 1, phone: 1, dateOfBirth: 1, collegeId: 1 } }).toArray(),
      db.col('files').find({ _id: { $in: items.map((r) => r.fileId).filter((x): x is string => Boolean(x)) }, status: 'ready' }).toArray(),
    ]);
    const detailBy = new Map(details.map((d) => [d._id, d]));
    const collegeNames = new Map((await db.col('colleges').find({ _id: { $in: details.map((d) => d.collegeId) } }, { projection: { name: 1 } }).toArray()).map((c) => [c._id, c.name]));
    return {
      items: await Promise.all(
        items.map(async (r) => {
          const f = files.find((x) => x._id === r.fileId);
          const d = detailBy.get(r.userId);
          return {
            id: r._id,
            kind: r.kind,
            status: r.status,
            note: r.note,
            reviewerNote: r.reviewerNote,
            person: personOf(people, r.userId),
            // What they told us at sign-up, so the reviewer can check it.
            email: d?.email ?? null,
            phone: d?.phone ?? null,
            age: d?.dateOfBirth ? ageOn(d.dateOfBirth, new Date()) : null,
            college: d ? (collegeNames.get(d.collegeId) ?? null) : null,
            roleInfo: d?.roleInfo ?? {},
            documentUrl: f ? await app.deps.storage.signedUrl({ id: f._id, storageKey: f.storageKey, originalName: f.originalName, mimeType: f.mimeType }, 'original', 600) : null,
            createdAt: r.createdAt.toISOString(),
          };
        }),
      ),
      nextCursor,
    };
  });

  app.post(
    '/verifications/:id/decision',
    { schema: { tags: ['admin'], summary: 'Approve or reject a verification or role request', params: idParam, body: z.object({ decision: z.enum(['approve', 'reject']), note: optionalText(500) }) } },
    async (request) => {
      const auth = requireRole(request, ...MODERATION_ROLES);
      const approve = request.body.decision === 'approve';
      const pending = await db.col('verification_requests').findOne({ _id: request.params.id, collegeId: auth.collegeId, status: 'pending' });
      if (!pending) throw Errors.notFound('This pending request');
      const roleRequest = pending.kind === 'faculty_role' || pending.kind === 'expert_role';
      if (roleRequest && auth.role !== 'admin') throw Errors.forbidden('Only admins can grant faculty or expert roles.');
      await db.tx(async (session) => {
        const now = new Date();
        await db.col('verification_requests').updateOne({ _id: pending._id }, { $set: { status: approve ? 'approved' : 'rejected', reviewerId: auth.userId, reviewerNote: request.body.note ?? null, reviewedAt: now, updatedAt: now } }, { session });
        if (approve && pending.kind === 'student_id') await users().updateOne({ _id: pending.userId }, { $set: { 'profile.isVerified': true } }, { session });
        if (roleRequest) {
          // Approved: the requested role, and they can sign in. Rejected: the sign-up is closed
          // (it never had access), so someone posing as faculty cannot get in.
          const set: Document = { pendingRole: null, updatedAt: now };
          if (approve) Object.assign(set, { role: pending.kind === 'faculty_role' ? 'faculty' : 'expert', 'profile.isVerified': true });
          else Object.assign(set, { status: 'suspended' });
          await users().updateOne({ _id: pending.userId }, { $set: set }, { session });
        }
        const u = await users().findOne({ _id: pending.userId }, { session, projection: { email: 1, 'profile.displayName': 1 } });
        if (u) await app.deps.mailer.enqueue({ to: u.email, template: 'verification_decision', userId: pending.userId, payload: { name: u.profile.displayName.split(' ')[0], approved: approve, note: request.body.note ?? null } }, session);
        await audit(db, { action: `admin.verification_${request.body.decision}`, actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'verification_request', entityId: pending._id, requestId: request.id, meta: { kind: pending.kind } }, session);
      });
      await app.sessions.invalidateUser(pending.userId);
      const what = pending.kind === 'faculty_role' ? 'faculty access' : pending.kind === 'expert_role' ? 'expert access' : 'verification';
      await app.deps.notifier.send({ userId: pending.userId, kind: 'verification', title: approve ? `Your ${what} was approved` : `Your ${what} request was not approved`, body: request.body.note ?? '', link: '/settings', actorId: auth.userId });
      return { status: approve ? 'approved' : 'rejected' };
    },
  );

  // ---------------------------------------------------------------- reports
  app.get(
    '/reports',
    { schema: { tags: ['admin'], summary: 'Report queue, most urgent first', querystring: pageQuery.extend({ status: z.enum(['open', 'reviewing', 'actioned', 'dismissed']).default('open') }) } },
    async (request) => {
      const auth = requireRole(request, ...MODERATION_ROLES);
      const after = decodeCursor(request.query.cursor);
      const [afterPriority, afterAt] = after ? after.at.split('|') : [];
      // One row per reported item, with how many people reported it and why.
      const rows = await db
        .col('reports')
        .aggregate<{ _id: { t: string; i: string }; priority: number; reports: number; reasons: string[]; firstAt: Date; lastAt: Date; details: Array<string | null>; reportId: string }>([
          { $match: { collegeId: auth.collegeId, status: request.query.status } },
          { $sort: { createdAt: 1 } },
          { $group: { _id: { t: '$targetType', i: '$targetId' }, priority: { $min: '$priority' }, reports: { $sum: 1 }, reasons: { $addToSet: '$reason' }, firstAt: { $min: '$createdAt' }, lastAt: { $max: '$createdAt' }, details: { $push: '$details' }, reportId: { $first: '$_id' } } },
          ...(after
            ? [{ $match: { $or: [{ priority: { $gt: Number(afterPriority) } }, { priority: Number(afterPriority), firstAt: { $gt: new Date(afterAt!) } }, { priority: Number(afterPriority), firstAt: new Date(afterAt!), reportId: { $gt: after.id } }] } }]
            : []),
          { $sort: { priority: 1, firstAt: 1, reportId: 1 } },
          { $limit: request.query.limit + 1 },
        ])
        .toArray();
      const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(`${r.priority}|${r.firstAt.toISOString()}`, r.reportId));
      return {
        items: await Promise.all(
          items.map(async (r) => {
            const type = (TARGET_TYPES as readonly string[]).includes(r._id.t) ? (r._id.t as TargetType) : null;
            const target = type ? await lookupTarget(db, type, r._id.i) : null;
            return {
              reportId: r.reportId,
              targetType: type,
              targetId: r._id.i,
              priority: r.priority,
              reports: r.reports,
              reasons: r.reasons,
              details: r.details.filter((d): d is string => Boolean(d)).slice(-3).reverse(),
              // Moderators see the content, never the hidden author of anonymous content.
              preview: target?.preview ?? '(already deleted)',
              anonymous: target?.anonymous ?? false,
              firstReportedAt: r.firstAt.toISOString(),
              lastReportedAt: r.lastAt.toISOString(),
            };
          }),
        ),
        nextCursor,
      };
    },
  );

  app.post(
    '/reports/action',
    {
      schema: {
        tags: ['admin'],
        summary: 'Act on a reported item (resolves every open report about it)',
        body: z.object({
          targetType: z.enum(TARGET_TYPES),
          targetId: uuid,
          action: z.enum(['dismiss', 'hide', 'remove', 'restore', 'warn', 'suspend_user']),
          note: optionalText(1000),
        }),
      },
    },
    async (request) => {
      const auth = requireRole(request, ...MODERATION_ROLES);
      const b = request.body;
      const def = TARGETS[b.targetType];
      const target = await lookupTarget(db, b.targetType, b.targetId);
      if (!target || target.collegeId !== auth.collegeId) throw Errors.notFound('That item');
      if ((b.action === 'hide' && !def.hide) || (b.action === 'remove' && !def.remove) || (b.action === 'restore' && !def.restore)) {
        throw Errors.badRequest(`This kind of item cannot be ${b.action}d. Warn or suspend the person instead.`);
      }
      await db.tx(async (session) => {
        if (b.action === 'hide' || b.action === 'remove' || b.action === 'restore') await applyTarget(db, b.targetType, b.targetId, b.action, session);
        if (b.action === 'suspend_user') {
          if (!target.ownerId) throw Errors.badRequest('This item has no account to suspend.');
          await users().updateOne({ _id: target.ownerId, role: { $nin: ['admin', 'moderator'] } }, { $set: { status: 'suspended', updatedAt: new Date() } }, { session });
          await app.sessions.revokeAll(target.ownerId, 'suspended', undefined, session);
          if (def.remove) await applyTarget(db, b.targetType, b.targetId, 'remove', session);
        }
        const first = await db.col('reports').find({ targetType: b.targetType, targetId: b.targetId }, { session }).sort({ createdAt: 1 }).limit(1).next();
        await db.col('moderation_actions').insertOne(
          { _id: uuidv7(), collegeId: auth.collegeId, actorId: auth.userId, targetType: b.targetType, targetId: b.targetId, action: b.action === 'dismiss' ? 'dismiss_report' : b.action, reason: b.note ?? null, reportId: first?._id ?? null, createdAt: new Date() },
          { session },
        );
        await db.col('reports').updateMany(
          { targetType: b.targetType, targetId: b.targetId, isOpen: true },
          { $set: { status: b.action === 'dismiss' || b.action === 'restore' ? 'dismissed' : 'actioned', isOpen: false, resolutionNote: b.note ?? null, resolvedBy: auth.userId, resolvedAt: new Date(), updatedAt: new Date() } },
          { session },
        );
        await audit(db, { action: `moderation.${b.action}`, actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: b.targetType, entityId: b.targetId, requestId: request.id, meta: { note: b.note } }, session);
      });
      if (target.ownerId && ['warn', 'remove', 'hide', 'suspend_user'].includes(b.action)) {
        const titles: Record<string, string> = { warn: 'A moderator sent you a warning', remove: 'Something you shared was removed', hide: 'Something you shared was hidden', suspend_user: 'Your account was suspended' };
        await app.deps.notifier.send({ userId: target.ownerId, kind: 'moderation', title: titles[b.action]!, body: b.note ?? 'It broke the community guidelines.', link: '/safety' });
      }
      return { status: 'done' };
    },
  );

  // ---------------------------------------------------------------- approval queue
  app.get('/queue', { schema: { tags: ['admin'], summary: 'Spaces, events, opportunities, Shelf uploads and lectures waiting for approval' } }, async (request) => {
    const auth = requireRole(request, ...STAFF_ROLES);
    const result: Record<string, unknown[]> = {};
    for (const type of QUEUE_TYPES) {
      const def = QUEUE[type];
      const rows = await db.raw<Doc>(def.collection).find({ collegeId: auth.collegeId, ...def.pending }).sort({ createdAt: 1 }).limit(50).toArray();
      const people = await loadPeople(app.deps, rows.map((r) => r[def.owner] as string | null));
      result[type] = rows.map((r) => ({ id: r._id, title: r[def.title], submittedBy: personOf(people, r[def.owner] as string | null), link: def.link(r._id, r.slug as string | undefined), submittedAt: (r.createdAt as Date).toISOString() }));
    }
    return result;
  });

  app.post(
    '/queue/:type/:id',
    { schema: { tags: ['admin'], summary: 'Approve or reject a submission', params: z.object({ type: z.enum(QUEUE_TYPES), id: uuid }), body: z.object({ decision: z.enum(['approve', 'reject']), note: optionalText(500) }) } },
    async (request) => {
      const auth = requireRole(request, ...STAFF_ROLES);
      const { type, id } = request.params;
      if ((type === 'space' || type === 'event' || type === 'opportunity') && auth.role === 'faculty') throw Errors.forbidden('Admins and moderators review these.');
      const def = QUEUE[type];
      const approve = request.body.decision === 'approve';
      const row = await db.tx(async (session) => {
        const r = await db.raw<Doc>(def.collection).findOneAndUpdate(
          { _id: id, collegeId: auth.collegeId, ...def.pending },
          { $set: { ...(approve ? def.approve() : def.reject()), updatedAt: new Date(), ...(type === 'resource' ? { reviewerId: auth.userId, reviewNote: request.body.note ?? null } : {}) } },
          { session },
        );
        if (!r) throw Errors.notFound('This submission');
        await audit(db, { action: `admin.queue_${request.body.decision}`, actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: type, entityId: id, requestId: request.id, meta: { note: request.body.note } }, session);
        return r;
      });
      // An approved Shelf upload counts towards its subject.
      if (type === 'resource' && approve && row.subjectId) await db.col('subjects').updateOne({ _id: row.subjectId as string }, { $inc: { resourcesCount: 1 } });
      const owner = row[def.owner] as string | null;
      if (owner) {
        await app.deps.notifier.send({
          userId: owner,
          kind: 'verification',
          title: approve ? `"${row[def.title]}" was approved and is live` : `"${row[def.title]}" was not approved`,
          body: request.body.note ?? '',
          link: def.link(id, row.slug as string | undefined),
          actorId: auth.userId,
        });
      }
      return { status: approve ? 'approved' : 'rejected' };
    },
  );

  // ---------------------------------------------------------------- feature flags
  app.get('/flags', { schema: { tags: ['admin'], summary: 'Feature switches and rollouts' } }, async (request) => {
    requireRole(request, 'admin');
    const rows = await app.deps.flags.list();
    return { items: rows.map((f) => ({ key: f.key, description: f.description || FLAG_DEFAULTS[f.key]?.description || '', enabled: f.enabled, rolloutPercent: f.rolloutPercent, allowedRoles: f.allowedRoles, allowedCollegeIds: f.allowedCollegeIds, updatedAt: new Date(f.updatedAt).toISOString() })) };
  });

  app.patch(
    '/flags/:key',
    {
      schema: {
        tags: ['admin'],
        summary: 'Switch a feature on/off or change its rollout (takes effect within seconds, no restart)',
        params: z.object({ key: z.string().regex(/^[a-z0-9_.-]{2,64}$/) }),
        body: z.object({ enabled: z.boolean().optional(), rolloutPercent: z.number().int().min(0).max(100).optional(), allowedRoles: z.array(z.enum(ROLES)).optional() }),
      },
    },
    async (request) => {
      const auth = requireRole(request, 'admin');
      const { key } = request.params;
      const defaults = FLAG_DEFAULTS[key];
      if (!defaults) throw Errors.notFound('This feature switch');
      const b = request.body;
      const now = new Date();
      const set: Document = { updatedBy: auth.userId, updatedAt: now };
      if (b.enabled !== undefined) set.enabled = b.enabled;
      if (b.rolloutPercent !== undefined) set.rolloutPercent = b.rolloutPercent;
      if (b.allowedRoles !== undefined) set.allowedRoles = b.allowedRoles;
      const insert: Document = { description: defaults.description, enabled: defaults.enabled, rolloutPercent: 100, allowedRoles: [], allowedCollegeIds: [], createdAt: now };
      for (const k of Object.keys(set)) delete insert[k];
      await db.tx(async (session) => {
        await db.col('feature_flags').updateOne({ _id: key }, { $set: set, $setOnInsert: insert }, { upsert: true, session });
        await audit(db, { action: 'admin.flag_update', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'flag', meta: { key, ...b } }, session);
      });
      app.deps.flags.invalidate();
      app.deps.realtime.toAll({ type: 'flags.changed' });
      return { status: 'saved' };
    },
  );

  // ---------------------------------------------------------------- audit log
  app.get(
    '/audit',
    { schema: { tags: ['admin'], summary: 'Who did what, when', querystring: pageQuery.extend({ action: z.string().regex(/^[a-z_.]{1,64}$/).optional(), actorId: uuid.optional(), entityId: uuid.optional() }) } },
    async (request) => {
      const auth = requireRole(request, 'admin');
      const { action, actorId, entityId, cursor, limit } = request.query;
      const and: Filter<AuditLog>[] = [{ collegeId: { $in: [auth.collegeId, null] }, createdAt: { $gt: new Date(Date.now() - 180 * 86_400_000) } }];
      if (action) and.push({ action: { $regex: `^${action.replace(/\./g, '\\.')}` } });
      if (actorId) and.push({ actorId });
      if (entityId) and.push({ entityId });
      and.push(olderThan('createdAt', decodeCursor(cursor)) as Filter<AuditLog>);
      const rows = await db.col('audit_logs').find({ $and: and }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
      const people = await loadPeople(app.deps, items.map((r) => r.actorId));
      return {
        items: items.map((r) => ({ id: r._id, at: r.createdAt.toISOString(), action: r.action, actor: r.actorId ? { id: r.actorId, name: people.get(r.actorId)?.displayName ?? 'Deleted user', role: r.actorRole } : null, entity: r.entityType ? { type: r.entityType, id: r.entityId } : null, meta: r.meta })),
        nextCursor,
      };
    },
  );

  // ---------------------------------------------------------------- identity reveal (two admins)
  app.get('/identity-reveals', { schema: { tags: ['admin'], summary: 'Requests to reveal who wrote anonymous content' } }, async (request) => {
    const auth = requireRole(request, 'admin');
    await db.col('identity_reveals').updateMany({ status: 'pending', createdAt: { $lt: new Date(Date.now() - 7 * 86_400_000) } }, { $set: { status: 'expired' } });
    const rows = await db.col('identity_reveals').find({ collegeId: auth.collegeId }).sort({ createdAt: -1 }).limit(100).toArray();
    const people = await loadPeople(app.deps, rows.flatMap((r) => [r.requestedBy, r.decidedBy]));
    return {
      items: rows.map((r) => ({
        id: r._id,
        contentType: r.contentType,
        contentId: r.contentId,
        reason: r.reason,
        status: r.status,
        requestedBy: { id: r.requestedBy, name: people.get(r.requestedBy)?.displayName ?? 'Deleted user' },
        decidedBy: r.decidedBy ? { id: r.decidedBy, name: people.get(r.decidedBy)?.displayName ?? 'Deleted user' } : null,
        canDecide: r.status === 'pending' && r.requestedBy !== auth.userId,
        createdAt: r.createdAt.toISOString(),
        decidedAt: r.decidedAt?.toISOString() ?? null,
      })),
    };
  });

  app.post(
    '/identity-reveals',
    { schema: { tags: ['admin'], summary: 'Ask to reveal an anonymous author (needs a second admin)', body: z.object({ contentType: z.enum(['post', 'comment', 'hush_question', 'hush_answer']), contentId: uuid, reason: text(10, 1000) }) } },
    async (request, reply) => {
      const auth = requireRole(request, 'admin');
      const b = request.body;
      const exists = await db.col('anonymous_authors').findOne({ _id: `${b.contentType}:${b.contentId}` }, { projection: { _id: 1 } });
      if (!exists) throw Errors.notFound('Anonymous content with this id');
      const id = uuidv7();
      await db.tx(async (session) => {
        await db.col('identity_reveals').insertOne({ _id: id, collegeId: auth.collegeId, contentType: b.contentType, contentId: b.contentId, reason: b.reason, requestedBy: auth.userId, status: 'pending', decidedBy: null, decidedAt: null, createdAt: new Date() }, { session });
        await audit(db, { action: 'admin.identity_reveal_requested', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: b.contentType, entityId: b.contentId, requestId: request.id, meta: { reason: b.reason } }, session);
      });
      const others = await users().find({ collegeId: auth.collegeId, role: 'admin', status: 'active', _id: { $ne: auth.userId } }, { projection: { _id: 1 } }).toArray();
      await app.deps.notifier.send(others.map((o) => ({ userId: o._id, kind: 'security' as const, title: 'An identity reveal needs your decision', link: '/admin/moderation', actorId: auth.userId })));
      return reply.status(201).send({ id, status: 'pending' });
    },
  );

  app.post(
    '/identity-reveals/:id/decision',
    { schema: { tags: ['admin'], summary: 'Approve or reject a reveal (a different admin than the requester)', params: idParam, body: z.object({ decision: z.enum(['approve', 'reject']) }) } },
    async (request) => {
      const auth = requireRole(request, 'admin');
      const approve = request.body.decision === 'approve';
      const r = await db.col('identity_reveals').findOne({ _id: request.params.id, collegeId: auth.collegeId, status: 'pending', createdAt: { $gt: new Date(Date.now() - 7 * 86_400_000) } });
      if (!r) throw Errors.notFound('This pending request');
      if (r.requestedBy === auth.userId) throw Errors.forbidden('A different admin must approve your own request.');
      const author = await db.tx(async (session) => {
        const res = await db.col('identity_reveals').updateOne({ _id: r._id, status: 'pending' }, { $set: { status: approve ? 'approved' : 'rejected', decidedBy: auth.userId, decidedAt: new Date() } }, { session });
        if (!res.modifiedCount) throw Errors.conflict('Another admin decided this request a moment ago.');
        let found: { userId: string } | null = null;
        if (approve) {
          found = await db.col('anonymous_authors').findOne({ _id: `${r.contentType}:${r.contentId}` }, { session, projection: { userId: 1 } });
          await db.col('moderation_actions').insertOne({ _id: uuidv7(), collegeId: auth.collegeId, actorId: auth.userId, targetType: r.contentType, targetId: r.contentId, action: 'reveal_identity', reason: 'Approved by a second admin', reportId: null, createdAt: new Date() }, { session });
        }
        await audit(db, { action: `admin.identity_reveal_${request.body.decision}`, actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: r.contentType, entityId: r.contentId, requestId: request.id, meta: { requestId: r._id, requestedBy: r.requestedBy } }, session);
        return found;
      });
      await app.deps.notifier.send({ userId: r.requestedBy, kind: 'security', title: approve ? 'Your identity reveal request was approved' : 'Your identity reveal request was rejected', link: '/admin/moderation', actorId: auth.userId });
      let person = null;
      if (author) {
        const [people, u] = await Promise.all([loadPeople(app.deps, [author.userId]), users().findOne({ _id: author.userId }, { projection: { email: 1 } })]);
        person = { ...personOf(people, author.userId), email: u?.email ?? null };
      }
      return { status: approve ? 'approved' : 'rejected', author: person };
    },
  );

  // ---------------------------------------------------------------- system
  app.get('/system', { schema: { tags: ['admin'], summary: 'Background jobs, modules and email delivery' } }, async (request) => {
    requireRole(request, 'admin');
    const [jobs, outbox] = await Promise.all([
      db.col('job_runs').find({}).sort({ _id: 1 }).toArray(),
      db.col('email_outbox').aggregate<{ _id: string; n: number }>([{ $match: { createdAt: { $gt: new Date(Date.now() - 7 * 86_400_000) } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    ]);
    return {
      jobs: jobs.map((j) => ({ name: j._id, lastStartedAt: j.lastStartedAt?.toISOString() ?? null, lastFinishedAt: j.lastFinishedAt?.toISOString() ?? null, lastStatus: j.lastStatus, lastError: j.lastError, lastDurationMs: j.lastDurationMs, runs: j.runCount })),
      modules: moduleHealth(),
      email: { mode: app.deps.mailer.mode, last7Days: Object.fromEntries(outbox.map((o) => [o._id, o.n])) },
      realtime: app.deps.realtime.stats(),
      cache: app.deps.cache.status(),
      database: db.stats(),
    };
  });

  app.post(
    '/jobs/:name/run',
    { schema: { tags: ['admin'], summary: 'Run a background job now (cleanup, exports, deletions...)', params: z.object({ name: z.string().regex(/^[a-z-]{2,40}$/) }) } },
    async (request) => {
      const auth = requireRole(request, 'admin');
      if (!app.deps.scheduler.list().some((j) => j.name === request.params.name)) throw Errors.notFound('This job');
      const ran = await app.deps.scheduler.runNow(request.params.name);
      await audit(db, { action: 'admin.job_run', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, requestId: request.id, meta: { job: request.params.name, ran } });
      const row = await db.col('job_runs').findOne({ _id: request.params.name });
      return { ran, lastStatus: row?.lastStatus ?? null, lastError: row?.lastError ?? null, durationMs: row?.lastDurationMs ?? null };
    },
  );

  app.get(
    '/emails',
    { schema: { tags: ['admin'], summary: 'Email outbox (and the dev mailbox when MAIL_TRANSPORT=dev)', querystring: pageQuery.extend({ status: z.enum(['queued', 'sending', 'sent', 'failed', 'dead', 'suppressed']).optional(), to: z.string().trim().max(254).optional() }) } },
    async (request) => {
      requireRole(request, 'admin');
      const { status, to, cursor, limit } = request.query;
      const and: Filter<EmailOutbox>[] = [];
      if (status) and.push({ status });
      if (to) and.push({ toEmail: contains(to) });
      and.push(olderThan('createdAt', decodeCursor(cursor)) as Filter<EmailOutbox>);
      const rows = await db.col('email_outbox').find({ $and: and }, { projection: { renderedHtml: 0, renderedText: 0, payload: 0 } }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
      return { mode: app.deps.mailer.mode, items: items.map((r) => ({ id: r._id, to: r.toEmail, template: r.template, category: r.category, status: r.status, attempts: r.attempts, lastError: r.lastError, subject: r.renderedSubject, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null })), nextCursor };
    },
  );

  app.get('/emails/:id', { schema: { tags: ['admin'], summary: 'Read one email (dev mailbox only shows the body)', params: idParam } }, async (request, reply) => {
    requireRole(request, 'admin');
    const r = await db.col('email_outbox').findOne({ _id: request.params.id });
    if (!r) throw Errors.notFound('This email');
    // Real emails may contain sign-in links; their bodies are shown only in local development.
    const showBody = app.deps.mailer.mode === 'dev' && !app.deps.config.isProd;
    reply.header('cache-control', 'no-store');
    return { id: r._id, to: r.toEmail, template: r.template, status: r.status, subject: r.renderedSubject, html: showBody ? r.renderedHtml : null, text: showBody ? r.renderedText : null, createdAt: r.createdAt.toISOString() };
  });

  app.post('/emails/:id/retry', { schema: { tags: ['admin'], summary: 'Retry a failed email now', params: idParam } }, async (request) => {
    const auth = requireRole(request, 'admin');
    const res = await db.col('email_outbox').updateOne({ _id: request.params.id, status: { $in: ['failed', 'dead'] } }, { $set: { status: 'queued', nextAttemptAt: new Date(), attempts: 0, lockedAt: null } });
    if (!res.modifiedCount) throw Errors.notFound('A failed email with this id');
    await audit(db, { action: 'admin.email_retry', actorId: auth.userId, entityType: 'email', entityId: request.params.id, requestId: request.id });
    return { status: 'queued' };
  });

  // ---------------------------------------------------------------- contact inbox & data requests
  app.get('/contact', { schema: { tags: ['admin'], summary: 'Contact form inbox', querystring: pageQuery.extend({ status: z.enum(['new', 'in_progress', 'resolved', 'spam']).default('new') }) } }, async (request) => {
    requireRole(request, 'admin');
    const rows = await db
      .col('contact_messages')
      .find({ $and: [{ status: request.query.status }, olderThan('createdAt', decodeCursor(request.query.cursor)) as Filter<ContactMessage>] })
      .sort({ createdAt: -1, _id: -1 })
      .limit(request.query.limit + 1)
      .toArray();
    const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(r.createdAt, r._id));
    return { items: items.map((r) => ({ id: r._id, name: r.name, email: r.email, topic: r.topic, subject: r.subject, message: r.message, status: r.status, utm: r.utm, createdAt: r.createdAt.toISOString() })), nextCursor };
  });

  app.patch('/contact/:id', { schema: { tags: ['admin'], summary: 'Update a contact message status', params: idParam, body: z.object({ status: z.enum(['new', 'in_progress', 'resolved', 'spam']) }) } }, async (request) => {
    requireRole(request, 'admin');
    const res = await db.col('contact_messages').updateOne({ _id: request.params.id }, { $set: { status: request.body.status, updatedAt: new Date() } });
    if (!res.matchedCount) throw Errors.notFound('This message');
    return { status: request.body.status };
  });

  app.get('/data-requests', { schema: { tags: ['admin'], summary: 'Data export and deletion requests' } }, async (request) => {
    requireRole(request, 'admin');
    const rows = await db.col('data_requests').find({}).sort({ createdAt: -1 }).limit(200).toArray();
    return { items: rows.map((r) => ({ id: r._id, email: r.email, kind: r.kind, status: r.status, scheduledFor: r.scheduledFor?.toISOString() ?? null, requestedAt: r.createdAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null, lastError: r.lastError })) };
  });

  app.post('/data-requests/:id/run', { schema: { tags: ['admin'], summary: 'Prepare an export now', params: idParam } }, async (request) => {
    const auth = requireRole(request, 'admin');
    const r = await db.col('data_requests').findOne({ _id: request.params.id, status: { $in: ['pending', 'failed'] } });
    const u = r?.userId ? await users().findOne({ _id: r.userId }, { projection: { collegeId: 1 } }) : null;
    if (!r || r.kind !== 'export' || !r.userId || !u) throw Errors.notFound('A pending export request');
    await completeExport(app.deps, r._id, r.userId, u.collegeId);
    await audit(db, { action: 'admin.export_run', actorId: auth.userId, entityType: 'data_request', entityId: r._id, requestId: request.id });
    return { status: 'completed' };
  });

  // ---------------------------------------------------------------- colleges
  // Admins add the colleges people can choose when they sign up, and can pause one.
  app.get('/colleges', { schema: { tags: ['admin'], summary: 'Colleges people can sign up to' } }, async (request) => {
    requireRole(request, 'admin');
    const rows = await db.col('colleges').find({}).sort({ createdAt: 1 }).limit(500).toArray();
    const counts = await users()
      .aggregate<{ _id: string; n: number }>([{ $match: { status: { $ne: 'deleted' } } }, { $group: { _id: '$collegeId', n: { $sum: 1 } } }])
      .toArray();
    const deps = await db.col('departments').aggregate<{ _id: string; n: number }>([{ $group: { _id: '$collegeId', n: { $sum: 1 } } }]).toArray();
    const people = new Map(counts.map((c) => [c._id, c.n]));
    const departments = new Map(deps.map((c) => [c._id, c.n]));
    const deptNames = new Map<string, string[]>();
    for (const d of await db.col('departments').find({}, { projection: { collegeId: 1, name: 1 } }).sort({ name: 1 }).limit(5000).toArray()) deptNames.set(d.collegeId, [...(deptNames.get(d.collegeId) ?? []), d.name]);
    return {
      items: rows.map((c) => ({ id: c._id, name: c.name, shortName: c.shortName, slug: c.slug, city: c.city, state: c.state, status: c.status, people: people.get(c._id) ?? 0, departments: departments.get(c._id) ?? 0, departmentNames: deptNames.get(c._id) ?? [], createdAt: c.createdAt.toISOString() })),
    };
  });

  /** Department documents for the given names, skipping any already present, each with a short unique code. */
  const departmentDocs = (collegeId: string, names: string[], existing: Array<{ code: string; name: string }>, now: Date) => {
    const taken = new Set(existing.map((d) => d.name.toLowerCase()));
    const used = new Set(existing.map((d) => d.code));
    const docs: Array<{ _id: string; collegeId: string; code: string; name: string; createdAt: Date }> = [];
    for (const name of [...new Set(names.map((n) => cleanText(n)))]) {
      if (taken.has(name.toLowerCase())) continue;
      taken.add(name.toLowerCase());
      let code = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('').slice(0, 8) || 'DEPT';
      if (code.length < 2) code = `${code}X`;
      let n = 2;
      const base = code;
      while (used.has(code)) code = `${base.slice(0, 10)}${n++}`;
      used.add(code);
      docs.push({ _id: uuidv7(), collegeId, code, name, createdAt: now });
    }
    return docs;
  };

  const collegeBody = z.object({
    name: text(3, 160),
    shortName: text(2, 40),
    city: optionalText(80),
    state: optionalText(80),
    // Department names, one per line on the form (for the class step when people set up).
    departments: z.array(text(2, 120)).max(40).default([]),
  });
  app.post('/colleges', { schema: { tags: ['admin'], summary: 'Add a college', body: collegeBody } }, async (request, reply) => {
    const auth = requireRole(request, 'admin');
    // CampusConnect is one shared community, so there is nothing to split people into.
    throw Errors.conflict('CampusConnect is a single shared community, so more colleges cannot be added.');
    const b = request.body;
    const slugBase = b.shortName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'college';
    let slug = slugBase.length >= 2 ? slugBase : `${slugBase}-college`;
    if (await db.col('colleges').findOne({ slug }, { projection: { _id: 1 } })) slug = `${slug.slice(0, 34)}-${Math.floor(100 + Math.random() * 900)}`;
    if (await db.col('colleges').findOne({ name: { $regex: `^${b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }, { projection: { _id: 1 } })) {
      throw Errors.conflict('A college with this name already exists.');
    }
    const now = new Date();
    const id = uuidv7();
    await db.tx(async (session) => {
      await db.col('colleges').insertOne(
        { _id: id, slug, name: cleanText(b.name), shortName: cleanText(b.shortName), city: b.city ? cleanText(b.city) : null, state: b.state ? cleanText(b.state) : null, timezone: 'Asia/Kolkata', shard: 'default', status: 'active', domains: [], settings: {}, createdAt: now, updatedAt: now },
        { session },
      );
      const deptDocs = departmentDocs(id, b.departments, [], now);
      if (deptDocs.length) await db.col('departments').insertMany(deptDocs, { session });
      await audit(db, { action: 'admin.college_create', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'college', entityId: id, requestId: request.id, meta: { name: b.name } }, session);
    });
    await app.deps.cache.del('meta:colleges');
    return reply.status(201).send({ id, slug });
  });

  app.patch(
    '/colleges/:id',
    { schema: { tags: ['admin'], summary: 'Rename a college, pause new sign-ups to it, or add departments', params: idParam, body: z.object({ name: text(3, 160).optional(), shortName: text(2, 40).optional(), city: optionalText(80), state: optionalText(80), status: z.enum(['active', 'suspended']).optional(), addDepartments: z.array(text(2, 120)).max(40).optional() }) } },
    async (request) => {
      const auth = requireRole(request, 'admin');
      const b = request.body;
      const set: Document = { updatedAt: new Date() };
      if (b.name) set.name = cleanText(b.name);
      if (b.shortName) set.shortName = cleanText(b.shortName);
      if (b.city !== undefined) set.city = b.city ? cleanText(b.city) : null;
      if (b.state !== undefined) set.state = b.state ? cleanText(b.state) : null;
      if (b.status) {
        if (b.status === 'suspended' && request.params.id === auth.collegeId) throw Errors.badRequest('You cannot pause your own college.');
        set.status = b.status;
      }
      const res = await db.col('colleges').updateOne({ _id: request.params.id }, { $set: set });
      if (!res.matchedCount) throw Errors.notFound('This college');
      if (b.addDepartments?.length) {
        const existing = await db.col('departments').find({ collegeId: request.params.id }, { projection: { code: 1, name: 1 } }).toArray();
        const docs = departmentDocs(request.params.id, b.addDepartments, existing, new Date());
        if (docs.length) await db.col('departments').insertMany(docs);
      }
      await audit(db, { action: 'admin.college_update', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'college', entityId: request.params.id, requestId: request.id, meta: b });
      await app.deps.cache.del('meta:colleges');
      return { status: 'saved' };
    },
  );

  // Deleting is limited to colleges nobody belongs to (extra or test colleges). A college with people
  // can be paused instead, which hides it from new sign-ups without touching anyone's account.
  app.delete('/colleges/:id', { schema: { tags: ['admin'], summary: 'Delete a college that has no people', params: idParam } }, async (request) => {
    const auth = requireRole(request, 'admin');
    const id = request.params.id;
    if (id === auth.collegeId) throw Errors.badRequest('You cannot delete your own college.');
    const college = await db.col('colleges').findOne({ _id: id }, { projection: { name: 1 } });
    if (!college) throw Errors.notFound('This college');
    const people = await users().countDocuments({ collegeId: id, status: { $ne: 'deleted' } });
    if (people) throw Errors.conflict(`This college still has ${people} ${people === 1 ? 'person' : 'people'}. Pause it instead, which hides it from new sign-ups.`);

    // Remove what belongs to the college: departments, subjects, anything else carrying its id.
    // Audit records and uploaded files are kept (the deletion itself is audited below).
    const keep = new Set(['colleges', 'audit_logs', 'files']);
    const names = (await db.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.') && !keep.has(n));
    let removed = 0;
    for (const name of names) removed += (await db.raw(name).deleteMany({ collegeId: id })).deletedCount;
    await db.col('colleges').deleteOne({ _id: id });
    await audit(db, { action: 'admin.college_delete', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'college', entityId: id, requestId: request.id, meta: { name: college.name, removedRecords: removed } });
    await app.deps.cache.del('meta:colleges');
    return { status: 'deleted' };
  });

  // Keeps the role list in one place for the web's admin screens.
  app.get('/roles', { schema: { tags: ['admin'], summary: 'Roles and what each can see' } }, async (request) => {
    requireRole(request, ...STAFF_ROLES);
    return { roles: ROLES as readonly Role[] };
  });
};
