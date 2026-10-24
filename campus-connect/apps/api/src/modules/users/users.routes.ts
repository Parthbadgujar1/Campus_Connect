import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Filter } from 'mongodb';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, escapeRegex, olderThan } from '../../core/query.js';
import { httpsUrl, optionalText, text, uuid } from '../../core/validation.js';
import type { Deps } from '../../deps.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Mongo } from '../../infra/db/mongo.js';
import type { SavedType, User } from '../../infra/db/models.js';
import type { AuthContext } from '../../types/fastify.js';
import { TERMS_VERSION } from '../auth/auth.service.js';
import { loadMe } from './me.js';
import { blockedIds, isBlockedBetween, loadPeople, PERSON_PROJECTION, toPeople, type PersonDoc } from './people.js';

// /v1/me, /v1/users, /v1/consents, /v1/saved — accounts, profiles and the social graph.
//
// Privacy rules for profiles (profile.visibility):
//   profile: "campus"      - anyone signed in at the same college
//            "connections" - only people they follow back (mutual) see the full profile
//   showBranch / showEmail - whether department/year and the email address are shown
// Blocking hides both people from each other everywhere and removes follows both ways.

const NOTIFICATION_KINDS = [
  'message', 'mention', 'comment', 'reply', 'like', 'follow', 'event', 'deadline', 'opportunity',
  'application', 'space', 'announcement', 'moderation', 'verification', 'system', 'security', 'survey',
] as const;
const SAVED_TYPES = ['post', 'discussion', 'event', 'opportunity', 'listing', 'resource', 'lecture', 'hush_question'] as const;
const SAVED_COLLECTION: Record<SavedType, 'posts' | 'discussions' | 'events' | 'opportunities' | 'listings' | 'resources' | 'lectures' | 'hush_questions'> = {
  post: 'posts', discussion: 'discussions', event: 'events', opportunity: 'opportunities', listing: 'listings',
  resource: 'resources', lecture: 'lectures', hush_question: 'hush_questions',
};

const profilePatch = z
  .object({
    displayName: text(2, 80),
    username: z.string().trim().regex(/^[A-Za-z0-9._]{3,24}$/, 'Use 3-24 letters, numbers, dots or underscores.'),
    headline: optionalText(120).nullable(),
    bio: optionalText(300).nullable(),
    departmentId: uuid.nullable(),
    year: z.number().int().min(1).max(6).nullable(),
    semester: z.number().int().min(1).max(12).nullable(),
    division: z.string().trim().max(8).nullable(),
    skills: z.array(z.string().trim().min(1).max(40)).max(30),
    interests: z.array(z.string().trim().min(1).max(40)).max(30),
    links: z.object({ github: httpsUrl.optional(), linkedin: httpsUrl.optional(), portfolio: httpsUrl.optional(), leetcode: httpsUrl.optional(), twitter: httpsUrl.optional(), instagram: httpsUrl.optional() }),
    avatarFileId: uuid.nullable(),
    messagePrivacy: z.enum(['everyone', 'connections', 'nobody']),
    visibility: z.object({ profile: z.enum(['campus', 'connections']), showBranch: z.boolean(), showEmail: z.boolean(), showActivity: z.boolean(), showOnline: z.boolean().optional() }),
  })
  .partial();

/** Follows (or unfollows) and keeps both people's counters in step. Returns true if it changed. */
export async function setFollow(db: Mongo, followerId: string, followeeId: string, on: boolean): Promise<boolean> {
  return db.tx(async (session) => {
    const follows = db.col('follows');
    const id = `${followerId}:${followeeId}`;
    let changed: boolean;
    if (on) {
      const res = await follows.updateOne({ _id: id }, { $setOnInsert: { followerId, followeeId, createdAt: new Date() } }, { upsert: true, session });
      changed = res.upsertedCount === 1;
    } else {
      changed = (await follows.deleteOne({ _id: id }, { session })).deletedCount === 1;
    }
    if (changed) {
      const d = on ? 1 : -1;
      const users = db.col('users');
      await users.updateOne({ _id: followerId }, [{ $set: { 'profile.followingCount': { $max: [0, { $add: ['$profile.followingCount', d] }] } } }], { session });
      await users.updateOne({ _id: followeeId }, [{ $set: { 'profile.followersCount': { $max: [0, { $add: ['$profile.followersCount', d] }] } } }], { session });
    }
    return changed;
  });
}

