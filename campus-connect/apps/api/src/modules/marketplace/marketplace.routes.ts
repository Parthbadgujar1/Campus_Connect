import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors } from '../../core/errors.js';
import { canModerate, requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, olderThan } from '../../core/query.js';
import { boolQuery, cleanText, idParam, optionalText, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Listing } from '../../infra/db/models.js';
import type { AuthContext } from '../../types/fastify.js';
import { openDirectChat, postSystemMessage } from '../chats/chats.service.js';
import { assertOwnFiles, loadFileViews, type FileView } from '../files/files.service.js';
import { blockedIds, isBlockedBetween, loadPeople, personOf } from '../users/people.js';

// /v1/listings — the student marketplace: sell, lend, swap or give away.
// Prices are integers in paise (₹1 = 100 paise) so totals never suffer floating-point errors.
// There are no fees and no payments inside the app: buyers contact sellers in chat and meet on
// campus. "Contact seller" opens (or reuses) a direct chat with a short system message.

const CATEGORIES = ['books', 'electronics', 'laptops_phones', 'furniture', 'cycles', 'equipment', 'clothing', 'sports', 'housing', 'services', 'other'] as const;
// rent: rooms and PGs (price per month); services: tutoring, repairs, design... (price per job).
const MODES = ['sell', 'rent', 'borrow', 'exchange', 'free'] as const;

const body = z
  .object({
    title: text(3, 120),
    mode: z.enum(MODES),
    category: z.enum(CATEGORIES),
    pricePaise: z.number().int().min(0).max(100_000_000).optional(),
    condition: z.enum(['new', 'like_new', 'good', 'fair']),
    location: text(2, 120),
    description: optionalText(2000),
    returnBy: z.iso.date().optional(),
    imageFileIds: z.array(uuid).max(8).default([]),
  })
  .refine((b) => !['sell', 'rent'].includes(b.mode) || (b.pricePaise ?? 0) > 0, { message: 'Add a price (for rent, the amount per month).', path: ['pricePaise'] })
  .refine((b) => b.mode !== 'borrow' || Boolean(b.returnBy), { message: 'Add the date it should come back.', path: ['returnBy'] });

