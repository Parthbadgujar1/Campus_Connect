import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { isStaff, requireAuth, requireRole } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, olderThan } from '../../core/query.js';
import { boolQuery, cleanText, httpsUrl, idParam, optionalText, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Lecture } from '../../infra/db/models.js';
import type { AuthContext } from '../../types/fastify.js';
import { assertOwnFiles, fileView, loadFile, type FileView } from '../files/files.service.js';
import { loadPeople } from '../users/people.js';

// /v1/lectures — recorded lectures from faculty: uploaded videos, YouTube or other links,
// with chapters. Faculty publish directly; admins can unpublish.

const chapter = z.object({ at: z.number().int().min(0).max(86400), title: text(1, 120) });
const body = z
  .object({
    title: text(4, 200),
    description: optionalText(4000),
    subject: text(2, 80),
    semester: z.number().int().min(1).max(12).optional(),
    source: z.enum(['upload', 'youtube', 'link']),
    fileId: uuid.optional(),
    url: httpsUrl.optional(),
    durationSeconds: z.number().int().min(1).max(86400).optional(),
    chapters: z.array(chapter).max(50).default([]),
    status: z.enum(['draft', 'published']).default('published'),
  })
  .refine((b) => (b.source === 'upload' ? Boolean(b.fileId) : Boolean(b.url)), { message: 'Upload a video, or add its link.', path: ['fileId'] });

function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url);
  return m ? m[1]! : null;
}

