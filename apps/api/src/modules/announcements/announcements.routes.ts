import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { isStaff, requireAuth, requireRole, STAFF_ROLES } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, olderThan } from '../../core/query.js';
import { cleanText, idParam, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Announcement } from '../../infra/db/models.js';
import { loadViewer, type Viewer } from '../feed/feed.service.js';

// /v1/announcements — official notices from faculty and the college office.
// Audience: the whole college, one department, or one year. Publishing can notify everyone in
// the audience at once (streamed in batches, not one query per person).

const CATEGORIES = ['notice', 'news', 'results', 'event', 'club', 'important'] as const;

const audience = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('college') }),
  z.object({ scope: z.literal('department'), departmentId: uuid }),
  z.object({ scope: z.literal('year'), year: z.number().int().min(1).max(6) }),
]);

/** Which notices this person is in the audience for (staff see all of them). */
function audienceFilter(v: Viewer): Filter<Announcement> {
  if (v.staff) return {};
  return {
    $or: [
      { 'audience.scope': 'college' },
      ...(v.departmentId ? [{ 'audience.scope': 'department', 'audience.departmentId': v.departmentId }] : []),
      ...(v.year ? [{ 'audience.scope': 'year', 'audience.year': v.year }] : []),
    ],
  } as Filter<Announcement>;
}

