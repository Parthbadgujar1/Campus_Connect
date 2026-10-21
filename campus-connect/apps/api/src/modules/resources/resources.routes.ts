import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { isStaff, requireAuth, requireRole, STAFF_ROLES } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, lowerThan, newerThan, olderThan } from '../../core/query.js';
import { boolQuery, cleanText, idParam, optionalText, tags, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Resource, Subject } from '../../infra/db/models.js';
import { limits } from '../../plugins/traffic.js';
import type { AuthContext } from '../../types/fastify.js';
import { assertOwnFiles, fileView, loadFile } from '../files/files.service.js';
import { departmentNames, loadPeople } from '../users/people.js';

// /v1/resources, /v1/subjects — the Shelf: notes, previous papers, lab manuals, cheat sheets...
//
// Browsing starts from filters (department -> semester -> subject -> type), all built from the
// data itself, so a new subject appears as soon as someone adds it. Subjects are a collection of
// their own: anyone can add one while uploading, staff can rename, merge or remove them.
// Students' uploads are reviewed by faculty (or admins/moderators) before they appear, which
// keeps copyrighted books and wrong material off the shelf. Staff uploads are published at once.

const KINDS = ['notes', 'previous_papers', 'syllabus', 'lab_manual', 'cheat_sheet', 'book', 'tutorial', 'video_link', 'code', 'pdf'] as const;

const body = z
  .object({
    title: text(4, 200),
    kind: z.enum(KINDS),
    /** An existing subject, or a new subject's name (created if it does not exist yet). */
    subjectId: uuid.optional(),
    subject: text(2, 80).optional(),
    semester: z.number().int().min(1).max(12).optional(),
    departmentId: uuid.optional(),
    fileId: uuid.optional(),
    externalUrl: z.string().trim().max(500).regex(/^https?:\/\/\S+$/, 'Use a full link.').optional(),
    tags,
  })
  .refine((b) => b.fileId || b.externalUrl, { message: 'Attach a file or add a link.', path: ['fileId'] })
  .refine((b) => b.subjectId || b.subject, { message: 'Choose or add a subject.', path: ['subject'] });

const subjectName = (s: string) => cleanText(s).replace(/\s+/g, ' ').trim();