export const marketplaceRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const listings = () => db.col('listings');

  async function views(rows: Listing[], auth: AuthContext) {
    const [files, people, saved] = await Promise.all([
      loadFileViews(app.deps, rows.flatMap((r) => r.imageIds)),
      loadPeople(app.deps, rows.map((r) => r.sellerId)),
      db.col('saved_items').find({ _id: { $in: rows.map((r) => `${auth.userId}:listing:${r._id}`) } }, { projection: { itemId: 1 } }).toArray(),
    ]);
    const savedSet = new Set(saved.map((s) => s.itemId));
    return rows.map((r) => ({
      id: r._id,
      title: r.title,
      mode: r.mode,
      category: r.category,
      pricePaise: r.pricePaise,
      condition: r.condition,
      location: r.location,
      description: r.description,
      returnBy: r.returnBy,
      status: r.status,
      images: r.imageIds.map((id) => files.get(id)).filter((f): f is FileView => Boolean(f)),
      seller: personOf(people, r.sellerId),
      isMine: r.sellerId === auth.userId,
      saved: savedSet.has(r._id),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  app.get(
    '/',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Browse listings',
        querystring: pageQuery.extend({
          mode: z.enum(MODES).optional(),
          category: z.enum(CATEGORIES).optional(),
          q: z.string().trim().max(60).optional(),
          minPaise: z.coerce.number().int().min(0).optional(),
          maxPaise: z.coerce.number().int().min(0).optional(),
          mine: boolQuery,
          sort: z.enum(['new', 'price_low', 'price_high']).default('new'),
        }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, mode, category, q, minPaise, maxPaise, mine, sort } = request.query;
      const blocked = await blockedIds(db, auth.userId);
      const and: Filter<Listing>[] = [{ collegeId: auth.collegeId, deletedAt: null }];
      and.push(mine ? { sellerId: auth.userId } : { status: { $in: ['available', 'reserved'] }, ...(blocked.length ? { sellerId: { $nin: blocked } } : {}) });
      if (mode) and.push({ mode });
      if (category) and.push({ category });
      if (q) and.push({ $or: [{ title: contains(q) }, { description: contains(q) }] });
      if (minPaise !== undefined || maxPaise !== undefined) {
        // Free, swap and borrow items count as price 0.
        and.push({ $expr: { $and: [{ $gte: [{ $ifNull: ['$pricePaise', 0] }, minPaise ?? 0] }, { $lte: [{ $ifNull: ['$pricePaise', 0] }, maxPaise ?? Number.MAX_SAFE_INTEGER] }] } });
      }
      const after = decodeCursor(cursor);
      if (sort === 'new') {
        and.push(olderThan('createdAt', after) as Filter<Listing>);
        const rows = await listings().find({ $and: and }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
        const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
        return { items: await views(items, auth), nextCursor };
      }
      // Price order: the cursor carries the price and id of the last item.
      const dir = sort === 'price_low' ? 1 : -1;
      if (after) {
        const p = Number(after.at);
        const cmp = dir === 1 ? '$gt' : '$lt';
        and.push({ $or: [{ pricePaise: { [cmp]: p } }, { pricePaise: p, _id: { [cmp]: after.id } }] } as Filter<Listing>);
      }
      const rows = await listings().find({ $and: and }).sort({ pricePaise: dir, _id: dir }).limit(limit + 1).toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.pricePaise ?? 0, r._id));
      return { items: await views(items, auth), nextCursor };
    },
  );

  async function load(auth: AuthContext, id: string) {
    const r = await listings().findOne({ _id: id, collegeId: auth.collegeId, deletedAt: null });
    if (!r || (r.sellerId !== auth.userId && (await isBlockedBetween(db, auth.userId, r.sellerId)))) throw Errors.notFound('This listing');
    return r;
  }

  app.get('/:id', { schema: { tags: ['marketplace'], summary: 'One listing', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const [v] = await views([await load(auth, request.params.id)], auth);
    return v;
  });

  app.post('/', { config: { rateLimit: { max: 20, timeWindow: '1 day' } }, schema: { tags: ['marketplace'], summary: 'Create a listing', body } }, async (request, reply) => {
    const auth = requireAuth(request);
    const b = request.body;
    await assertOwnFiles(app.deps, auth.userId, b.imageFileIds, ['listing'], ['image']);
    const now = new Date();
    const id = uuidv7();
    await listings().insertOne({
      _id: id,
      collegeId: auth.collegeId,
      sellerId: auth.userId,
      title: cleanText(b.title),
      mode: b.mode,
      category: b.category,
      pricePaise: b.mode === 'sell' || b.mode === 'rent' ? (b.pricePaise ?? null) : null,
      condition: b.condition,
      location: cleanText(b.location),
      description: cleanText(b.description ?? ''),
      returnBy: b.mode === 'borrow' ? (b.returnBy ?? null) : null,
      imageIds: [...new Set(b.imageFileIds)],
      status: 'available',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    return reply.status(201).send({ id });
  });

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Edit or mark sold/reserved',
        params: idParam,
        body: z.object({
          title: text(3, 120).optional(),
          pricePaise: z.number().int().min(1).max(100_000_000).optional(),
          description: optionalText(2000),
          location: text(2, 120).optional(),
          condition: z.enum(['new', 'like_new', 'good', 'fair']).optional(),
          imageFileIds: z.array(uuid).max(8).optional(),
          status: z.enum(['available', 'reserved', 'borrowed', 'sold']).optional(),
        }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const r = await load(auth, request.params.id);
      if (r.sellerId !== auth.userId) throw Errors.forbidden();
      const b = request.body;
      if (b.pricePaise !== undefined && r.mode !== 'sell' && r.mode !== 'rent') throw Errors.validation([{ field: 'pricePaise', message: 'Only items for sale or rent have a price.' }]);
      if (b.imageFileIds) await assertOwnFiles(app.deps, auth.userId, b.imageFileIds, ['listing'], ['image']);
      const set: Partial<Listing> = { updatedAt: new Date() };
      if (b.title) set.title = cleanText(b.title);
      if (b.pricePaise !== undefined) set.pricePaise = b.pricePaise;
      if (b.description !== undefined) set.description = cleanText(b.description);
      if (b.location) set.location = cleanText(b.location);
      if (b.condition) set.condition = b.condition;
      if (b.imageFileIds) set.imageIds = [...new Set(b.imageFileIds)];
      if (b.status) set.status = b.status;
      await listings().updateOne({ _id: r._id }, { $set: set });
      return { status: 'saved' };
    },
  );

  app.delete('/:id', { schema: { tags: ['marketplace'], summary: 'Remove a listing', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const r = await load(auth, request.params.id);
    if (r.sellerId !== auth.userId && !canModerate(auth)) throw Errors.forbidden();
    await listings().updateOne({ _id: r._id }, { $set: { deletedAt: new Date(), status: 'removed', updatedAt: new Date() } });
    return { status: 'deleted' };
  });

  app.post('/:id/contact', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } }, schema: { tags: ['marketplace'], summary: 'Message the seller (opens a direct chat)', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const r = await load(auth, request.params.id);
    if (r.sellerId === auth.userId) throw Errors.badRequest('This is your own listing.');
    if (!['available', 'reserved'].includes(r.status)) throw Errors.conflict('This item is no longer available.');
    const chatId = await openDirectChat(app.deps, auth, r.sellerId);
    await postSystemMessage(app.deps, chatId, `${auth.displayName} is asking about "${r.title}".`, { listingId: r._id });
    return { chatId };
  });
};