export const announcementRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const notices = () => db.col('announcements');

  function view(a: Announcement, viewerId: string) {
    return {
      id: a._id,
      title: a.title,
      body: a.body,
      category: a.category,
      authorLabel: a.authorLabel,
      audience: a.audience,
      pinned: a.isPinned,
      status: a.status,
      publishedAt: a.publishedAt.toISOString(),
      expiresAt: a.expiresAt?.toISOString() ?? null,
      isMine: a.authorId === viewerId,
    };
  }

  app.get(
    '/',
    {
      schema: {
        tags: ['announcements'],
        summary: 'Notices for me',
        querystring: pageQuery.extend({ category: z.enum(CATEGORIES).optional(), q: z.string().trim().max(80).optional(), mine: z.enum(['true', 'false']).optional() }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, category, q, mine } = request.query;
      const viewer = await loadViewer(app.deps, auth);
      const now = new Date();
      const base: Filter<Announcement>[] = [
        { collegeId: auth.collegeId },
        mine === 'true' ? { authorId: auth.userId } : { status: 'published', publishedAt: { $lte: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        audienceFilter(viewer),
      ];
      if (category) base.push({ category });
      if (q) base.push({ $or: [{ title: contains(q) }, { body: contains(q) }] });
      // Pinned notices lead the first page; later pages hold only the rest.
      const pinned = cursor ? [] : await notices().find({ $and: [...base, { isPinned: true }] }).sort({ publishedAt: -1 }).limit(5).toArray();
      const rows = await notices()
        .find({ $and: [...base, { isPinned: { $ne: true } }, olderThan('publishedAt', decodeCursor(cursor)) as Filter<Announcement>] })
        .sort({ publishedAt: -1, _id: -1 })
        .limit(limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.publishedAt, r._id));
      return { items: [...pinned, ...items].map((r) => view(r, auth.userId)), nextCursor };
    },
  );

  app.get('/:id', { schema: { tags: ['announcements'], summary: 'One notice', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const viewer = await loadViewer(app.deps, auth);
    const a = await notices().findOne({
      $and: [{ _id: request.params.id, collegeId: auth.collegeId }, viewer.staff ? {} : { $or: [{ status: 'published' }, { authorId: auth.userId }] }, audienceFilter(viewer)],
    });
    if (!a) throw Errors.notFound('This notice');
    return view(a, auth.userId);
  });

  const body = z.object({
    title: text(3, 160),
    body: text(1, 5000),
    category: z.enum(CATEGORIES).default('notice'),
    audience: audience.default({ scope: 'college' }),
    authorLabel: text(2, 120).optional(),
    pinned: z.boolean().default(false),
    expiresAt: z.coerce.date().optional(),
    notify: z.boolean().default(true),
    status: z.enum(['draft', 'published']).default('published'),
  });

  // Edits: all optional and without defaults, so unsent fields stay unchanged.
  const patch = body
    .extend({ category: z.enum(CATEGORIES).optional(), audience: audience.optional(), pinned: z.boolean().optional(), notify: z.boolean().optional(), status: z.enum(['draft', 'published', 'archived']).optional() })
    .partial();

  async function assertDepartment(collegeId: string, a: z.infer<typeof audience>) {
    if (a.scope !== 'department') return;
    const ok = await db.col('departments').findOne({ _id: a.departmentId, collegeId }, { projection: { _id: 1 } });
    if (!ok) throw Errors.validation([{ field: 'audience', message: 'Choose a department from your college.' }]);
  }

  async function notifyAudience(collegeId: string, a: Announcement, actorId: string) {
    return app.deps.notifier.broadcast(
      collegeId,
      { kind: 'announcement', title: a.title, body: a.body.slice(0, 200), link: `/news?id=${a._id}`, actorId, entityType: 'announcement', entityId: a._id },
      { departmentId: a.audience.scope === 'department' ? a.audience.departmentId : undefined, year: a.audience.scope === 'year' ? a.audience.year : undefined },
    );
  }

  app.post('/', { schema: { tags: ['announcements'], summary: 'Publish a notice (faculty and admins)', body } }, async (request, reply) => {
    const auth = requireRole(request, ...STAFF_ROLES);
    const b = request.body;
    if (b.expiresAt && b.expiresAt <= new Date()) throw Errors.validation([{ field: 'expiresAt', message: 'Choose a future date.' }]);
    await assertDepartment(auth.collegeId, b.audience);
    const now = new Date();
    const a: Announcement = {
      _id: uuidv7(),
      collegeId: auth.collegeId,
      authorId: auth.userId,
      authorLabel: cleanText(b.authorLabel ?? auth.displayName),
      title: cleanText(b.title),
      body: cleanText(b.body),
      category: b.category,
      audience: b.audience,
      isPinned: b.pinned,
      status: b.status,
      publishedAt: now,
      expiresAt: b.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.tx(async (session) => {
      await notices().insertOne(a, { session });
      await audit(db, { action: 'announcement.publish', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'announcement', entityId: a._id, requestId: request.id }, session);
    });
    const notified = b.notify && b.status === 'published' ? await notifyAudience(auth.collegeId, a, auth.userId) : 0;
    return reply.status(201).send({ id: a._id, notified });
  });

  app.patch('/:id', { schema: { tags: ['announcements'], summary: 'Edit, publish or archive a notice', params: idParam, body: patch } }, async (request) => {
    const auth = requireRole(request, ...STAFF_ROLES);
    const a = await notices().findOne({ _id: request.params.id, collegeId: auth.collegeId });
    if (!a) throw Errors.notFound('This notice');
    if (a.authorId !== auth.userId && auth.role !== 'admin') throw Errors.forbidden('Only the author or an admin can edit this notice.');
    const b = request.body;
    if (b.audience) await assertDepartment(auth.collegeId, b.audience);
    const set: Partial<Announcement> = { updatedAt: new Date() };
    if (b.title) set.title = cleanText(b.title);
    if (b.body) set.body = cleanText(b.body);
    if (b.category) set.category = b.category;
    if (b.audience) set.audience = b.audience;
    if (b.pinned !== undefined) set.isPinned = b.pinned;
    if (b.status) set.status = b.status;
    if (b.expiresAt) set.expiresAt = b.expiresAt;
    if (b.authorLabel) set.authorLabel = cleanText(b.authorLabel);
    // A draft that is published now gets today's date and (optionally) a notification.
    const publishing = a.status === 'draft' && b.status === 'published';
    if (publishing) set.publishedAt = new Date();
    const updated = await notices().findOneAndUpdate({ _id: a._id }, { $set: set }, { returnDocument: 'after' });
    let notified = 0;
    if (publishing && b.notify !== false && updated) notified = await notifyAudience(auth.collegeId, updated, auth.userId);
    return { status: 'saved', notified };
  });

  app.delete('/:id', { schema: { tags: ['announcements'], summary: 'Archive a notice', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    if (!isStaff(auth)) throw Errors.forbidden();
    const res = await notices().updateOne(
      { _id: request.params.id, collegeId: auth.collegeId, ...(auth.role === 'admin' ? {} : { authorId: auth.userId }) },
      { $set: { status: 'archived', updatedAt: new Date() } },
    );
    if (!res.matchedCount) throw Errors.notFound('This notice');
    return { status: 'archived' };
  });
};