async function resolveUser(deps: Deps, auth: AuthContext, idOrUsername: string): Promise<User> {
  const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrUsername);
  const filter: Filter<User> = byId ? { _id: idOrUsername } : { 'profile.usernameLower': idOrUsername.toLowerCase() };
  const u = await deps.db.col('users').findOne({ ...filter, status: { $in: ['active', 'suspended'] } }, { projection: { passwordHash: 0 } });
  // Other colleges' members, accounts leaving, and people in a block relationship are "not found".
  if (!u || u.collegeId !== auth.collegeId) throw Errors.notFound('This person');
  if (u._id !== auth.userId && u.deletionScheduledFor) throw Errors.notFound('This person');
  if (u._id !== auth.userId && (await isBlockedBetween(deps.db, auth.userId, u._id))) throw Errors.notFound('This person');
  return u as User;
}

export const userRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const users = () => db.col('users');

  // ---------------------------------------------------------------- me
  app.get('/me', { schema: { tags: ['me'], summary: 'My account, profile and feature flags' } }, async (request) => {
    const auth = requireAuth(request);
    const [user, flags] = await Promise.all([loadMe(app.deps, auth.userId), app.deps.flags.resolveAll({ userId: auth.userId, role: auth.role, collegeId: auth.collegeId })]);
    return { user, flags };
  });

  app.patch('/me/profile', { schema: { tags: ['me'], summary: 'Edit my profile', body: profilePatch } }, async (request) => {
    const auth = requireAuth(request);
    const b = request.body;
    const set: Record<string, unknown> = {};
    if (b.username !== undefined && b.username.toLowerCase() !== auth.username.toLowerCase()) {
      const taken = await users().findOne({ 'profile.usernameLower': b.username.toLowerCase(), _id: { $ne: auth.userId } }, { projection: { _id: 1 } });
      if (taken) throw Errors.validation([{ field: 'username', message: 'That username is taken.' }]);
    }
    if (b.departmentId) {
      const ok = await db.col('departments').findOne({ _id: b.departmentId, collegeId: auth.collegeId }, { projection: { _id: 1 } });
      if (!ok) throw Errors.validation([{ field: 'departmentId', message: 'Choose a department from your college.' }]);
    }
    if (b.avatarFileId) {
      const file = await db.col('files').findOne({ _id: b.avatarFileId, ownerId: auth.userId, purpose: 'avatar', kind: 'image', status: 'ready' }, { projection: { _id: 1 } });
      if (!file) throw Errors.validation([{ field: 'avatarFileId', message: 'Upload an image first.' }]);
    }
    if (b.displayName !== undefined) set['profile.displayName'] = b.displayName;
    if (b.username !== undefined) {
      set['profile.username'] = b.username;
      set['profile.usernameLower'] = b.username.toLowerCase();
    }
    if (b.headline !== undefined) set['profile.headline'] = b.headline ?? null;
    if (b.bio !== undefined) set['profile.bio'] = b.bio ?? null;
    if (b.departmentId !== undefined) set['profile.departmentId'] = b.departmentId;
    if (b.year !== undefined) set['profile.year'] = b.year;
    if (b.semester !== undefined) set['profile.semester'] = b.semester;
    if (b.division !== undefined) set['profile.division'] = b.division || null;
    if (b.skills !== undefined) set['profile.skills'] = [...new Set(b.skills)];
    if (b.interests !== undefined) set['profile.interests'] = [...new Set(b.interests)];
    if (b.links !== undefined) set['profile.links'] = Object.fromEntries(Object.entries(b.links).filter(([, v]) => v));
    if (b.avatarFileId !== undefined) set['profile.avatarFileId'] = b.avatarFileId;
    if (b.messagePrivacy !== undefined) set['profile.messagePrivacy'] = b.messagePrivacy;
    if (b.visibility !== undefined) set['profile.visibility'] = b.visibility;
    if (Object.keys(set).length) {
      await users().updateOne({ _id: auth.userId }, { $set: { ...set, updatedAt: new Date() } });
      // Name and username are cached in the session; drop the cache so they update everywhere.
      await app.sessions.invalidateUser(auth.userId);
    }
    return { user: await loadMe(app.deps, auth.userId) };
  });

  app.get('/me/notification-preferences', { schema: { tags: ['me'], summary: 'My notification settings' } }, async (request) => {
    const auth = requireAuth(request);
    const u = await users().findOne({ _id: auth.userId }, { projection: { notificationPrefs: 1 } });
    const p = u?.notificationPrefs;
    return {
      inApp: Object.fromEntries(NOTIFICATION_KINDS.map((k) => [k, p?.inApp?.[k] ?? true])),
      email: Object.fromEntries(NOTIFICATION_KINDS.map((k) => [k, p?.email?.[k] ?? false])),
      emailDigest: p?.emailDigest ?? 'weekly',
      marketingEmails: p?.marketingEmails ?? false,
      quietStart: p?.quietStart ?? null,
      quietEnd: p?.quietEnd ?? null,
    };
  });

  // partialRecord: any subset of kinds may be sent (a plain record with enum keys requires all of them).
  const kindMap = z.partialRecord(z.enum(NOTIFICATION_KINDS), z.boolean());
  const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM.').nullable();
  app.put(
    '/me/notification-preferences',
    {
      schema: {
        tags: ['me'],
        summary: 'Update my notification settings',
        body: z.object({ inApp: kindMap.optional(), email: kindMap.optional(), emailDigest: z.enum(['off', 'daily', 'weekly']).optional(), marketingEmails: z.boolean().optional(), quietStart: time.optional(), quietEnd: time.optional() }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const b = request.body;
      const set: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(b.inApp ?? {})) set[`notificationPrefs.inApp.${k}`] = v;
      // Security notices cannot be switched off.
      if (b.inApp) set['notificationPrefs.inApp.security'] = true;
      for (const [k, v] of Object.entries(b.email ?? {})) set[`notificationPrefs.email.${k}`] = v;
      if (b.emailDigest) set['notificationPrefs.emailDigest'] = b.emailDigest;
      if (b.marketingEmails !== undefined) set['notificationPrefs.marketingEmails'] = b.marketingEmails;
      if (b.quietStart !== undefined) set['notificationPrefs.quietStart'] = b.quietStart;
      if (b.quietEnd !== undefined) set['notificationPrefs.quietEnd'] = b.quietEnd;
      await db.tx(async (session) => {
        const before = await users().findOneAndUpdate({ _id: auth.userId }, { $set: { ...set, updatedAt: new Date() } }, { session, returnDocument: 'before', projection: { 'notificationPrefs.marketingEmails': 1 } });
        if (b.marketingEmails !== undefined && b.marketingEmails !== before?.notificationPrefs?.marketingEmails) {
          await db.col('consents').insertOne({ _id: uuidv7(), userId: auth.userId, anonymousId: null, purpose: 'marketing_email', granted: b.marketingEmails, policyVersion: TERMS_VERSION, source: 'settings', ipHash: request.ipHash, createdAt: new Date() }, { session });
        }
      });
      return { status: 'saved' };
    },
  );

  app.get('/me/security', { schema: { tags: ['me'], summary: 'Recent sign-in activity on my account' } }, async (request) => {
    const auth = requireAuth(request);
    const [rows, account] = await Promise.all([
      db.col('login_attempts').find({ userId: auth.userId }).sort({ createdAt: -1 }).limit(30).toArray(),
      users().findOne({ _id: auth.userId }, { projection: { passwordChangedAt: 1, lastLoginAt: 1 } }),
    ]);
    return {
      passwordChangedAt: account?.passwordChangedAt?.toISOString() ?? null,
      lastSignInAt: account?.lastLoginAt?.toISOString() ?? null,
      recentAttempts: rows.map((r) => ({ success: r.success, reason: r.reason, at: r.createdAt.toISOString() })),
    };
  });

  app.get('/me/blocks', { schema: { tags: ['me'], summary: 'People I have blocked' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await db.col('blocks').find({ blockerId: auth.userId }).sort({ createdAt: -1 }).limit(200).toArray();
    const people = await loadPeople(app.deps, rows.map((r) => r.blockedId));
    return { items: rows.map((r) => people.get(r.blockedId)).filter(Boolean) };
  });

  app.post(
    '/me/push-tokens',
    { schema: { tags: ['me'], summary: 'Register this device for push notifications', body: z.object({ token: z.string().min(10).max(512), platform: z.enum(['ios', 'android', 'web']) }) } },
    async (request) => {
      const auth = requireAuth(request);
      await db.col('push_tokens').updateOne(
        { token: request.body.token },
        { $set: { userId: auth.userId, platform: request.body.platform, lastSeenAt: new Date() }, $setOnInsert: { _id: uuidv7(), createdAt: new Date() } },
        { upsert: true },
      );
      return { status: 'registered' };
    },
  );

  app.delete('/me/push-tokens', { schema: { tags: ['me'], summary: 'Stop push notifications on this device', body: z.object({ token: z.string().min(10).max(512) }) } }, async (request) => {
    const auth = requireAuth(request);
    await db.col('push_tokens').deleteOne({ token: request.body.token, userId: auth.userId });
    return { status: 'removed' };
  });

  // ---------------------------------------------------------------- verification requests
  app.get('/me/verification-requests', { schema: { tags: ['me'], summary: 'My verification and role requests' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await db.col('verification_requests').find({ userId: auth.userId }).sort({ createdAt: -1 }).limit(20).toArray();
    return { items: rows.map((r) => ({ id: r._id, kind: r.kind, status: r.status, note: r.note, reviewerNote: r.reviewerNote, reviewedAt: r.reviewedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() })) };
  });

  app.post(
    '/me/verification-requests',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
      schema: { tags: ['me'], summary: 'Ask for a verified badge or the faculty/expert role', body: z.object({ kind: z.enum(['student_id', 'faculty_role', 'expert_role']), fileId: uuid.optional(), note: optionalText(500) }) },
    },
    async (request, reply) => {
      const auth = requireAuth(request);
      const b = request.body;
      if (b.fileId) {
        const file = await db.col('files').findOne({ _id: b.fileId, ownerId: auth.userId, purpose: 'verification', status: 'ready' }, { projection: { _id: 1 } });
        if (!file) throw Errors.validation([{ field: 'fileId', message: 'Upload the document first.' }]);
      }
      const id = uuidv7();
      try {
        await db.col('verification_requests').insertOne({ _id: id, collegeId: auth.collegeId, userId: auth.userId, kind: b.kind, status: 'pending', fileId: b.fileId ?? null, note: b.note ?? null, reviewerId: null, reviewerNote: null, reviewedAt: null, createdAt: new Date(), updatedAt: new Date() });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw Errors.alreadyExists('You already have a request waiting for review.');
        throw err;
      }
      return reply.status(201).send({ id, status: 'pending' });
    },
  );

  // ---------------------------------------------------------------- consents (cookie banner)
  app.post(
    '/consents',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
      schema: {
        tags: ['privacy'],
        summary: 'Record cookie choices (works signed out)',
        body: z.object({ anonymousId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), policyVersion: z.string().min(1).max(32), choices: z.object({ preferences: z.boolean(), analytics: z.boolean(), marketing: z.boolean() }) }),
      },
    },
    async (request) => {
      const b = request.body;
      const now = new Date();
      const choices = [['necessary', true], ['preferences', b.choices.preferences], ['analytics', b.choices.analytics], ['marketing', b.choices.marketing]] as const;
      await db.col('consents').insertMany(
        choices.map(([purpose, granted]) => ({ _id: uuidv7(), userId: request.auth?.userId ?? null, anonymousId: b.anonymousId, purpose, granted, policyVersion: b.policyVersion, source: 'banner' as const, ipHash: request.ipHash, createdAt: now })),
      );
      return { status: 'recorded' };
    },
  );

  app.get('/me/consents', { schema: { tags: ['privacy'], summary: 'The latest choice I made for each consent' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await db
      .col('consents')
      .aggregate<{ _id: string; granted: boolean; policyVersion: string; source: string; createdAt: Date }>([
        { $match: { userId: auth.userId } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$purpose', granted: { $first: '$granted' }, policyVersion: { $first: '$policyVersion' }, source: { $first: '$source' }, createdAt: { $first: '$createdAt' } } },
      ])
      .toArray();
    return { items: rows.map((r) => ({ purpose: r._id, granted: r.granted, policyVersion: r.policyVersion, source: r.source, at: r.createdAt.toISOString() })) };
  });

  // ---------------------------------------------------------------- saved items
  app.get('/me/saved', { schema: { tags: ['me'], summary: 'Everything I have saved', querystring: pageQuery.extend({ type: z.enum(SAVED_TYPES).optional() }) } }, async (request) => {
    const auth = requireAuth(request);
    const { cursor, limit, type } = request.query;
    const rows = await db
      .col('saved_items')
      .find({ userId: auth.userId, ...(type ? { itemType: type } : {}), ...olderThan('createdAt', decodeCursor(cursor)) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();
    const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
    // Titles, looked up per type with one query each.
    const titles = new Map<string, { title: string; slug?: string }>();
    await Promise.all(
      (Object.keys(SAVED_COLLECTION) as SavedType[]).map(async (t) => {
        const ids = items.filter((i) => i.itemType === t).map((i) => i.itemId);
        if (!ids.length) return;
        const docs = await db.raw<{ _id: string; [key: string]: any }>(SAVED_COLLECTION[t]).find({ _id: { $in: ids } }).toArray();
        let slugs = new Map<string, string>();
        if (t === 'discussion') {
          const spaces = await db.col('spaces').find({ _id: { $in: docs.map((d) => d.spaceId) } }, { projection: { slug: 1 } }).toArray();
          slugs = new Map(spaces.map((s) => [s._id, s.slug]));
        }
        for (const d of docs) {
          if (d.deletedAt || ['removed', 'hidden'].includes(d.status)) continue;
          titles.set(`${t}:${d._id}`, { title: String(d.title ?? d.body ?? '').slice(0, 140), slug: t === 'discussion' ? slugs.get(d.spaceId) : undefined });
        }
      }),
    );
    const linkFor = (t: SavedType, id: string, slug?: string) =>
      ({ post: `/post/${id}`, discussion: `/spaces/${slug ?? 'space'}/t/${id}`, event: `/events/${id}`, opportunity: `/opportunities/${id}`, listing: `/marketplace/${id}`, resource: `/resources?id=${id}`, lecture: `/lectures?id=${id}`, hush_question: `/hush/${id}` })[t];
    return {
      items: items.map((r) => {
        const hit = titles.get(`${r.itemType}:${r.itemId}`);
        return { type: r.itemType, id: r.itemId, title: hit?.title ?? 'This item is no longer available', available: Boolean(hit), link: linkFor(r.itemType, r.itemId, hit?.slug), savedAt: r.createdAt.toISOString() };
      }),
      nextCursor,
    };
  });

  const savedParams = z.object({ type: z.enum(SAVED_TYPES), id: uuid });
  app.put('/saved/:type/:id', { schema: { tags: ['me'], summary: 'Save an item', params: savedParams } }, async (request) => {
    const auth = requireAuth(request);
    const { type, id } = request.params;
    const exists = await db.raw<{ _id: string; collegeId: string }>(SAVED_COLLECTION[type]).findOne({ _id: id, collegeId: auth.collegeId }, { projection: { _id: 1 } });
    if (!exists) throw Errors.notFound('That item');
    const res = await db.col('saved_items').updateOne({ _id: `${auth.userId}:${type}:${id}` }, { $setOnInsert: { userId: auth.userId, itemType: type, itemId: id, createdAt: new Date() } }, { upsert: true });
    if (res.upsertedCount && type === 'post') await db.col('posts').updateOne({ _id: id }, { $inc: { savesCount: 1 } });
    return { saved: true };
  });

  app.delete('/saved/:type/:id', { schema: { tags: ['me'], summary: 'Remove a saved item', params: savedParams } }, async (request) => {
    const auth = requireAuth(request);
    const { type, id } = request.params;
    const res = await db.col('saved_items').deleteOne({ _id: `${auth.userId}:${type}:${id}` });
    if (res.deletedCount && type === 'post') await db.col('posts').updateOne({ _id: id, savesCount: { $gt: 0 } }, { $inc: { savesCount: -1 } });
    return { saved: false };
  });

  // ---------------------------------------------------------------- people
  app.get(
    '/users',
    {
      schema: {
        tags: ['people'],
        summary: 'Find people at my college',
        querystring: pageQuery.extend({ q: z.string().trim().max(60).optional(), departmentId: uuid.optional(), year: z.coerce.number().int().min(1).max(6).optional(), role: z.enum(['student', 'faculty', 'expert', 'moderator', 'admin']).optional() }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, q, departmentId, year, role } = request.query;
      const after = decodeCursor(cursor);
      const hidden = [auth.userId, ...(await blockedIds(db, auth.userId))];
      const and: Filter<User>[] = [{ collegeId: auth.collegeId, status: 'active', deletionScheduledFor: null, _id: { $nin: hidden } }];
      if (q) and.push({ $or: [{ 'profile.displayName': contains(q) }, { 'profile.username': contains(q) }, { 'profile.skills': { $regex: `^${escapeRegex(q.trim())}$`, $options: 'i' } }] });
      if (departmentId) and.push({ 'profile.departmentId': departmentId });
      if (year) and.push({ 'profile.year': year });
      if (role) and.push({ role });
      if (after) and.push({ $or: [{ 'profile.displayName': { $gt: after.at } }, { 'profile.displayName': after.at, _id: { $gt: after.id } }] });
      const docs = (await users().find({ $and: and }, { projection: PERSON_PROJECTION }).sort({ 'profile.displayName': 1, _id: 1 }).limit(limit + 1).toArray()) as unknown as PersonDoc[];
      const { items, nextCursor } = page(docs, limit, (r) => encodeCursor(r.profile.displayName, r._id));
      const [people, following] = await Promise.all([
        toPeople(app.deps, items),
        db.col('follows').find({ _id: { $in: items.map((d) => `${auth.userId}:${d._id}`) } }, { projection: { followeeId: 1 } }).toArray(),
      ]);
      const followSet = new Set(following.map((f) => f.followeeId));
      return { items: items.filter((d) => people.has(d._id)).map((d) => ({ ...people.get(d._id)!, headline: d.profile.headline ?? null, isFollowing: followSet.has(d._id) })), nextCursor };
    },
  );

  app.get('/users/:id', { schema: { tags: ['people'], summary: 'A profile, by username or id', params: z.object({ id: z.string().min(3).max(64) }) } }, async (request) => {
    const auth = requireAuth(request);
    const u = await resolveUser(app.deps, auth, request.params.id);
    const [people, iFollow, followsMe, postsCount] = await Promise.all([
      toPeople(app.deps, [u as unknown as PersonDoc]),
      db.col('follows').findOne({ _id: `${auth.userId}:${u._id}` }, { projection: { _id: 1 } }),
      db.col('follows').findOne({ _id: `${u._id}:${auth.userId}` }, { projection: { _id: 1 } }),
      db.col('posts').countDocuments({ authorId: u._id, deletedAt: null, status: 'published' }),
    ]);
    const person = people.get(u._id)!;
    const self = u._id === auth.userId;
    const vis = u.profile.visibility;
    const mutual = Boolean(iFollow && followsMe);
    const restricted = !self && vis.profile === 'connections' && !mutual;
    const canMessage = !self && u.status === 'active' && (u.profile.messagePrivacy === 'everyone' || (u.profile.messagePrivacy === 'connections' && mutual));
    const showBranch = self || vis.showBranch !== false;
    const base = {
      ...person,
      department: showBranch ? person.department : null,
      year: showBranch ? person.year : null,
      headline: u.profile.headline,
      isSelf: self,
      isFollowing: Boolean(iFollow),
      followsYou: Boolean(followsMe),
      canMessage,
      followersCount: u.profile.followersCount,
      followingCount: u.profile.followingCount,
      restricted,
    };
    if (restricted) return base;
    return {
      ...base,
      bio: u.profile.bio,
      semester: showBranch ? u.profile.semester : null,
      division: showBranch ? u.profile.division : null,
      skills: u.profile.skills,
      interests: u.profile.interests,
      links: u.profile.links,
      email: self || vis.showEmail ? u.email : null,
      postsCount,
      joinedAt: u.createdAt.toISOString(),
    };
  });

  // Online now / last seen, as shown in a chat header. People who turned off "last seen & online"
  // are never shown as online and have no last seen (Settings → Privacy → Last seen & online).
  app.get('/users/:id/presence', { schema: { tags: ['people'], summary: 'Whether someone is online, or when they were last seen', params: z.object({ id: uuid }) } }, async (request) => {
    const auth = requireAuth(request);
    const u = await db.col('users').findOne({ _id: request.params.id, collegeId: auth.collegeId, status: 'active' }, { projection: { lastActiveAt: 1, lastLoginAt: 1, 'profile.visibility.showOnline': 1 } });
    if (!u || (await isBlockedBetween(db, auth.userId, u._id))) throw Errors.notFound('This person');
    if (u.profile?.visibility?.showOnline === false) return { visible: false, online: false, lastSeenAt: null };
    const last = u.lastActiveAt ?? u.lastLoginAt ?? null;
    return { visible: true, online: app.deps.realtime.isOnline(u._id), lastSeenAt: last ? last.toISOString() : null };
  });

  app.post('/users/:id/follow', { schema: { tags: ['people'], summary: 'Follow someone', params: z.object({ id: uuid }) } }, async (request) => {
    const auth = requireAuth(request);
    if (request.params.id === auth.userId) throw Errors.badRequest('You cannot follow yourself.');
    const target = await resolveUser(app.deps, auth, request.params.id);
    if (await setFollow(db, auth.userId, target._id, true)) {
      await app.deps.notifier.send({ userId: target._id, kind: 'follow', title: `${auth.displayName} started following you`, link: `/profile/${auth.username}`, actorId: auth.userId, entityType: 'user', entityId: auth.userId });
    }
    return { following: true };
  });

  app.delete('/users/:id/follow', { schema: { tags: ['people'], summary: 'Unfollow', params: z.object({ id: uuid }) } }, async (request) => {
    const auth = requireAuth(request);
    await setFollow(db, auth.userId, request.params.id, false);
    return { following: false };
  });

  for (const direction of ['followers', 'following'] as const) {
    app.get(
      `/users/:id/${direction}`,
      { schema: { tags: ['people'], summary: direction === 'followers' ? 'Who follows this person' : 'Who this person follows', params: z.object({ id: uuid }), querystring: pageQuery } },
      async (request) => {
        const auth = requireAuth(request);
        const target = await resolveUser(app.deps, auth, request.params.id);
        const mine = direction === 'followers' ? 'followeeId' : 'followerId';
        const other = direction === 'followers' ? 'followerId' : 'followeeId';
        const rows = await db
          .col('follows')
          .find({ [mine]: target._id, ...olderThan('createdAt', decodeCursor(request.query.cursor)) })
          .sort({ createdAt: -1, _id: -1 })
          .limit(request.query.limit + 1)
          .toArray();
        const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(r.createdAt, r._id));
        const ids = items.map((r) => r[other]);
        const [people, iFollow, blocked] = await Promise.all([
          loadPeople(app.deps, ids),
          db.col('follows').find({ _id: { $in: ids.map((i) => `${auth.userId}:${i}`) } }, { projection: { followeeId: 1 } }).toArray(),
          blockedIds(db, auth.userId),
        ]);
        const followSet = new Set(iFollow.map((f) => f.followeeId));
        const blockedSet = new Set(blocked);
        return { items: ids.filter((i) => people.has(i) && !blockedSet.has(i)).map((i) => ({ ...people.get(i)!, isFollowing: followSet.has(i) })), nextCursor };
      },
    );
  }

  app.post('/users/:id/block', { schema: { tags: ['people'], summary: 'Block someone', params: z.object({ id: uuid }) } }, async (request) => {
    const auth = requireAuth(request);
    if (request.params.id === auth.userId) throw Errors.badRequest('You cannot block yourself.');
    const target = await users().findOne({ _id: request.params.id, collegeId: auth.collegeId }, { projection: { _id: 1 } });
    if (!target) throw Errors.notFound('This person');
    await db.col('blocks').updateOne({ _id: `${auth.userId}:${target._id}` }, { $setOnInsert: { blockerId: auth.userId, blockedId: target._id, createdAt: new Date() } }, { upsert: true });
    await setFollow(db, auth.userId, target._id, false);
    await setFollow(db, target._id, auth.userId, false);
    await audit(db, { action: 'user.block', actorId: auth.userId, collegeId: auth.collegeId, entityType: 'user', entityId: target._id, requestId: request.id });
    return { blocked: true };
  });

  app.delete('/users/:id/block', { schema: { tags: ['people'], summary: 'Unblock', params: z.object({ id: uuid }) } }, async (request) => {
    const auth = requireAuth(request);
    await db.col('blocks').deleteOne({ _id: `${auth.userId}:${request.params.id}` });
    return { blocked: false };
  });
};