export const lectureRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const lectures = () => db.col('lectures');

  async function views(rows: Lecture[], auth: AuthContext, withMedia = false) {
    const people = await loadPeople(app.deps, rows.map((r) => r.teacherId));
    return Promise.all(
      rows.map(async (r) => {
        let file: FileView | null = null;
        if (withMedia && r.fileId) {
          const f = await loadFile(app.deps, r.fileId);
          if (f) file = await fileView(app.deps, f, 4 * 3600);
        }
        const yt = youtubeId(r.url);
        return {
          id: r._id,
          title: r.title,
          description: r.description,
          subject: r.subject,
          semester: r.semester,
          source: r.source,
          url: r.url,
          // Privacy-enhanced embed (no tracking cookies until the viewer presses play).
          embedUrl: yt ? `https://www.youtube-nocookie.com/embed/${yt}` : null,
          thumbnailUrl: yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null,
          file,
          durationSeconds: r.durationSeconds,
          viewsCount: r.viewsCount,
          chapters: r.chapters,
          status: r.status,
          teacher: r.teacherId ? (people.get(r.teacherId) ?? null) : null,
          canManage: r.teacherId === auth.userId || auth.role === 'admin',
          publishedAt: r.publishedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    );
  }

  app.get(
    '/',
    { schema: { tags: ['lectures'], summary: 'Lecture library', querystring: pageQuery.extend({ q: z.string().trim().max(80).optional(), subject: z.string().trim().max(80).optional(), semester: z.coerce.number().int().min(1).max(12).optional(), mine: boolQuery }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, q, subject, semester, mine } = request.query;
      const and: Filter<Lecture>[] = [{ collegeId: auth.collegeId, deletedAt: null }, mine ? { teacherId: auth.userId } : { status: 'published' }];
      if (q) and.push({ $or: [{ title: contains(q) }, { subject: contains(q) }, { description: contains(q) }] });
      if (subject) and.push({ subject: contains(subject) });
      if (semester) and.push({ semester });
      and.push(olderThan('createdAt', decodeCursor(cursor)) as Filter<Lecture>);
      const rows = await lectures().find({ $and: and }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
      return { items: await views(items, auth), nextCursor };
    },
  );

  app.get('/subjects', { schema: { tags: ['lectures'], summary: 'Subjects that have lectures, for the filter' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await lectures()
      .aggregate<{ _id: string; n: number }>([{ $match: { collegeId: auth.collegeId, status: 'published', deletedAt: null } }, { $group: { _id: '$subject', n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 100 }])
      .toArray();
    return { items: rows.map((r) => ({ name: r._id, count: r.n })) };
  });

  async function load(auth: AuthContext, id: string) {
    const r = await lectures().findOne({ _id: id, collegeId: auth.collegeId, deletedAt: null });
    if (!r || (r.status !== 'published' && r.teacherId !== auth.userId && !isStaff(auth))) throw Errors.notFound('This lecture');
    return r;
  }

  app.get('/:id', { schema: { tags: ['lectures'], summary: 'A lecture with its video link', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const [v] = await views([await load(auth, request.params.id)], auth, true);
    return v;
  });

  app.post('/:id/view', { config: { rateLimit: { max: 60, timeWindow: '1 hour' } }, schema: { tags: ['lectures'], summary: 'Count a view', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const r = await load(auth, request.params.id);
    // One view per person per lecture per hour (cache key), so refreshing does not inflate counts.
    const n = await app.deps.cache.incr(`lecture-view:${r._id}:${auth.userId}`, 3600);
    if (n === 1) await lectures().updateOne({ _id: r._id }, { $inc: { viewsCount: 1 } });
    return { counted: n === 1 };
  });

  app.post('/', { schema: { tags: ['lectures'], summary: 'Add a lecture (faculty and admins)', body } }, async (request, reply) => {
    const auth = requireRole(request, 'faculty', 'admin');
    const b = request.body;
    if (b.fileId) await assertOwnFiles(app.deps, auth.userId, [b.fileId], ['lecture'], ['video']);
    if (b.source === 'youtube' && !youtubeId(b.url ?? null)) throw Errors.validation([{ field: 'url', message: 'Paste the YouTube video link.' }]);
    const now = new Date();
    const id = uuidv7();
    await lectures().insertOne({
      _id: id,
      collegeId: auth.collegeId,
      teacherId: auth.userId,
      title: cleanText(b.title),
      description: cleanText(b.description ?? ''),
      subject: cleanText(b.subject),
      semester: b.semester ?? null,
      source: b.source,
      fileId: b.source === 'upload' ? (b.fileId ?? null) : null,
      url: b.source === 'upload' ? null : (b.url ?? null),
      durationSeconds: b.durationSeconds ?? null,
      viewsCount: 0,
      chapters: b.chapters.map((c) => ({ at: c.at, title: cleanText(c.title) })).sort((x, y) => x.at - y.at),
      status: b.status,
      publishedAt: b.status === 'published' ? now : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    return reply.status(201).send({ id, status: b.status });
  });

  app.patch(
    '/:id',
    { schema: { tags: ['lectures'], summary: 'Edit, publish or unpublish', params: idParam, body: z.object({ title: text(4, 200).optional(), description: optionalText(4000), subject: text(2, 80).optional(), semester: z.number().int().min(1).max(12).optional(), chapters: z.array(chapter).max(50).optional(), status: z.enum(['draft', 'published', 'rejected']).optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const r = await load(auth, request.params.id);
      if (r.teacherId !== auth.userId && auth.role !== 'admin') throw Errors.forbidden();
      const b = request.body;
      const set: Partial<Lecture> = { updatedAt: new Date() };
      if (b.title) set.title = cleanText(b.title);
      if (b.description !== undefined) set.description = cleanText(b.description);
      if (b.subject) set.subject = cleanText(b.subject);
      if (b.semester) set.semester = b.semester;
      if (b.chapters) set.chapters = b.chapters.map((c) => ({ at: c.at, title: cleanText(c.title) })).sort((x, y) => x.at - y.at);
      if (b.status) set.status = b.status;
      if (b.status === 'published' && !r.publishedAt) set.publishedAt = new Date();
      await db.tx(async (session) => {
        await lectures().updateOne({ _id: r._id }, { $set: set }, { session });
        if (b.status && r.teacherId !== auth.userId) await audit(db, { action: 'lecture.status', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'lecture', entityId: r._id, requestId: request.id, meta: { status: b.status } }, session);
      });
      return { status: 'saved' };
    },
  );

  app.delete('/:id', { schema: { tags: ['lectures'], summary: 'Delete a lecture', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const res = await lectures().updateOne(
      { _id: request.params.id, collegeId: auth.collegeId, deletedAt: null, ...(auth.role === 'admin' ? {} : { teacherId: auth.userId }) },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    );
    if (!res.matchedCount) throw Errors.notFound('This lecture');
    return { status: 'deleted' };
  });
};
