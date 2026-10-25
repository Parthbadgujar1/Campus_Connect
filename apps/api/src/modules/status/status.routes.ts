import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors } from '../../core/errors.js';
import { requireAuth } from '../../core/guards.js';
import { cleanText, idParam, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Status } from '../../infra/db/models.js';
import { assertOwnFiles, loadFileViews } from '../files/files.service.js';
import { blockedIds, loadPeople, personOf } from '../users/people.js';

// /v1/status — WhatsApp-style status updates: a photo, a short video or coloured text that
// disappears after 24 hours (a TTL index deletes it; views go with it). Your followers see
// your status; you see the statuses of people you follow. You can see who viewed yours.

const DAY_MS = 24 * 60 * 60 * 1000;
export const STATUS_BACKGROUNDS = ['violet', 'blue', 'green', 'rose', 'amber', 'slate'] as const;

const createBody = z
  .object({
    kind: z.enum(['text', 'image', 'video']),
    text: z.string().trim().max(700).optional(),
    background: z.enum(STATUS_BACKGROUNDS).default('violet'),
    fileId: uuid.optional(),
    caption: z.string().trim().max(300).optional(),
  })
  .refine((b) => (b.kind === 'text' ? Boolean(b.text) : Boolean(b.fileId)), { message: 'Write something, or add a photo or video.', path: ['text'] });

export const statusRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const statuses = () => db.col('statuses');
  const views = () => db.col('status_views');

  async function toItems(rows: Status[], viewerId: string) {
    const [files, seen] = await Promise.all([
      loadFileViews(app.deps, rows.map((r) => r.fileId).filter((x): x is string => Boolean(x))),
      views().find({ _id: { $in: rows.map((r) => `${r._id}:${viewerId}`) } }, { projection: { statusId: 1 } }).toArray(),
    ]);
    const seenSet = new Set(seen.map((s) => s.statusId));
    return rows.map((r) => ({
      id: r._id,
      kind: r.kind,
      text: r.text,
      background: r.background,
      caption: r.caption,
      file: r.fileId ? (files.get(r.fileId) ?? null) : null,
      viewsCount: r.userId === viewerId ? r.viewsCount : undefined,
      seen: r.userId === viewerId || seenSet.has(r._id),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    }));
  }

  app.get('/', { schema: { tags: ['status'], summary: 'My status and updates from people I follow' } }, async (request) => {
    const auth = requireAuth(request);
    const now = new Date();
    const [follows, blocked] = await Promise.all([
      db.col('follows').find({ followerId: auth.userId }, { projection: { followeeId: 1 } }).limit(5000).toArray(),
      blockedIds(db, auth.userId),
    ]);
    const authors = follows.map((f) => f.followeeId).filter((id) => !blocked.includes(id));
    const rows = await statuses()
      .find({ collegeId: auth.collegeId, userId: { $in: [auth.userId, ...authors] }, expiresAt: { $gt: now } })
      .sort({ createdAt: 1 })
      .limit(2000)
      .toArray();
    const items = await toItems(rows, auth.userId);
    const people = await loadPeople(app.deps, [...new Set(rows.map((r) => r.userId))]);
    const byUser = new Map<string, typeof items>();
    rows.forEach((r, i) => byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), items[i]!]));
    const group = (userId: string) => {
      const list = byUser.get(userId) ?? [];
      return { person: personOf(people, userId), items: list, allSeen: list.every((x) => x.seen), latestAt: list[list.length - 1]?.createdAt ?? null };
    };
    const updates = [...byUser.keys()]
      .filter((id) => id !== auth.userId)
      .map(group)
      // Unseen first, then the most recent.
      .sort((a, b) => Number(a.allSeen) - Number(b.allSeen) || (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
    return { mine: byUser.has(auth.userId) ? group(auth.userId) : null, updates };
  });

  app.post('/', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } }, schema: { tags: ['status'], summary: 'Post a status (disappears after 24 hours)', body: createBody } }, async (request, reply) => {
    const auth = requireAuth(request);
    const b = request.body;
    if (b.fileId) await assertOwnFiles(app.deps, auth.userId, [b.fileId], ['post'], [b.kind === 'video' ? 'video' : 'image']);
    const now = new Date();
    const row: Status = {
      _id: uuidv7(),
      collegeId: auth.collegeId,
      userId: auth.userId,
      kind: b.kind,
      text: b.kind === 'text' ? cleanText(b.text ?? '') : null,
      background: b.background,
      fileId: b.kind === 'text' ? null : (b.fileId ?? null),
      caption: b.kind === 'text' ? null : b.caption ? cleanText(b.caption) : null,
      viewsCount: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + DAY_MS),
    };
    await statuses().insertOne(row);
    const [item] = await toItems([row], auth.userId);
    return reply.status(201).send(item);
  });

  app.delete('/:id', { schema: { tags: ['status'], summary: 'Delete my status', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const res = await statuses().deleteOne({ _id: request.params.id, userId: auth.userId });
    if (!res.deletedCount) throw Errors.notFound('This status');
    await views().deleteMany({ statusId: request.params.id });
    return { status: 'deleted' };
  });

  app.post('/:id/view', { config: { rateLimit: { max: 600, timeWindow: '1 hour' } }, schema: { tags: ['status'], summary: 'Mark a status as seen', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const s = await statuses().findOne({ _id: request.params.id, collegeId: auth.collegeId, expiresAt: { $gt: new Date() } });
    if (!s) throw Errors.notFound('This status');
    if (s.userId === auth.userId) return { seen: true };
    const follows = await db.col('follows').findOne({ followerId: auth.userId, followeeId: s.userId }, { projection: { _id: 1 } });
    if (!follows) throw Errors.notFound('This status');
    const res = await views().updateOne(
      { _id: `${s._id}:${auth.userId}` },
      { $setOnInsert: { statusId: s._id, ownerId: s.userId, viewerId: auth.userId, createdAt: new Date(), expiresAt: s.expiresAt } },
      { upsert: true },
    );
    if (res.upsertedCount) await statuses().updateOne({ _id: s._id }, { $inc: { viewsCount: 1 } });
    return { seen: true };
  });

  app.get('/:id/viewers', { schema: { tags: ['status'], summary: 'Who viewed my status', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const s = await statuses().findOne({ _id: request.params.id, userId: auth.userId });
    if (!s) throw Errors.notFound('This status');
    const rows = await views().find({ statusId: s._id }).sort({ createdAt: -1 }).limit(500).toArray();
    const people = await loadPeople(app.deps, rows.map((r) => r.viewerId));
    return { items: rows.map((r) => ({ person: personOf(people, r.viewerId), viewedAt: r.createdAt.toISOString() })) };
  });
};
