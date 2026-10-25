import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { requireAuth, requireRole } from '../../core/guards.js';
import type { Report } from '../../core/exports/report.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, olderThan } from '../../core/query.js';
import { cleanText, idParam, text } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Feedback } from '../../infra/db/models.js';
import { loadPeople, personOf } from '../users/people.js';
import { sendReport } from '../surveys/surveys.routes.js';

// /v1/feedback (everyone, from Settings) and /v1/admin/feedback (admins) — what people think
// of the app: bugs, ideas, praise and questions, with an optional star rating. Admins read it in
// the console, mark progress (reviewed, planned, done) and download it as Excel, Word, PDF or CSV.
// The person who wrote it is told when its status changes.

const CATEGORIES = ['bug', 'idea', 'praise', 'question', 'other'] as const;
const STATUSES = ['new', 'reviewed', 'planned', 'done'] as const;

export const feedbackRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const feedback = () => db.col('feedback');

  app.post(
    '/feedback',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      schema: {
        tags: ['feedback'],
        summary: 'Send feedback about the app',
        body: z.object({
          category: z.enum(CATEGORIES),
          rating: z.number().int().min(1).max(5).optional(),
          message: text(3, 4000),
          page: z.string().trim().max(200).regex(/^\/[A-Za-z0-9/_\-?=&.%]*$/).optional(),
          appVersion: z.string().trim().max(40).regex(/^[A-Za-z0-9._ -]*$/).optional(),
        }),
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request);
      const b = request.body;
      const now = new Date();
      const id = uuidv7();
      await feedback().insertOne({ _id: id, collegeId: auth.collegeId, userId: auth.userId, category: b.category, rating: b.rating ?? null, message: cleanText(b.message), page: b.page ?? null, appVersion: b.appVersion ?? null, status: 'new', createdAt: now, updatedAt: now });
      return reply.status(201).send({ id, status: 'new', message: 'Thank you! The team reads every message.' });
    },
  );

  app.get('/feedback/mine', { schema: { tags: ['feedback'], summary: 'Feedback I sent and its status' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await feedback().find({ userId: auth.userId }).sort({ createdAt: -1 }).limit(50).toArray();
    return { items: rows.map((f) => ({ id: f._id, category: f.category, rating: f.rating, message: f.message, status: f.status, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() })) };
  });

  // ---------------------------------------------------------------- admin
  const listQuery = z.object({
    status: z.enum(STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    q: z.string().trim().max(80).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  });

  function filterOf(collegeId: string, f: z.infer<typeof listQuery>): Filter<Feedback> {
    const filter: Filter<Feedback> = { collegeId };
    if (f.status) filter.status = f.status;
    if (f.category) filter.category = f.category;
    if (f.rating) filter.rating = f.rating;
    if (f.q) filter.message = contains(f.q);
    if (f.from || f.to) filter.createdAt = { ...(f.from ? { $gte: f.from } : {}), ...(f.to ? { $lte: f.to } : {}) };
    return filter;
  }

  app.get('/admin/feedback', { schema: { tags: ['admin'], summary: 'App feedback, newest first, with totals', querystring: pageQuery.extend(listQuery.shape) } }, async (request) => {
    const auth = requireRole(request, 'admin', 'moderator');
    const { cursor, limit, ...filters } = request.query;
    const base = filterOf(auth.collegeId, filters);
    const [rows, stats] = await Promise.all([
      feedback().find({ $and: [base, olderThan('createdAt', decodeCursor(cursor)) as Filter<Feedback>] }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray(),
      cursor
        ? Promise.resolve(null)
        : feedback()
            .aggregate<{ byCategory: Array<{ _id: string; n: number }>; byStatus: Array<{ _id: string; n: number }>; rating: Array<{ avg: number; n: number }>; total: Array<{ n: number }> }>([
              { $match: { collegeId: auth.collegeId } },
              {
                $facet: {
                  byCategory: [{ $group: { _id: '$category', n: { $sum: 1 } } }],
                  byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
                  rating: [{ $match: { rating: { $ne: null } } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }],
                  total: [{ $count: 'n' }],
                },
              },
            ])
            .next(),
    ]);
    const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
    const people = await loadPeople(app.deps, items.map((f) => f.userId));
    return {
      stats: stats
        ? {
            total: stats.total[0]?.n ?? 0,
            averageRating: stats.rating[0] ? Math.round(stats.rating[0].avg * 10) / 10 : null,
            ratedCount: stats.rating[0]?.n ?? 0,
            byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, stats.byCategory.find((x) => x._id === c)?.n ?? 0])),
            byStatus: Object.fromEntries(STATUSES.map((s) => [s, stats.byStatus.find((x) => x._id === s)?.n ?? 0])),
          }
        : null,
      items: items.map((f) => ({ id: f._id, category: f.category, rating: f.rating, message: f.message, page: f.page, appVersion: f.appVersion, status: f.status, from: personOf(people, f.userId), createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() })),
      nextCursor,
    };
  });

  app.patch('/admin/feedback/:id', { schema: { tags: ['admin'], summary: 'Mark feedback reviewed, planned or done', params: idParam, body: z.object({ status: z.enum(STATUSES), reply: z.string().trim().max(500).optional() }) } }, async (request) => {
    const auth = requireRole(request, 'admin', 'moderator');
    const f = await feedback().findOneAndUpdate({ _id: request.params.id, collegeId: auth.collegeId }, { $set: { status: request.body.status, updatedAt: new Date() } }, { returnDocument: 'before' });
    if (!f) throw Errors.notFound('This feedback');
    await audit(db, { action: 'feedback.status', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'feedback', entityId: f._id, requestId: request.id, meta: { status: request.body.status } });
    if (f.status !== request.body.status && request.body.status !== 'new') {
      const words: Record<string, string> = { reviewed: 'The team read your feedback', planned: 'Your idea is planned', done: 'Your feedback was acted on' };
      await app.deps.notifier.send({ userId: f.userId, kind: 'system', title: words[request.body.status] ?? 'Feedback update', body: request.body.reply ?? f.message.slice(0, 120), link: '/settings/feedback', actorId: auth.userId, entityType: 'feedback', entityId: f._id });
    }
    return { status: request.body.status };
  });

  app.get(
    '/admin/feedback/export',
    { config: { rateLimit: { max: 30, timeWindow: '1 hour' } }, schema: { tags: ['admin'], summary: 'Download feedback as Excel, Word, PDF or CSV (current filters)', querystring: listQuery.extend({ format: z.enum(['xlsx', 'docx', 'pdf', 'csv']).default('xlsx') }) } },
    async (request, reply) => {
      const auth = requireRole(request, 'admin', 'moderator');
      const { format, ...filters } = request.query;
      const rows = await feedback().find(filterOf(auth.collegeId, filters)).sort({ createdAt: -1 }).limit(5000).toArray();
      const people = await loadPeople(app.deps, rows.map((f) => f.userId));
      const rated = rows.filter((f) => f.rating);
      const average = rated.length ? Math.round((rated.reduce((a, f) => a + (f.rating ?? 0), 0) / rated.length) * 10) / 10 : null;
      const report: Report = {
        title: 'App feedback',
        subtitle: `${rows.length} message${rows.length === 1 ? '' : 's'}${average ? ` · average rating ${average}/5` : ''} · exported ${new Date().toUTCString()}`,
        sections: [
          {
            heading: 'Overview',
            columns: ['Category', 'Messages'],
            rows: CATEGORIES.map((c) => [c, rows.filter((f) => f.category === c).length]),
          },
          {
            heading: 'Messages',
            columns: ['Date', 'From', 'Category', 'Rating', 'Status', 'Page', 'Message'],
            rows: rows.map((f) => {
              const p = personOf(people, f.userId);
              return [f.createdAt.toISOString().replace('T', ' ').slice(0, 16), `${p.displayName} (@${p.username})`, f.category, f.rating ?? '', f.status, f.page ?? '', f.message];
            }),
          },
        ],
      };
      await audit(db, { action: 'feedback.export', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'feedback', requestId: request.id, meta: { format, count: rows.length } });
      return sendReport(reply, report, format, 'feedback');
    },
  );
};