export const resourceRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const resources = () => db.col('resources');
  const subjects = () => db.col('subjects');

  /** Approved items per subject, kept on the subject so the filter list is one cheap query. */
  const countSubject = (subjectId: string, delta: number) => subjects().updateOne({ _id: subjectId, ...(delta < 0 ? { resourcesCount: { $gt: 0 } } : {}) }, { $inc: { resourcesCount: delta } });

  async function views(rows: Resource[], auth: AuthContext) {
    const ids = rows.map((r) => r._id);
    const [departments, people, ratings, saved] = await Promise.all([
      departmentNames(db, rows.map((r) => r.departmentId)),
      loadPeople(app.deps, rows.map((r) => r.uploaderId)),
      db.col('resource_ratings').find({ _id: { $in: ids.map((i) => `${i}:${auth.userId}`) } }, { projection: { resourceId: 1, rating: 1 } }).toArray(),
      db.col('saved_items').find({ _id: { $in: ids.map((i) => `${auth.userId}:resource:${i}`) } }, { projection: { itemId: 1 } }).toArray(),
    ]);
    const ratingBy = new Map(ratings.map((r) => [r.resourceId, r.rating]));
    const savedSet = new Set(saved.map((s) => s.itemId));
    return rows.map((r) => ({
      id: r._id,
      title: r.title,
      kind: r.kind,
      subjectId: r.subjectId,
      subject: r.subject,
      semester: r.semester,
      departmentId: r.departmentId,
      department: r.departmentId ? (departments.get(r.departmentId) ?? null) : null,
      tags: r.tags,
      externalUrl: r.externalUrl,
      hasFile: Boolean(r.fileId),
      status: r.status,
      reviewNote: r.uploaderId === auth.userId || isStaff(auth) ? r.reviewNote : undefined,
      downloadsCount: r.downloadsCount,
      rating: r.ratingCount ? Math.round((r.ratingSum / r.ratingCount) * 10) / 10 : null,
      ratingCount: r.ratingCount,
      myRating: ratingBy.get(r._id) ?? null,
      saved: savedSet.has(r._id),
      uploader: r.uploaderId ? (people.get(r.uploaderId) ?? null) : null,
      isMine: r.uploaderId === auth.userId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------- subjects
  app.get(
    '/subjects',
    {
      schema: {
        tags: ['shelf'],
        summary: 'Subjects (optionally for a department and semester), most stocked first',
        querystring: z.object({ q: z.string().trim().max(60).optional(), departmentId: uuid.optional(), semester: z.coerce.number().int().min(1).max(12).optional(), limit: z.coerce.number().int().min(1).max(200).default(100) }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { q, departmentId, semester, limit } = request.query;
      const filter: Filter<Subject> = { collegeId: auth.collegeId };
      if (q) filter.name = contains(q);
      // A subject tagged with a department/semester shows there; untagged subjects show everywhere.
      if (departmentId) filter.departmentId = { $in: [departmentId, null] };
      if (semester) filter.semester = { $in: [semester, null] };
      const rows = await subjects().find(filter).sort({ resourcesCount: -1, nameLower: 1 }).limit(limit).toArray();
      const departments = await departmentNames(db, rows.map((s) => s.departmentId));
      return {
        items: rows.map((s) => ({
          id: s._id,
          name: s.name,
          departmentId: s.departmentId,
          department: s.departmentId ? (departments.get(s.departmentId) ?? null) : null,
          semester: s.semester,
          resourcesCount: s.resourcesCount,
          canEdit: isStaff(auth) || s.createdBy === auth.userId,
        })),
      };
    },
  );

  const subjectBody = z.object({ name: text(2, 80), departmentId: uuid.nullable().optional(), semester: z.number().int().min(1).max(12).nullable().optional() });

  async function assertDepartment(collegeId: string, departmentId: string | null | undefined) {
    if (!departmentId) return;
    const d = await db.col('departments').findOne({ _id: departmentId, collegeId }, { projection: { _id: 1 } });
    if (!d) throw Errors.validation([{ field: 'departmentId', message: 'Choose a department from your college.' }]);
  }

  /** Finds a subject by name (any capitalisation) or creates it. */
  async function ensureSubject(auth: AuthContext, input: { name: string; departmentId?: string | null; semester?: number | null }): Promise<Subject> {
    const name = subjectName(input.name);
    const nameLower = name.toLowerCase();
    const existing = await subjects().findOne({ collegeId: auth.collegeId, nameLower });
    if (existing) return existing;
    await assertDepartment(auth.collegeId, input.departmentId);
    const doc: Subject = { _id: uuidv7(), collegeId: auth.collegeId, name, nameLower, departmentId: input.departmentId ?? null, semester: input.semester ?? null, createdBy: auth.userId, resourcesCount: 0, createdAt: new Date() };
    try {
      await subjects().insertOne(doc);
      return doc;
    } catch (err) {
      // Someone added the same subject a moment earlier: use theirs.
      if ((err as { code?: number }).code !== 11000) throw err;
      return (await subjects().findOne({ collegeId: auth.collegeId, nameLower }))!;
    }
  }

  app.post('/subjects', { config: { rateLimit: { max: 20, timeWindow: '1 day' } }, schema: { tags: ['shelf'], summary: 'Add a subject', body: subjectBody } }, async (request, reply) => {
    const auth = requireAuth(request);
    const s = await ensureSubject(auth, request.body);
    return reply.status(201).send({ id: s._id, name: s.name, departmentId: s.departmentId, semester: s.semester, resourcesCount: s.resourcesCount });
  });

  app.patch(
    '/subjects/:id',
    { schema: { tags: ['shelf'], summary: 'Rename or re-file a subject (staff), or merge it into another', params: idParam, body: subjectBody.partial().extend({ mergeInto: uuid.optional() }) } },
    async (request) => {
      const auth = requireRole(request, ...STAFF_ROLES);
      const s = await subjects().findOne({ _id: request.params.id, collegeId: auth.collegeId });
      if (!s) throw Errors.notFound('This subject');
      const b = request.body;
      if (b.mergeInto) {
        const target = await subjects().findOne({ _id: b.mergeInto, collegeId: auth.collegeId });
        if (!target || target._id === s._id) throw Errors.validation([{ field: 'mergeInto', message: 'Choose another subject to merge into.' }]);
        await db.tx(async (session) => {
          await resources().updateMany({ subjectId: s._id }, { $set: { subjectId: target._id, subject: target.name, updatedAt: new Date() } }, { session });
          await subjects().updateOne({ _id: target._id }, { $inc: { resourcesCount: s.resourcesCount } }, { session });
          await subjects().deleteOne({ _id: s._id }, { session });
          await audit(db, { action: 'subject.merge', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'subject', entityId: s._id, requestId: request.id, meta: { into: target._id } }, session);
        });
        return { status: 'merged', id: target._id };
      }
      await assertDepartment(auth.collegeId, b.departmentId);
      const set: Partial<Subject> = {};
      if (b.name) {
        set.name = subjectName(b.name);
        set.nameLower = set.name.toLowerCase();
        const clash = await subjects().findOne({ collegeId: auth.collegeId, nameLower: set.nameLower, _id: { $ne: s._id } }, { projection: { _id: 1 } });
        if (clash) throw Errors.alreadyExists('A subject with that name exists. Merge into it instead.');
      }
      if (b.departmentId !== undefined) set.departmentId = b.departmentId;
      if (b.semester !== undefined) set.semester = b.semester;
      await db.tx(async (session) => {
        await subjects().updateOne({ _id: s._id }, { $set: set }, { session });
        if (set.name) await resources().updateMany({ subjectId: s._id }, { $set: { subject: set.name } }, { session });
      });
      return { status: 'saved' };
    },
  );

  app.delete('/subjects/:id', { schema: { tags: ['shelf'], summary: 'Remove an empty subject (staff)', params: idParam } }, async (request) => {
    const auth = requireRole(request, ...STAFF_ROLES);
    const used = await resources().countDocuments({ subjectId: request.params.id, deletedAt: null }, { limit: 1 });
    if (used) throw Errors.conflict('This subject still has items on the shelf. Merge it into another subject instead.');
    const res = await subjects().deleteOne({ _id: request.params.id, collegeId: auth.collegeId });
    if (!res.deletedCount) throw Errors.notFound('This subject');
    return { status: 'deleted' };
  });

  // ---------------------------------------------------------------- filters
  app.get(
    '/resources/filters',
    {
      schema: {
        tags: ['shelf'],
        summary: 'What the shelf holds, for step-by-step filters (counts of approved items)',
        querystring: z.object({ departmentId: uuid.optional(), semester: z.coerce.number().int().min(1).max(12).optional(), subjectId: uuid.optional() }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { departmentId, semester, subjectId } = request.query;
      const match: Filter<Resource> = { collegeId: auth.collegeId, status: 'approved', deletedAt: null };
      // Each facet counts with the other chosen filters applied, so every option leads somewhere.
      const facet = (omit: 'departmentId' | 'semester' | 'subjectId' | 'kind') => ({
        ...(departmentId && omit !== 'departmentId' ? { departmentId } : {}),
        ...(semester && omit !== 'semester' ? { semester } : {}),
        ...(subjectId && omit !== 'subjectId' ? { subjectId } : {}),
      });
      const [result] = await resources()
        .aggregate<{ departments: Array<{ _id: string | null; n: number }>; semesters: Array<{ _id: number | null; n: number }>; subjects: Array<{ _id: string; name: string; n: number }>; kinds: Array<{ _id: string; n: number }>; total: Array<{ n: number }> }>([
          { $match: match },
          {
            $facet: {
              departments: [{ $match: facet('departmentId') }, { $group: { _id: '$departmentId', n: { $sum: 1 } } }],
              semesters: [{ $match: facet('semester') }, { $group: { _id: '$semester', n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
              subjects: [{ $match: facet('subjectId') }, { $group: { _id: '$subjectId', name: { $first: '$subject' }, n: { $sum: 1 } } }, { $sort: { n: -1, name: 1 } }, { $limit: 200 }],
              kinds: [{ $match: facet('kind') }, { $group: { _id: '$kind', n: { $sum: 1 } } }, { $sort: { n: -1 } }],
              total: [{ $match: facet('kind') }, { $count: 'n' }],
            },
          },
        ])
        .toArray();
      const allDepartments = await db.col('departments').find({ collegeId: auth.collegeId }, { projection: { name: 1, code: 1 } }).sort({ name: 1 }).toArray();
      const depCount = new Map((result?.departments ?? []).map((d) => [d._id, d.n]));
      return {
        total: result?.total[0]?.n ?? 0,
        departments: allDepartments.map((d) => ({ id: d._id, name: d.name, code: d.code, count: depCount.get(d._id) ?? 0 })),
        semesters: (result?.semesters ?? []).filter((s) => s._id !== null).map((s) => ({ value: s._id as number, count: s.n })),
        subjects: (result?.subjects ?? []).map((s) => ({ id: s._id, name: s.name, count: s.n })),
        kinds: KINDS.map((k) => ({ value: k, count: result?.kinds.find((x) => x._id === k)?.n ?? 0 })),
      };
    },
  );

  // ---------------------------------------------------------------- items
  app.get(
    '/resources',
    {
      schema: {
        tags: ['shelf'],
        summary: 'Browse the shelf',
        querystring: pageQuery.extend({
          q: z.string().trim().max(80).optional(),
          kind: z.enum(KINDS).optional(),
          subjectId: uuid.optional(),
          subject: z.string().trim().max(80).optional(),
          semester: z.coerce.number().int().min(1).max(12).optional(),
          departmentId: uuid.optional(),
          mine: boolQuery,
          saved: boolQuery,
          sort: z.enum(['new', 'popular', 'top_rated']).default('new'),
        }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, q, kind, subjectId, subject, semester, departmentId, mine, saved, sort } = request.query;
      const and: Filter<Resource>[] = [{ collegeId: auth.collegeId, deletedAt: null }, mine ? { uploaderId: auth.userId } : { status: 'approved' }];
      if (saved) {
        const rows = await db.col('saved_items').find({ userId: auth.userId, itemType: 'resource' }, { projection: { itemId: 1 } }).limit(1000).toArray();
        and.push({ _id: { $in: rows.map((r) => r.itemId) } });
      }
      if (q) and.push({ $or: [{ title: contains(q) }, { subject: contains(q) }, { tags: q.toLowerCase() }] });
      if (kind) and.push({ kind });
      if (subjectId) and.push({ subjectId });
      else if (subject) and.push({ subject: contains(subject) });
      if (semester) and.push({ semester });
      if (departmentId) and.push({ departmentId });
      const after = decodeCursor(cursor);
      if (sort === 'popular') {
        and.push(lowerThan('downloadsCount', after) as Filter<Resource>);
        const rows = await resources().find({ $and: and }).sort({ downloadsCount: -1, _id: -1 }).limit(limit + 1).toArray();
        const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.downloadsCount, r._id));
        return { items: await views(items, auth), nextCursor };
      }
      if (sort === 'top_rated') {
        // Ratings change slowly; the list is ranked by count of ratings and sum, capped at 200.
        const rows = await resources().find({ $and: [...and, { ratingCount: { $gt: 0 } }] }).limit(200).toArray();
        rows.sort((a, b) => b.ratingSum / b.ratingCount - a.ratingSum / a.ratingCount || b.ratingCount - a.ratingCount);
        return { items: await views(rows.slice(0, limit), auth), nextCursor: null };
      }
      and.push(olderThan('createdAt', after) as Filter<Resource>);
      const rows = await resources().find({ $and: and }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
      return { items: await views(items, auth), nextCursor };
    },
  );

  app.get('/resources/review-queue', { schema: { tags: ['shelf'], summary: 'Uploads waiting for review (staff)', querystring: pageQuery } }, async (request) => {
    const auth = requireRole(request, ...STAFF_ROLES);
    const rows = await resources()
      .find({ $and: [{ collegeId: auth.collegeId, status: 'pending', deletedAt: null }, newerThan('createdAt', decodeCursor(request.query.cursor)) as Filter<Resource>] })
      .sort({ createdAt: 1, _id: 1 })
      .limit(request.query.limit + 1)
      .toArray();
    const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(r.createdAt, r._id));
    const list = await views(items, auth);
    // Reviewers get a short-lived link to open the file.
    const withFiles = await Promise.all(
      items.map(async (r, i) => {
        const f = await loadFile(app.deps, r.fileId);
        return { ...list[i]!, file: f ? await fileView(app.deps, f, 900) : null };
      }),
    );
    return { items: withFiles, nextCursor };
  });

  async function load(auth: AuthContext, id: string) {
    const r = await resources().findOne({ _id: id, collegeId: auth.collegeId, deletedAt: null });
    if (!r || (r.status !== 'approved' && r.uploaderId !== auth.userId && !isStaff(auth))) throw Errors.notFound('This resource');
    return r;
  }

  app.get('/resources/:id', { schema: { tags: ['shelf'], summary: 'A shelf item', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const [v] = await views([await load(auth, request.params.id)], auth);
    return v;
  });

  app.post('/resources', { config: { rateLimit: { max: 20, timeWindow: '1 day' } }, schema: { tags: ['shelf'], summary: 'Add to the shelf (reviewed first for students)', body } }, async (request, reply) => {
    const auth = requireAuth(request);
    const b = request.body;
    if (b.fileId) await assertOwnFiles(app.deps, auth.userId, [b.fileId], ['resource']);
    await assertDepartment(auth.collegeId, b.departmentId);
    let subject: Subject | null = null;
    if (b.subjectId) {
      subject = await subjects().findOne({ _id: b.subjectId, collegeId: auth.collegeId });
      if (!subject) throw Errors.validation([{ field: 'subjectId', message: 'Choose a subject from the list, or type a new one.' }]);
    } else {
      subject = await ensureSubject(auth, { name: b.subject!, departmentId: b.departmentId ?? null, semester: b.semester ?? null });
    }
    const status = isStaff(auth) ? 'approved' : 'pending';
    const now = new Date();
    const id = uuidv7();
    await resources().insertOne({
      _id: id,
      collegeId: auth.collegeId,
      uploaderId: auth.userId,
      title: cleanText(b.title),
      kind: b.kind,
      subjectId: subject._id,
      subject: subject.name,
      semester: b.semester ?? subject.semester ?? null,
      departmentId: b.departmentId ?? subject.departmentId ?? null,
      fileId: b.fileId ?? null,
      externalUrl: b.externalUrl ?? null,
      tags: b.tags,
      status,
      reviewerId: status === 'approved' ? auth.userId : null,
      reviewNote: null,
      reviewedAt: status === 'approved' ? now : null,
      downloadsCount: 0,
      ratingSum: 0,
      ratingCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    if (status === 'approved') await countSubject(subject._id, 1);
    return reply.status(201).send({ id, status, subject: { id: subject._id, name: subject.name }, message: status === 'pending' ? 'Thanks! A teacher will review it before it appears on the shelf.' : 'Added to the shelf.' });
  });

  app.patch(
    '/resources/:id',
    { schema: { tags: ['shelf'], summary: 'Edit my upload (title, type, tags)', params: idParam, body: z.object({ title: text(4, 200).optional(), kind: z.enum(KINDS).optional(), semester: z.number().int().min(1).max(12).optional(), tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,29}$/)).max(10).optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const r = await load(auth, request.params.id);
      if (r.uploaderId !== auth.userId && !isStaff(auth)) throw Errors.forbidden();
      const b = request.body;
      const set: Partial<Resource> = { updatedAt: new Date() };
      if (b.title) set.title = cleanText(b.title);
      if (b.kind) set.kind = b.kind;
      if (b.semester) set.semester = b.semester;
      if (b.tags) set.tags = [...new Set(b.tags)];
      await resources().updateOne({ _id: r._id }, { $set: set });
      return { status: 'saved' };
    },
  );

  app.post('/resources/:id/download', { config: { rateLimit: { max: 120, timeWindow: '1 hour' } }, schema: { tags: ['shelf'], summary: 'Get a download link (counts the download)', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const r = await load(auth, request.params.id);
    if (r.status === 'approved' && r.uploaderId !== auth.userId) await resources().updateOne({ _id: r._id }, { $inc: { downloadsCount: 1 } });
    if (r.fileId) {
      const f = await db.col('files').findOne({ _id: r.fileId, status: 'ready', deletedAt: null });
      if (!f) throw Errors.unavailable('file storage', 60);
      return { url: (await fileView(app.deps, f, 900)).url, external: false };
    }
    return { url: r.externalUrl, external: true };
  });

  app.put('/resources/:id/rating', { config: limits.write, schema: { tags: ['shelf'], summary: 'Rate 1-5', params: idParam, body: z.object({ rating: z.number().int().min(1).max(5) }) } }, async (request) => {
    const auth = requireAuth(request);
    const r = await load(auth, request.params.id);
    if (r.status !== 'approved') throw Errors.conflict('Only published items can be rated.');
    if (r.uploaderId === auth.userId) throw Errors.badRequest('You cannot rate your own upload.');
    const now = new Date();
    const before = await db.col('resource_ratings').findOneAndUpdate(
      { _id: `${r._id}:${auth.userId}` },
      { $set: { rating: request.body.rating, updatedAt: now }, $setOnInsert: { resourceId: r._id, userId: auth.userId, createdAt: now } },
      { upsert: true, returnDocument: 'before' },
    );
    const updated = await resources().findOneAndUpdate(
      { _id: r._id },
      { $inc: before ? { ratingSum: request.body.rating - before.rating } : { ratingSum: request.body.rating, ratingCount: 1 } },
      { returnDocument: 'after', projection: { ratingSum: 1, ratingCount: 1 } },
    );
    const count = updated?.ratingCount ?? 1;
    return { rating: Math.round(((updated?.ratingSum ?? request.body.rating) / count) * 10) / 10, ratingCount: count, myRating: request.body.rating };
  });

  app.post(
    '/resources/:id/review',
    { schema: { tags: ['shelf'], summary: 'Approve or reject an upload (staff)', params: idParam, body: z.object({ decision: z.enum(['approve', 'reject']), note: optionalText(500) }) } },
    async (request) => {
      const auth = requireRole(request, ...STAFF_ROLES);
      const status = request.body.decision === 'approve' ? 'approved' : 'rejected';
      const row = await db.tx(async (session) => {
        const r = await resources().findOneAndUpdate(
          { _id: request.params.id, collegeId: auth.collegeId, status: 'pending' },
          { $set: { status, reviewerId: auth.userId, reviewNote: request.body.note ?? null, reviewedAt: new Date(), updatedAt: new Date() } },
          { session, projection: { uploaderId: 1, title: 1, subjectId: 1 } },
        );
        if (!r) throw Errors.notFound('This pending upload');
        await audit(db, { action: `resource.${request.body.decision}`, actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'resource', entityId: request.params.id, requestId: request.id }, session);
        return r;
      });
      if (status === 'approved') await countSubject(row.subjectId, 1);
      if (row.uploaderId) {
        await app.deps.notifier.send({
          userId: row.uploaderId,
          kind: 'verification',
          title: status === 'approved' ? `"${row.title}" is now on the shelf` : `"${row.title}" was not approved`,
          body: request.body.note ?? '',
          link: `/resources?id=${request.params.id}`,
          actorId: auth.userId,
          entityType: 'resource',
          entityId: request.params.id,
        });
      }
      return { status };
    },
  );

  app.delete('/resources/:id', { schema: { tags: ['shelf'], summary: 'Remove a shelf item', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const r = await resources().findOneAndUpdate(
      { _id: request.params.id, collegeId: auth.collegeId, deletedAt: null, ...(isStaff(auth) ? {} : { uploaderId: auth.userId }) },
      { $set: { deletedAt: new Date(), status: 'removed', updatedAt: new Date() } },
      { projection: { status: 1, subjectId: 1 } },
    );
    if (!r) throw Errors.notFound('This resource');
    if (r.status === 'approved') await countSubject(r.subjectId, -1);
    return { status: 'deleted' };
  });
};
