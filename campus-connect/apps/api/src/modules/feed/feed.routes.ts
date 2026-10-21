import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { canModerate, isStaff, requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { lowerThan, newerThan, olderThan } from '../../core/query.js';
import { cleanText, idParam, tags, tagsPatch, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Comment, Post } from '../../infra/db/models.js';
import { limits } from '../../plugins/traffic.js';
import type { AuthContext } from '../../types/fastify.js';
import { assertOwnFiles } from '../files/files.service.js';
import { blockedIds, loadPeople } from '../users/people.js';
import { baseFilter, loadViewer, notifyMentions, postOwner, toPostViews, visibleFilter } from './feed.service.js';

// /v1/feed, /v1/posts, /v1/comments — the home feed.

const createPost = z
  .object({
    body: text(1, 5000),
    kind: z.enum(['post', 'question', 'poll', 'announcement']).default('post'),
    audience: z.enum(['college', 'department', 'year', 'division', 'space']).default('college'),
    departmentId: uuid.optional(),
    year: z.number().int().min(1).max(6).optional(),
    division: z.string().trim().min(1).max(8).optional(),
    spaceId: uuid.optional(),
    tags,
    anonymous: z.boolean().default(false),
    attachments: z.array(uuid).max(10).default([]),
    poll: z.object({ options: z.array(text(1, 120)).min(2).max(6) }).optional(),
  })
  .refine((b) => (b.kind === 'poll') === Boolean(b.poll), { message: 'Polls need 2-6 options; other posts have none.', path: ['poll'] })
  .refine((b) => !(b.anonymous && b.kind === 'announcement'), { message: 'Announcements cannot be anonymous.', path: ['anonymous'] });

export const feedRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const posts = () => db.col('posts');

  async function visiblePost(postId: string, auth: AuthContext): Promise<Post> {
    const viewer = await loadViewer(app.deps, auth);
    // Posts in public spaces are readable by everyone at the college, like the space itself.
    let post = await posts().findOne({ $and: [{ _id: postId }, visibleFilter(viewer)] });
    if (!post) {
      const candidate = await posts().findOne({ $and: [{ _id: postId, 'audience.type': 'space' }, baseFilter(viewer)] });
      if (candidate?.audience.spaceId) {
        const space = await db.col('spaces').findOne({ _id: candidate.audience.spaceId, collegeId: auth.collegeId, status: 'active', privacy: 'public' }, { projection: { _id: 1 } });
        if (space) post = candidate;
      }
    }
    if (!post) throw Errors.notFound('This post');
    return post;
  }

  // ---------------------------------------------------------------- feed
  app.get(
    '/feed',
    {
      schema: {
        tags: ['feed'],
        summary: 'Posts I can see, newest first',
        querystring: pageQuery.extend({
          // trending = most liked in the last 7 days; loops = posts with a video (short videos).
          scope: z.enum(['all', 'following', 'campus', 'class', 'space', 'author', 'tag', 'trending', 'loops']).default('all'),
          spaceId: uuid.optional(),
          authorId: uuid.optional(),
          tag: z.string().trim().toLowerCase().max(30).optional(),
          kind: z.enum(['post', 'question', 'poll', 'announcement']).optional(),
        }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, scope, spaceId, authorId, tag, kind } = request.query;
      const viewer = await loadViewer(app.deps, auth);
      const and: Filter<Post>[] = [visibleFilter(viewer)];

      if (scope === 'following') {
        const follows = await db.col('follows').find({ followerId: auth.userId }, { projection: { followeeId: 1 } }).limit(5000).toArray();
        and.push({ authorId: { $in: follows.map((f) => f.followeeId) } });
      }
      if (scope === 'campus') and.push({ 'audience.type': 'college' });
      if (scope === 'class') and.push({ 'audience.type': { $in: ['department', 'year', 'division'] } });
      if (scope === 'space') {
        if (!spaceId) throw Errors.validation([{ field: 'spaceId', message: 'Choose a space.' }]);
        const space = await db.col('spaces').findOne({ _id: spaceId, collegeId: auth.collegeId, status: 'active' }, { projection: { privacy: 1 } });
        const member = viewer.spaceIds.includes(spaceId);
        if (!space || (space.privacy === 'private' && !member && !viewer.staff)) throw Errors.notFound('This space');
        // Access to the space is checked above (public spaces are readable by everyone at the
        // college), so the per-post audience rule is not needed here.
        and[0] = baseFilter(viewer);
        and.push({ 'audience.type': 'space', 'audience.spaceId': spaceId });
      }
      if (scope === 'author') {
        if (!authorId) throw Errors.validation([{ field: 'authorId', message: 'Choose a person.' }]);
        and.push({ authorId });
      }
      if (scope === 'tag') {
        if (!tag) throw Errors.validation([{ field: 'tag', message: 'Choose a tag.' }]);
        and.push({ tags: tag });
      }
      if (kind) and.push({ kind });
      if (scope === 'loops') and.push({ mediaKinds: 'video' });
      const after = decodeCursor(cursor);
      const trending = scope === 'trending';
      if (trending) and.push({ createdAt: { $gt: new Date(Date.now() - 7 * 86_400_000) } });
      if (after) and.push((trending ? lowerThan('likesCount', after) : olderThan('createdAt', after)) as Filter<Post>);

      const rows = await posts()
        .find({ $and: and })
        .sort(trending ? { likesCount: -1, _id: -1 } : { createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, limit, (r) => (trending ? encodeCursor(r.likesCount, r._id) : encodeCursor(r.createdAt, r._id)));

      // Pinned posts are shown above the first page of the main feed.
      let pinned: Post[] = [];
      if (!cursor && scope === 'all') {
        pinned = await posts()
          .find({ $and: [visibleFilter(viewer), { isPinned: true, createdAt: { $gt: new Date(Date.now() - 30 * 86_400_000) } }] })
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray();
      }
      const pinnedIds = new Set(pinned.map((p) => p._id));
      return {
        pinned: await toPostViews(app.deps, auth.userId, pinned),
        items: await toPostViews(app.deps, auth.userId, items.filter((r) => !pinnedIds.has(r._id))),
        nextCursor,
      };
    },
  );

  // ---------------------------------------------------------------- posts
  app.post(
    '/posts',
    { config: { rateLimit: { max: 30, timeWindow: '1 hour' } }, schema: { tags: ['feed'], summary: 'Create a post', body: createPost } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const b = request.body;
      const viewer = await loadViewer(app.deps, auth);
      const staff = isStaff(auth);

      if (b.kind === 'announcement' && !staff) throw Errors.forbidden('Only faculty and admins can post announcements.');
      if (b.anonymous && !(await app.deps.flags.isEnabled('feature.anonymous_posts', { userId: auth.userId, role: auth.role, collegeId: auth.collegeId }))) {
        throw Errors.featureDisabled('feature.anonymous_posts');
      }

      // Resolve the audience. Students post to their own class groups; staff may target any.
      let departmentId: string | null = null;
      let year: number | null = null;
      let division: string | null = null;
      let spaceId: string | null = null;
      if (b.audience === 'department') {
        departmentId = staff ? (b.departmentId ?? viewer.departmentId) : viewer.departmentId;
        if (!departmentId) throw Errors.validation([{ field: 'audience', message: 'Add your department to your profile first.' }]);
        if (staff && b.departmentId) {
          const ok = await db.col('departments').findOne({ _id: b.departmentId, collegeId: auth.collegeId }, { projection: { _id: 1 } });
          if (!ok) throw Errors.validation([{ field: 'departmentId', message: 'Choose a department from your college.' }]);
        }
      }
      if (b.audience === 'year' || b.audience === 'division') {
        year = staff ? (b.year ?? viewer.year) : viewer.year;
        if (!year) throw Errors.validation([{ field: 'audience', message: 'Add your year to your profile first.' }]);
      }
      if (b.audience === 'division') {
        division = staff ? (b.division ?? viewer.division) : viewer.division;
        if (!division) throw Errors.validation([{ field: 'audience', message: 'Add your division to your profile first.' }]);
      }
      if (b.audience === 'space') {
        if (!b.spaceId) throw Errors.validation([{ field: 'spaceId', message: 'Choose a space.' }]);
        const [member, space] = await Promise.all([
          db.col('space_members').findOne({ _id: `${b.spaceId}:${auth.userId}`, status: 'active' }, { projection: { _id: 1 } }),
          db.col('spaces').findOne({ _id: b.spaceId, collegeId: auth.collegeId, status: 'active' }, { projection: { _id: 1 } }),
        ]);
        if (!member || !space) throw Errors.forbidden('Join the space to post in it.');
        spaceId = b.spaceId;
      }
      await assertOwnFiles(app.deps, auth.userId, b.attachments, ['post']);
      const kinds = b.attachments.length ? await db.col('files').distinct('kind', { _id: { $in: b.attachments } }) : [];

      const body = cleanText(b.body);
      const now = new Date();
      const post: Post = {
        _id: uuidv7(),
        collegeId: auth.collegeId,
        authorId: b.anonymous ? null : auth.userId,
        isAnonymous: b.anonymous,
        kind: b.kind,
        body,
        audience: { type: b.audience, departmentId, year, division, spaceId },
        tags: b.tags,
        attachmentIds: b.attachments,
        mediaKinds: kinds,
        poll: b.poll ? { options: b.poll.options.map((label) => ({ id: uuidv7(), label: cleanText(label), votes: 0 })), totalVotes: 0 } : null,
        isPinned: false,
        likesCount: 0,
        commentsCount: 0,
        savesCount: 0,
        status: 'published',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db.tx(async (session) => {
        // The vault entry goes first: an anonymous post never exists without its author on record.
        if (b.anonymous) await db.col('anonymous_authors').insertOne({ _id: `post:${post._id}`, contentType: 'post', contentId: post._id, userId: auth.userId, createdAt: now }, { session });
        await posts().insertOne(post, { session });
        await db.col('users').updateOne({ _id: auth.userId }, { $inc: { 'profile.postsCount': b.anonymous ? 0 : 1 } }, { session });
      });
      if (!b.anonymous) await notifyMentions(app.deps, auth, body, `/post/${post._id}`, { type: 'post', id: post._id });
      const [view] = await toPostViews(app.deps, auth.userId, [post]);
      return reply.status(201).send(view);
    },
  );

  app.get('/posts/:id', { schema: { tags: ['feed'], summary: 'One post', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const [view] = await toPostViews(app.deps, auth.userId, [await visiblePost(request.params.id, auth)]);
    return view;
  });

  app.patch(
    '/posts/:id',
    { config: limits.write, schema: { tags: ['feed'], summary: 'Edit my post', params: idParam, body: z.object({ body: text(1, 5000).optional(), tags: tagsPatch }) } },
    async (request) => {
      const auth = requireAuth(request);
      const owner = await postOwner(app.deps, request.params.id);
      if (owner !== auth.userId) throw Errors.notFound('This post');
      const set: Partial<Post> = { updatedAt: new Date() };
      if (request.body.body) set.body = cleanText(request.body.body);
      if (request.body.tags) set.tags = request.body.tags;
      await posts().updateOne({ _id: request.params.id, deletedAt: null }, { $set: set });
      const [view] = await toPostViews(app.deps, auth.userId, [await visiblePost(request.params.id, auth)]);
      return view;
    },
  );

  app.delete('/posts/:id', { schema: { tags: ['feed'], summary: 'Delete a post (author or moderator)', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const owner = await postOwner(app.deps, request.params.id);
    const moderating = owner !== auth.userId && canModerate(auth);
    if (owner !== auth.userId && !moderating) throw Errors.notFound('This post');
    await db.tx(async (session) => {
      const row = await posts().findOneAndUpdate({ _id: request.params.id, collegeId: auth.collegeId, deletedAt: null }, { $set: { deletedAt: new Date(), updatedAt: new Date() } }, { session, projection: { authorId: 1 } });
      if (!row) throw Errors.notFound('This post');
      if (row.authorId) await db.col('users').updateOne({ _id: row.authorId, 'profile.postsCount': { $gt: 0 } }, { $inc: { 'profile.postsCount': -1 } }, { session });
      if (moderating) {
        await db.col('moderation_actions').insertOne(
          { _id: uuidv7(), collegeId: auth.collegeId, actorId: auth.userId, targetType: 'post', targetId: request.params.id, action: 'remove', reason: 'Deleted by a moderator', reportId: null, createdAt: new Date() },
          { session },
        );
        await audit(db, { action: 'moderation.post_delete', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'post', entityId: request.params.id, requestId: request.id }, session);
      }
    });
    return { status: 'deleted' };
  });

  app.put('/posts/:id/like', { config: limits.write, schema: { tags: ['feed'], summary: 'Like a post', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const post = await visiblePost(request.params.id, auth);
    const res = await db.col('post_likes').updateOne(
      { _id: `${post._id}:${auth.userId}` },
      { $setOnInsert: { postId: post._id, userId: auth.userId, createdAt: new Date() } },
      { upsert: true },
    );
    let likesCount = post.likesCount;
    if (res.upsertedCount) {
      const updated = await posts().findOneAndUpdate({ _id: post._id }, { $inc: { likesCount: 1 } }, { returnDocument: 'after', projection: { likesCount: 1 } });
      likesCount = updated?.likesCount ?? likesCount + 1;
      const owner = await postOwner(app.deps, post._id);
      if (owner) {
        await app.deps.notifier.send({
          userId: owner,
          kind: 'like',
          title: `${auth.displayName} liked your post`,
          body: post.body.slice(0, 140),
          link: `/post/${post._id}`,
          actorId: auth.userId,
          entityType: 'post',
          entityId: post._id,
        });
      }
    }
    return { liked: true, likesCount };
  });

  app.delete('/posts/:id/like', { config: limits.write, schema: { tags: ['feed'], summary: 'Remove my like', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const res = await db.col('post_likes').deleteOne({ _id: `${request.params.id}:${auth.userId}` });
    const updated = res.deletedCount
      ? await posts().findOneAndUpdate({ _id: request.params.id, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } }, { returnDocument: 'after', projection: { likesCount: 1 } })
      : await posts().findOne({ _id: request.params.id }, { projection: { likesCount: 1 } });
    return { liked: false, likesCount: updated?.likesCount ?? 0 };
  });

  app.put(
    '/posts/:id/vote',
    { config: limits.write, schema: { tags: ['feed'], summary: 'Vote in a poll (changing the vote is allowed)', params: idParam, body: z.object({ optionId: uuid }) } },
    async (request) => {
      const auth = requireAuth(request);
      const post = await visiblePost(request.params.id, auth);
      const optionId = request.body.optionId;
      if (!post.poll?.options.some((o) => o.id === optionId)) throw Errors.validation([{ field: 'optionId', message: 'Choose one of the poll options.' }]);
      // The previous vote (if any) tells us which counters to move.
      const before = await db.col('poll_votes').findOneAndUpdate(
        { _id: `${post._id}:${auth.userId}` },
        { $set: { optionId }, $setOnInsert: { postId: post._id, userId: auth.userId, createdAt: new Date() } },
        { upsert: true, returnDocument: 'before' },
      );
      if (!before) {
        await posts().updateOne({ _id: post._id, 'poll.options.id': optionId }, { $inc: { 'poll.options.$.votes': 1, 'poll.totalVotes': 1 } });
      } else if (before.optionId !== optionId) {
        await posts().updateOne(
          { _id: post._id },
          { $inc: { 'poll.options.$[next].votes': 1, 'poll.options.$[prev].votes': -1 } },
          { arrayFilters: [{ 'next.id': optionId }, { 'prev.id': before.optionId, 'prev.votes': { $gt: 0 } }] },
        );
      }
      const fresh = await posts().findOne({ _id: post._id });
      const [view] = await toPostViews(app.deps, auth.userId, [fresh ?? post]);
      return view!.poll;
    },
  );

  // ---------------------------------------------------------------- comments
  app.get(
    '/posts/:id/comments',
    { schema: { tags: ['feed'], summary: 'Comments on a post, oldest first', params: idParam, querystring: pageQuery } },
    async (request) => {
      const auth = requireAuth(request);
      const post = await visiblePost(request.params.id, auth);
      const blocked = await blockedIds(db, auth.userId);
      const rows = await db
        .col('comments')
        .find({
          $and: [
            { postId: post._id, status: 'published' },
            blocked.length ? { $or: [{ authorId: null }, { authorId: { $nin: blocked } }] } : {},
            newerThan('createdAt', decodeCursor(request.query.cursor)) as Filter<Comment>,
          ],
        })
        .sort({ createdAt: 1, _id: 1 })
        .limit(request.query.limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(r.createdAt, r._id));
      const anonIds = items.filter((c) => c.isAnonymous).map((c) => `comment:${c._id}`);
      const [people, mine] = await Promise.all([
        loadPeople(app.deps, items.filter((c) => !c.deletedAt).map((c) => c.authorId)),
        anonIds.length ? db.col('anonymous_authors').find({ _id: { $in: anonIds }, userId: auth.userId }, { projection: { contentId: 1 } }).toArray() : Promise.resolve([]),
      ]);
      const mineAnon = new Set(mine.map((m) => m.contentId));
      return {
        items: items.map((c) => ({
          id: c._id,
          parentId: c.parentId,
          // Deleted comments keep their place in a thread so replies still make sense.
          body: c.deletedAt ? null : c.body,
          deleted: Boolean(c.deletedAt),
          author: c.deletedAt || c.isAnonymous ? null : (people.get(c.authorId ?? '') ?? null),
          byOriginalPoster: c.isAnonymous,
          isMine: c.authorId === auth.userId || mineAnon.has(c._id),
          createdAt: c.createdAt.toISOString(),
        })),
        nextCursor,
      };
    },
  );

  app.post(
    '/posts/:id/comments',
    { config: limits.write, schema: { tags: ['feed'], summary: 'Comment on a post', params: idParam, body: z.object({ body: text(1, 2000), parentId: uuid.optional() }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const post = await visiblePost(request.params.id, auth);
      const body = cleanText(request.body.body);
      let parentAuthor: string | null = null;
      if (request.body.parentId) {
        const parent = await db.col('comments').findOne({ _id: request.body.parentId, postId: post._id, deletedAt: null }, { projection: { authorId: 1 } });
        if (!parent) throw Errors.validation([{ field: 'parentId', message: 'That comment is no longer there.' }]);
        parentAuthor = parent.authorId ?? (await db.col('anonymous_authors').findOne({ _id: `comment:${parent._id}` }))?.userId ?? null;
      }
      const owner = await postOwner(app.deps, post._id);
      // The author of an anonymous post stays anonymous when replying in its comments.
      const anonymous = post.isAnonymous && owner === auth.userId;
      const now = new Date();
      const comment: Comment = { _id: uuidv7(), postId: post._id, authorId: anonymous ? null : auth.userId, isAnonymous: anonymous, parentId: request.body.parentId ?? null, body, status: 'published', createdAt: now, updatedAt: now, deletedAt: null };
      await db.tx(async (session) => {
        if (anonymous) await db.col('anonymous_authors').insertOne({ _id: `comment:${comment._id}`, contentType: 'comment', contentId: comment._id, userId: auth.userId, createdAt: now }, { session });
        await db.col('comments').insertOne(comment, { session });
        await posts().updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } }, { session });
      });
      const who = anonymous ? 'The original poster' : auth.displayName;
      const recipients = new Set([owner, parentAuthor].filter((x): x is string => Boolean(x) && x !== auth.userId));
      await app.deps.notifier.send(
        [...recipients].map((userId) => ({
          userId,
          kind: userId === parentAuthor ? ('reply' as const) : ('comment' as const),
          title: userId === parentAuthor ? `${who} replied to your comment` : `${who} commented on your post`,
          body: body.slice(0, 140),
          link: `/post/${post._id}`,
          actorId: anonymous ? null : auth.userId,
          entityType: 'post',
          entityId: post._id,
        })),
      );
      if (!anonymous) await notifyMentions(app.deps, auth, body, `/post/${post._id}`, { type: 'comment', id: comment._id }, [...recipients]);
      const people = anonymous ? new Map() : await loadPeople(app.deps, [auth.userId]);
      return reply.status(201).send({
        id: comment._id,
        parentId: comment.parentId,
        body,
        deleted: false,
        author: anonymous ? null : (people.get(auth.userId) ?? null),
        byOriginalPoster: anonymous,
        isMine: true,
        createdAt: now.toISOString(),
      });
    },
  );

  app.delete('/comments/:id', { schema: { tags: ['feed'], summary: 'Delete a comment (author, post author or moderator)', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const c = await db.col('comments').findOne({ _id: request.params.id, deletedAt: null }, { projection: { postId: 1, authorId: 1 } });
    const post = c ? await posts().findOne({ _id: c.postId, collegeId: auth.collegeId }, { projection: { _id: 1 } }) : null;
    if (!c || !post) throw Errors.notFound('This comment');
    const author = c.authorId ?? (await db.col('anonymous_authors').findOne({ _id: `comment:${c._id}` }))?.userId ?? null;
    const postAuthor = await postOwner(app.deps, c.postId);
    if (author !== auth.userId && postAuthor !== auth.userId && !canModerate(auth)) throw Errors.notFound('This comment');
    const res = await db.col('comments').updateOne({ _id: c._id, deletedAt: null }, { $set: { deletedAt: new Date(), updatedAt: new Date() } });
    if (res.modifiedCount) await posts().updateOne({ _id: c.postId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
    return { status: 'deleted' };
  });
};
