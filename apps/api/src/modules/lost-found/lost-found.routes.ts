import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors } from '../../core/errors.js';
import { canModerate, requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, olderThan } from '../../core/query.js';
import { cleanText, idParam, optionalText, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { LostFoundItem } from '../../infra/db/models.js';
import type { AuthContext } from '../../types/fastify.js';
import { assertOwnFiles, loadFileViews } from '../files/files.service.js';
import { loadPeople, personOf } from '../users/people.js';

// /v1/lost-found — lost and found board.
// A found item can carry a question only the owner can answer ("what sticker is on it?"). Claims
// go to the finder privately; the answer is never shown to anyone else. Approving a claim
// marks the item returned and declines the other claims.

const CATEGORIES = ['electronics', 'books', 'id_card', 'keys', 'clothing', 'bag', 'other'] as const;

export const lostFoundRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const items = () => db.col('lost_found_items');
  const claims = () => db.col('lost_found_claims');

  async function views(rows: LostFoundItem[], auth: AuthContext) {
    const ids = rows.map((r) => r._id);
    const mineIds = rows.filter((r) => r.reporterId === auth.userId).map((r) => r._id);
    const [files, people, myClaims, pending] = await Promise.all([
      loadFileViews(app.deps, rows.map((r) => r.imageFileId)),
      loadPeople(app.deps, rows.map((r) => r.reporterId)),
      claims().find({ itemId: { $in: ids }, claimantId: auth.userId }, { projection: { itemId: 1, status: 1 } }).toArray(),
      mineIds.length
        ? claims().aggregate<{ _id: string; n: number }>([{ $match: { itemId: { $in: mineIds }, status: 'pending' } }, { $group: { _id: '$itemId', n: { $sum: 1 } } }]).toArray()
        : Promise.resolve([]),
    ]);
    const claimBy = new Map(myClaims.map((c) => [c.itemId, c.status]));
    const pendingBy = new Map(pending.map((p) => [p._id, p.n]));
    return rows.map((r) => ({
      id: r._id,
      kind: r.kind,
      title: r.title,
      category: r.category,
      location: r.location,
      occurredAt: r.occurredAt.toISOString(),
      description: r.description,
      verificationQuestion: r.verificationQuestion,
      image: r.imageFileId ? (files.get(r.imageFileId) ?? null) : null,
      status: r.status,
      reporter: personOf(people, r.reporterId),
      isMine: r.reporterId === auth.userId,
      myClaim: claimBy.get(r._id) ?? null,
      pendingClaims: r.reporterId === auth.userId ? (pendingBy.get(r._id) ?? 0) : undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  app.get(
    '/',
    { schema: { tags: ['lost-found'], summary: 'The board', querystring: pageQuery.extend({ kind: z.enum(['lost', 'found']).optional(), category: z.enum(CATEGORIES).optional(), q: z.string().trim().max(60).optional(), include: z.enum(['open', 'resolved', 'mine']).default('open') }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, kind, category, q, include } = request.query;
      const and: Filter<LostFoundItem>[] = [{ collegeId: auth.collegeId, deletedAt: null }];
      if (include === 'open') and.push({ status: { $in: ['open', 'claim_pending'] } });
      if (include === 'resolved') and.push({ status: { $in: ['returned', 'closed'] } });
      if (include === 'mine') and.push({ reporterId: auth.userId });
      if (kind) and.push({ kind });
      if (category) and.push({ category });
      if (q) and.push({ $or: [{ title: contains(q) }, { location: contains(q) }, { description: contains(q) }] });
      and.push(olderThan('occurredAt', decodeCursor(cursor)) as Filter<LostFoundItem>);
      const rows = await items().find({ $and: and }).sort({ occurredAt: -1, _id: -1 }).limit(limit + 1).toArray();
      const { items: list, nextCursor } = page(rows, limit, (r) => encodeCursor(r.occurredAt, r._id));
      return { items: await views(list, auth), nextCursor };
    },
  );

  async function load(auth: AuthContext, id: string) {
    const r = await items().findOne({ _id: id, collegeId: auth.collegeId, deletedAt: null });
    if (!r) throw Errors.notFound('This item');
    return r;
  }

  app.get('/:id', { schema: { tags: ['lost-found'], summary: 'One item', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const [v] = await views([await load(auth, request.params.id)], auth);
    return v;
  });

  app.post(
    '/',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 day' } },
      schema: {
        tags: ['lost-found'],
        summary: 'Report a lost or found item',
        body: z.object({
          kind: z.enum(['lost', 'found']),
          title: text(3, 120),
          category: z.enum(CATEGORIES),
          location: text(2, 160),
          occurredAt: z.coerce.date(),
          description: optionalText(2000),
          verificationQuestion: optionalText(200),
          imageFileId: uuid.optional(),
        }),
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request);
      const b = request.body;
      if (b.occurredAt > new Date(Date.now() + 3600_000)) throw Errors.validation([{ field: 'occurredAt', message: 'That date is in the future.' }]);
      if (b.imageFileId) await assertOwnFiles(app.deps, auth.userId, [b.imageFileId], ['lost_found'], ['image']);
      const now = new Date();
      const id = uuidv7();
      await items().insertOne({
        _id: id,
        collegeId: auth.collegeId,
        reporterId: auth.userId,
        kind: b.kind,
        title: cleanText(b.title),
        category: b.category,
        location: cleanText(b.location),
        occurredAt: b.occurredAt,
        description: cleanText(b.description ?? ''),
        verificationQuestion: b.kind === 'found' ? (b.verificationQuestion ?? null) : null,
        imageFileId: b.imageFileId ?? null,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      return reply.status(201).send({ id });
    },
  );

  app.patch(
    '/:id',
    { schema: { tags: ['lost-found'], summary: 'Update or close my report', params: idParam, body: z.object({ status: z.enum(['open', 'returned', 'closed']).optional(), description: optionalText(2000), location: text(2, 160).optional(), title: text(3, 120).optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const r = await load(auth, request.params.id);
      if (r.reporterId !== auth.userId && !canModerate(auth)) throw Errors.forbidden();
      const b = request.body;
      const set: Partial<LostFoundItem> = { updatedAt: new Date() };
      if (b.status) set.status = b.status;
      if (b.description !== undefined) set.description = cleanText(b.description);
      if (b.location) set.location = cleanText(b.location);
      if (b.title) set.title = cleanText(b.title);
      await items().updateOne({ _id: r._id }, { $set: set });
      return { status: 'saved' };
    },
  );

  app.delete('/:id', { schema: { tags: ['lost-found'], summary: 'Remove my report', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const r = await load(auth, request.params.id);
    if (r.reporterId !== auth.userId && !canModerate(auth)) throw Errors.forbidden();
    await items().updateOne({ _id: r._id }, { $set: { deletedAt: new Date(), updatedAt: new Date() } });
    return { status: 'deleted' };
  });

  app.post(
    '/:id/claims',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, schema: { tags: ['lost-found'], summary: 'Claim a found item', params: idParam, body: z.object({ answer: text(3, 500) }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const r = await load(auth, request.params.id);
      if (r.kind !== 'found') throw Errors.badRequest('Only found items can be claimed. For lost items, message the person who lost it.');
      if (r.reporterId === auth.userId) throw Errors.badRequest('You reported this item.');
      if (!['open', 'claim_pending'].includes(r.status)) throw Errors.conflict('This item has already been returned.');
      const answer = cleanText(request.body.answer);
      const existing = await claims().findOne({ itemId: r._id, claimantId: auth.userId });
      if (existing && (existing.status === 'pending' || existing.status === 'approved')) throw Errors.alreadyExists('You already claimed this item.');
      let id = existing?._id ?? uuidv7();
      if (existing) {
        await claims().updateOne({ _id: existing._id, status: { $in: ['withdrawn', 'rejected'] } }, { $set: { answer, status: 'pending', decidedAt: null } });
      } else {
        await claims().insertOne({ _id: id, itemId: r._id, claimantId: auth.userId, answer, status: 'pending', decidedAt: null, createdAt: new Date() });
      }
      await items().updateOne({ _id: r._id, status: 'open' }, { $set: { status: 'claim_pending', updatedAt: new Date() } });
      if (r.reporterId) {
        await app.deps.notifier.send({ userId: r.reporterId, kind: 'system', title: `Someone claimed "${r.title}"`, body: 'Check their answer to your question.', link: `/lost-found?id=${r._id}`, actorId: auth.userId, entityType: 'lost_found', entityId: r._id });
      }
      return reply.status(201).send({ id, status: 'pending' });
    },
  );

  app.delete('/:id/claims/mine', { schema: { tags: ['lost-found'], summary: 'Withdraw my claim', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const r = await load(auth, request.params.id);
    const res = await claims().updateOne({ itemId: r._id, claimantId: auth.userId, status: 'pending' }, { $set: { status: 'withdrawn', decidedAt: new Date() } });
    if (!res.modifiedCount) throw Errors.notFound('Your claim');
    if (!(await claims().countDocuments({ itemId: r._id, status: 'pending' }))) await items().updateOne({ _id: r._id, status: 'claim_pending' }, { $set: { status: 'open' } });
    return { status: 'withdrawn' };
  });

  app.get('/:id/claims', { schema: { tags: ['lost-found'], summary: 'Claims on my found item', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const r = await load(auth, request.params.id);
    if (r.reporterId !== auth.userId && !canModerate(auth)) throw Errors.forbidden();
    const rows = await claims().find({ itemId: r._id }).sort({ createdAt: 1 }).limit(200).toArray();
    const people = await loadPeople(app.deps, rows.map((c) => c.claimantId));
    return { items: rows.map((c) => ({ id: c._id, answer: c.answer, status: c.status, claimant: personOf(people, c.claimantId), createdAt: c.createdAt.toISOString() })) };
  });

  app.post(
    '/claims/:id/decision',
    { schema: { tags: ['lost-found'], summary: 'Approve or decline a claim (finder)', params: idParam, body: z.object({ decision: z.enum(['approve', 'reject']) }) } },
    async (request) => {
      const auth = requireAuth(request);
      const c = await claims().findOne({ _id: request.params.id });
      const item = c ? await items().findOne({ _id: c.itemId }, { projection: { reporterId: 1, title: 1, collegeId: 1 } }) : null;
      if (!c || !item || item.collegeId !== auth.collegeId) throw Errors.notFound('This claim');
      if (item.reporterId !== auth.userId) throw Errors.forbidden();
      if (c.status !== 'pending') throw Errors.conflict('This claim was already decided.');
      const now = new Date();
      await db.tx(async (session) => {
        if (request.body.decision === 'approve') {
          await claims().updateOne({ _id: c._id }, { $set: { status: 'approved', decidedAt: now } }, { session });
          await claims().updateMany({ itemId: c.itemId, _id: { $ne: c._id }, status: 'pending' }, { $set: { status: 'rejected', decidedAt: now } }, { session });
          await items().updateOne({ _id: c.itemId }, { $set: { status: 'returned', updatedAt: now } }, { session });
        } else {
          await claims().updateOne({ _id: c._id }, { $set: { status: 'rejected', decidedAt: now } }, { session });
          const stillPending = await claims().countDocuments({ itemId: c.itemId, status: 'pending' }, { session });
          if (!stillPending) await items().updateOne({ _id: c.itemId, status: 'claim_pending' }, { $set: { status: 'open', updatedAt: now } }, { session });
        }
      });
      await app.deps.notifier.send({
        userId: c.claimantId,
        kind: 'system',
        title: request.body.decision === 'approve' ? `Your claim for "${item.title}" was approved` : `Your claim for "${item.title}" was declined`,
        body: request.body.decision === 'approve' ? 'Message the finder to arrange the handover.' : '',
        link: `/lost-found?id=${c.itemId}`,
        actorId: auth.userId,
        entityType: 'lost_found',
        entityId: c.itemId,
      });
      return { status: request.body.decision === 'approve' ? 'approved' : 'rejected' };
    },
  );
};
