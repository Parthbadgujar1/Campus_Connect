import type { FastifyPluginAsync } from 'fastify';
import type { Collection, Document, Filter, Sort } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../core/guards.js';
import { contains, equalsIgnoringCase } from '../../core/query.js';
import { loadViewer, visibleFilter } from '../feed/feed.service.js';
import { blockedIds, loadPeople, toPeople, type PersonDoc } from '../users/people.js';

// /v1/search — one search box for the whole campus.
//
// Each type first uses the collection's text index (word stemming: "placement" finds
// "placements", results ranked by relevance), then tops up with a case-insensitive substring
// match for partial words and names ("anan" finds "Ananya"). Every type applies the same
// visibility rules as its own module: audience-limited posts, private spaces, blocks,
// unpublished items and anonymous authors are all respected.

const TYPES = ['people', 'posts', 'discussions', 'spaces', 'events', 'opportunities', 'resources', 'lectures', 'hush', 'listings', 'lost_found'] as const;
type SearchType = (typeof TYPES)[number];

/** Text-index matches first (by relevance), then substring matches, without duplicates. */
async function findBoth<T extends Document & { _id: string }>(col: Collection<T>, base: Filter<T>, q: string, substring: Filter<T>, per: number, fallbackSort: Sort): Promise<T[]> {
  let first: T[] = [];
  try {
    first = (await col
      .find({ ...base, $text: { $search: q } } as Filter<T>, { projection: { score: { $meta: 'textScore' } } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(per)
      .toArray()) as T[];
  } catch {
    // A collection without a text index (or a query the parser rejects) falls back to substrings.
  }
  if (first.length >= per) return first;
  const seen = first.map((d) => d._id);
  const more = (await col
    .find({ $and: [base, substring, ...(seen.length ? [{ _id: { $nin: seen } }] : [])] } as Filter<T>)
    .sort(fallbackSort)
    .limit(per - first.length)
    .toArray()) as T[];
  return [...first, ...more];
}

export const searchRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;

  app.get(
    '/',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['search'],
        summary: 'Search everything (type=all gives a few of each)',
        querystring: z.object({ q: z.string().trim().min(2, 'Type at least 2 characters.').max(80), type: z.enum(['all', ...TYPES]).default('all'), limit: z.coerce.number().int().min(1).max(30).default(10) }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { q, type, limit } = request.query;
      const per = type === 'all' ? 4 : limit;
      const like = contains(q);
      const now = new Date();
      const [viewer, blocked] = await Promise.all([loadViewer(app.deps, auth), blockedIds(db, auth.userId)]);
      const notBlocked = (field: string) => (blocked.length ? { [field]: { $nin: blocked } } : {});

      const runners: Record<SearchType, () => Promise<unknown[]>> = {
        people: async () => {
          const rows = await findBoth(
            db.col('users'),
            { collegeId: auth.collegeId, status: 'active', deletionScheduledFor: null, _id: { $nin: blocked } },
            q,
            { $or: [{ 'profile.displayName': like }, { 'profile.username': like }, { 'profile.skills': equalsIgnoringCase(q) }] },
            per,
            { 'profile.followersCount': -1 },
          );
          const docs = rows as unknown as PersonDoc[];
          const people = await toPeople(app.deps, docs);
          return docs.filter((d) => people.has(d._id)).map((d) => ({ ...people.get(d._id)!, headline: d.profile.headline, link: `/profile/${d.profile.username}` }));
        },
        posts: async () => {
          const rows = await findBoth(db.col('posts'), visibleFilter(viewer), q, { $or: [{ body: like }, { tags: q.toLowerCase() }] }, per, { createdAt: -1 });
          const people = await loadPeople(app.deps, rows.map((p) => p.authorId));
          return rows.map((x) => ({ id: x._id, body: x.body.slice(0, 200), author: x.isAnonymous ? 'Anonymous' : (people.get(x.authorId ?? '')?.displayName ?? 'Deleted user'), createdAt: x.createdAt.toISOString(), link: `/post/${x._id}` }));
        },
        discussions: async () => {
          const readable = await db
            .col('spaces')
            .find({ collegeId: auth.collegeId, status: 'active', $or: [{ privacy: 'public' }, { _id: { $in: viewer.spaceIds } }] }, { projection: { slug: 1, name: 1 } })
            .limit(3000)
            .toArray();
          const spaceBy = new Map(readable.map((s) => [s._id, s]));
          const rows = await findBoth(
            db.col('discussions'),
            { collegeId: auth.collegeId, status: 'published', deletedAt: null, spaceId: { $in: [...spaceBy.keys()] }, ...notBlocked('authorId') },
            q,
            { $or: [{ title: like }, { body: like }] },
            per,
            { score: -1 },
          );
          return rows.map((x) => ({ id: x._id, title: x.title, excerpt: x.body.slice(0, 160), score: x.score, replies: x.repliesCount, space: spaceBy.get(x.spaceId)?.name ?? '', link: `/spaces/${spaceBy.get(x.spaceId)?.slug ?? ''}/t/${x._id}` }));
        },
        spaces: async () => {
          const rows = await findBoth(db.col('spaces'), { collegeId: auth.collegeId, status: 'active' }, q, { $or: [{ name: like }, { description: like }, { tags: q.toLowerCase() }] }, per, { membersCount: -1 });
          return rows.map((x) => ({ id: x._id, name: x.name, kind: x.kind, privacy: x.privacy, members: x.membersCount, description: x.description.slice(0, 140), link: `/spaces/${x.slug}` }));
        },
        events: async () => {
          const rows = await findBoth(
            db.col('events'),
            { collegeId: auth.collegeId, status: 'published', endsAt: { $gt: new Date(now.getTime() - 30 * 86_400_000) } },
            q,
            { $or: [{ title: like }, { venue: like }, { tags: q.toLowerCase() }] },
            per,
            { startsAt: 1 },
          );
          return rows.map((x) => ({ id: x._id, title: x.title, category: x.category, startsAt: x.startsAt.toISOString(), venue: x.venue, link: `/events/${x._id}` }));
        },
        opportunities: async () => {
          const rows = await findBoth(db.col('opportunities'), { collegeId: auth.collegeId, status: 'published', deadline: { $gt: now } }, q, { $or: [{ title: like }, { orgName: like }, { skills: equalsIgnoringCase(q) }] }, per, { deadline: 1 });
          return rows.map((x) => ({ id: x._id, title: x.title, orgName: x.orgName, kind: x.kind, deadline: x.deadline.toISOString(), link: `/opportunities/${x._id}` }));
        },
        resources: async () => {
          const rows = await findBoth(db.col('resources'), { collegeId: auth.collegeId, status: 'approved', deletedAt: null }, q, { $or: [{ title: like }, { subject: like }] }, per, { downloadsCount: -1 });
          return rows.map((x) => ({ id: x._id, title: x.title, kind: x.kind, subject: x.subject, downloads: x.downloadsCount, link: `/resources?id=${x._id}` }));
        },
        lectures: async () => {
          const rows = await findBoth(db.col('lectures'), { collegeId: auth.collegeId, status: 'published', deletedAt: null }, q, { $or: [{ title: like }, { subject: like }] }, per, { viewsCount: -1 });
          return rows.map((x) => ({ id: x._id, title: x.title, subject: x.subject, durationSeconds: x.durationSeconds, link: `/lectures?id=${x._id}` }));
        },
        hush: async () => {
          const rows = await findBoth(db.col('hush_questions'), { collegeId: auth.collegeId, status: 'published', deletedAt: null, ...notBlocked('authorId') }, q, { body: like }, per, { votesCount: -1 });
          return rows.map((x) => ({ id: x._id, topic: x.topic, body: x.body.slice(0, 200), answers: x.answersCount, link: `/hush/${x._id}` }));
        },
        listings: async () => {
          const rows = await findBoth(db.col('listings'), { collegeId: auth.collegeId, deletedAt: null, status: { $in: ['available', 'reserved'] }, ...notBlocked('sellerId') }, q, { $or: [{ title: like }, { description: like }] }, per, { createdAt: -1 });
          return rows.map((x) => ({ id: x._id, title: x.title, mode: x.mode, pricePaise: x.pricePaise, condition: x.condition, link: `/marketplace/${x._id}` }));
        },
        lost_found: async () => {
          const rows = await findBoth(db.col('lost_found_items'), { collegeId: auth.collegeId, deletedAt: null, status: { $in: ['open', 'claim_pending'] } }, q, { $or: [{ title: like }, { location: like }] }, per, { occurredAt: -1 });
          return rows.map((x) => ({ id: x._id, kind: x.kind, title: x.title, location: x.location, occurredAt: x.occurredAt.toISOString(), link: `/lost-found?id=${x._id}` }));
        },
      };

      const wanted: SearchType[] = type === 'all' ? [...TYPES] : [type];
      // Each type runs independently: if one query fails, the others still answer.
      const settled = await Promise.allSettled(wanted.map((t) => runners[t]()));
      const results: Record<string, unknown[]> = {};
      const unavailable: string[] = [];
      settled.forEach((s, i) => {
        const t = wanted[i]!;
        if (s.status === 'fulfilled') results[t] = s.value;
        else {
          unavailable.push(t);
          request.log.warn({ err: (s.reason as Error).message, type: t }, 'search type failed');
        }
      });
      const total = Object.values(results).reduce((n, list) => n + list.length, 0);
      return { q, results, total, unavailable };
    },
  );

};
