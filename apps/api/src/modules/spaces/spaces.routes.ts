import type { FastifyPluginAsync } from 'fastify';
import type { ClientSession, Filter, Sort } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { canModerate, isStaff, requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, lowerThan, olderThan } from '../../core/query.js';
import { boolQuery, cleanText, idParam, optionalText, tags, tagsPatch, text, uuid } from '../../core/validation.js';
import { applyVote, myVotes } from '../../core/votes.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Discussion, DiscussionReply, Space, SpaceMember } from '../../infra/db/models.js';
import { limits } from '../../plugins/traffic.js';
import type { AuthContext } from '../../types/fastify.js';
import { blockedIds, loadPeople, personOf } from '../users/people.js';
import { memberKey, newMember } from '../chats/chats.service.js';

// /v1/spaces, /v1/discussions — communities and their discussion boards.
//
// Spaces: anyone can propose one; it is listed after a staff member approves it (staff-created
// spaces go live at once). Public spaces can be read and joined by anyone at the college;
// private spaces need the owner's or a space moderator's approval to join and are hidden from
// non-members. Class and department spaces can only be created by staff.

const KINDS = ['club', 'interest', 'department', 'exam', 'hostel', 'city', 'class'] as const;
const STAFF_KINDS = new Set(['department', 'class']);

type SpaceRole = SpaceMember['role'];
interface SpaceAccess {
  space: Space;
  id: string;
  slug: string;
  name: string;
  privacy: string;
  status: string;
  myRole: SpaceRole | null;
  myStatus: SpaceMember['status'] | null;
}

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'space';
}

const memberId = (spaceId: string, userId: string) => `${spaceId}:${userId}`;

export const spaceRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const spaces = () => db.col('spaces');
  const members = () => db.col('space_members');
  const discussions = () => db.col('discussions');
  const replies = () => db.col('discussion_replies');

  /** Keeps the member counter in step with active memberships. */
  const countMembers = (spaceId: string, delta: number, session?: ClientSession) =>
    delta ? spaces().updateOne({ _id: spaceId }, { $inc: { membersCount: delta } }, { session }) : Promise.resolve();

  async function access(auth: AuthContext, idOrSlug: string): Promise<SpaceAccess> {
    const byId = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const space = await spaces().findOne({ ...(byId ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() }), collegeId: auth.collegeId, status: { $ne: 'removed' } });
    if (!space) throw Errors.notFound('This space');
    const m = await members().findOne({ _id: memberId(space._id, auth.userId) });
    const member = m?.status === 'active';
    // Pending spaces are visible to their creator and staff; private ones to members and staff.
    if (space.status === 'pending' && !member && !isStaff(auth)) throw Errors.notFound('This space');
    const row: SpaceAccess = { space, id: space._id, slug: space.slug, name: space.name, privacy: space.privacy, status: space.status, myRole: m?.role ?? null, myStatus: m?.status ?? null };
    // Non-members may still see that a private space exists, to ask to join, but nothing inside.
    if (space.privacy === 'private' && !member && !isStaff(auth)) return { ...row, myRole: null };
    return row;
  }

  function canRead(auth: AuthContext, s: SpaceAccess): boolean {
    return s.privacy === 'public' || s.myStatus === 'active' || isStaff(auth);
  }
  function canManage(auth: AuthContext, s: SpaceAccess): boolean {
    return (s.myStatus === 'active' && (s.myRole === 'owner' || s.myRole === 'moderator')) || canModerate(auth);
  }

  // ---------------------------------------------------------------- spaces
  app.get(
    '/spaces',
    {
      schema: {
        tags: ['spaces'],
        summary: 'Browse spaces',
        querystring: pageQuery.extend({ q: z.string().trim().max(60).optional(), kind: z.enum(KINDS).optional(), mine: boolQuery }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, q, kind, mine } = request.query;
      const filter: Filter<Space> = { collegeId: auth.collegeId, status: 'active' };
      if (q) filter.$or = [{ name: contains(q) }, { tags: q.toLowerCase() }, { description: contains(q) }];
      if (kind) filter.kind = kind;
      if (mine) {
        const my = await members().find({ userId: auth.userId, status: 'active' }, { projection: { spaceId: 1 } }).toArray();
        filter._id = { $in: my.map((m) => m.spaceId) };
      }
      const rows = await spaces()
        .find({ $and: [filter, lowerThan('membersCount', decodeCursor(cursor)) as Filter<Space>] })
        .sort({ membersCount: -1, _id: -1 })
        .limit(limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.membersCount, r._id));
      const mem = await members().find({ _id: { $in: items.map((s) => memberId(s._id, auth.userId)) } }).toArray();
      const memBy = new Map(mem.map((m) => [m.spaceId, m]));
      return {
        items: items.map((s) => {
          const m = memBy.get(s._id);
          return { id: s._id, slug: s.slug, name: s.name, kind: s.kind, privacy: s.privacy, description: s.description, tags: s.tags, membersCount: s.membersCount, membership: m ? { role: m.role, status: m.status } : null };
        }),
        nextCursor,
      };
    },
  );

  app.post(
    '/spaces',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 day' } },
      schema: {
        tags: ['spaces'],
        summary: 'Create a space (live at once)',
        body: z.object({
          name: text(2, 80),
          slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,48}$/).optional(),
          kind: z.enum(KINDS),
          privacy: z.enum(['public', 'private']).default('public'),
          description: optionalText(600),
          tags,
        }),
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request);
      const b = request.body;
      if (STAFF_KINDS.has(b.kind) && !isStaff(auth)) throw Errors.forbidden('Only faculty and admins can create class or department spaces.');
      let slug = b.slug ?? slugify(b.name);
      if (slug.length < 2) slug = `${slug}-space`;
      const taken = await spaces().findOne({ collegeId: auth.collegeId, slug }, { projection: { _id: 1 } });
      if (taken) {
        if (b.slug) throw Errors.validation([{ field: 'slug', message: 'That address is taken.' }]);
        slug = `${slug.slice(0, 40)}-${Math.floor(100 + Math.random() * 900)}`;
      }
      // Anyone can start a space and it is live at once (class and department spaces stay staff-only).
      const now = new Date();
      const id = uuidv7();
      await db.tx(async (session) => {
        await spaces().insertOne(
          { _id: id, collegeId: auth.collegeId, slug, name: cleanText(b.name), kind: b.kind, privacy: b.privacy, description: cleanText(b.description ?? ''), tags: b.tags, avatarFileId: null, membersCount: 1, status: 'active', createdBy: auth.userId, createdAt: now, updatedAt: now },
          { session },
        );
        await members().insertOne({ _id: memberId(id, auth.userId), spaceId: id, userId: auth.userId, role: 'owner', status: 'active', joinedAt: now }, { session });
        await audit(db, { action: 'space.create', actorId: auth.userId, collegeId: auth.collegeId, entityType: 'space', entityId: id, requestId: request.id }, session);
      });
      return reply.status(201).send({
        id,
        slug,
        status: 'active',
        message: 'Your space is live.',
      });
    },
  );

  app.get('/spaces/:id', { schema: { tags: ['spaces'], summary: 'A space, by slug or id', params: z.object({ id: z.string().min(2).max(64) }) } }, async (request) => {
    const auth = requireAuth(request);
    const s = await access(auth, request.params.id);
    const readable = canRead(auth, s);
    // Space channels are chats that belong to the space.
    const channels = readable
      ? await db.col('chats').find({ spaceId: s.id, kind: 'channel' }, { projection: { title: 1, description: 1, onlyAdminsPost: 1 } }).sort({ createdAt: 1 }).limit(30).toArray()
      : [];
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      kind: s.space.kind,
      privacy: s.privacy,
      status: s.status,
      description: s.space.description,
      tags: s.space.tags,
      membersCount: s.space.membersCount,
      createdAt: s.space.createdAt.toISOString(),
      membership: s.myStatus ? { role: s.myRole, status: s.myStatus } : null,
      canRead: readable,
      canManage: canManage(auth, s),
      channels: channels.map((c) => ({ id: c._id, chatId: c._id, name: c.title ?? 'general', topic: c.description ?? '', kind: c.onlyAdminsPost ? 'announcements' : 'text' })),
    };
  });

  app.patch(
    '/spaces/:id',
    {
      schema: {
        tags: ['spaces'],
        summary: 'Edit a space (owner, space moderators, staff)',
        params: idParam,
        body: z.object({ name: text(2, 80).optional(), description: optionalText(600), privacy: z.enum(['public', 'private']).optional(), tags: tagsPatch }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const s = await access(auth, request.params.id);
      if (!canManage(auth, s)) throw Errors.forbidden();
      const b = request.body;
      const set: Partial<Space> = { updatedAt: new Date() };
      if (b.name) set.name = cleanText(b.name);
      if (b.description !== undefined) set.description = cleanText(b.description);
      if (b.privacy) set.privacy = b.privacy;
      if (b.tags) set.tags = b.tags;
      await spaces().updateOne({ _id: s.id }, { $set: set });
      return { status: 'saved' };
    },
  );

  // Spaces work like WhatsApp communities: each one has a group chat for its members, created the
  // first time someone opens it. Members join the chat when they open it; leaving the space
  // leaves the chat. Space owners and moderators are the chat's admins.
  app.post('/spaces/:id/chat', { config: limits.write, schema: { tags: ['spaces'], summary: 'Open (or start) the space group chat', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const s = await access(auth, request.params.id);
    if (s.myStatus !== 'active') throw Errors.forbidden('Join the space to use its group chat.');
    if (s.status !== 'active') throw Errors.conflict('This space is not open yet.');
    const chats = db.col('chats');
    const now = new Date();
    let chat = await chats.findOne({ spaceId: s.id, kind: 'community' });
    if (!chat) {
      const id = uuidv7();
      try {
        await chats.insertOne({ _id: id, collegeId: auth.collegeId, kind: 'community', title: s.name, description: s.space.description || null, createdBy: auth.userId, directKey: null, spaceId: s.id, eventId: null, onlyAdminsPost: false, disappearingSeconds: null, lastMessageAt: now, createdAt: now, updatedAt: now });
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
      }
      chat = await chats.findOne({ spaceId: s.id, kind: 'community' });
      if (!chat) throw Errors.unavailable('chats');
    }
    const role = s.myRole === 'owner' ? (chat.createdBy === auth.userId ? 'owner' : 'admin') : s.myRole === 'moderator' ? 'admin' : 'member';
    await db.col('chat_members').updateOne({ _id: memberKey(chat._id, auth.userId) }, { $setOnInsert: newMember(chat._id, auth.userId, role) }, { upsert: true });
    return { chatId: chat._id };
  });

  // Spaces worth joining: shared interests, people you follow, your department, and what is
  // active at your college. Each suggestion says why it is suggested.
  app.get('/spaces/suggested', { schema: { tags: ['spaces'], summary: 'Spaces suggested for me', querystring: z.object({ limit: z.coerce.number().int().min(1).max(20).default(8) }) } }, async (request) => {
    const auth = requireAuth(request);
    const [me, mine, follows] = await Promise.all([
      db.col('users').findOne({ _id: auth.userId }, { projection: { 'profile.interests': 1, 'profile.skills': 1, 'profile.departmentId': 1 } }),
      members().find({ userId: auth.userId }, { projection: { spaceId: 1 } }).toArray(),
      db.col('follows').find({ followerId: auth.userId }, { projection: { followeeId: 1 } }).limit(2000).toArray(),
    ]);
    const joined = mine.map((m) => m.spaceId);
    const candidates = await spaces()
      .find({ collegeId: auth.collegeId, status: 'active', _id: { $nin: joined } })
      .sort({ membersCount: -1 })
      .limit(200)
      .toArray();
    if (!candidates.length) return { items: [] };
    const ids = candidates.map((c) => c._id);
    const followIds = follows.map((f) => f.followeeId);
    const [friendRows, activeRows] = await Promise.all([
      followIds.length
        ? members().aggregate<{ _id: string; n: number }>([{ $match: { spaceId: { $in: ids }, userId: { $in: followIds }, status: 'active' } }, { $group: { _id: '$spaceId', n: { $sum: 1 } } }]).toArray()
        : Promise.resolve([]),
      discussions().aggregate<{ _id: string; n: number }>([{ $match: { spaceId: { $in: ids }, createdAt: { $gt: new Date(Date.now() - 14 * 86_400_000) } } }, { $group: { _id: '$spaceId', n: { $sum: 1 } } }]).toArray(),
    ]);
    const friends = new Map(friendRows.map((r) => [r._id, r.n]));
    const active = new Map(activeRows.map((r) => [r._id, r.n]));
    const words = new Set([...(me?.profile?.interests ?? []), ...(me?.profile?.skills ?? [])].map((w) => String(w).toLowerCase().replace(/\s+/g, '-')));
    const scored = candidates.map((c) => {
      const shared = c.tags.filter((t) => words.has(t) || [...words].some((w) => w.length > 2 && (t.includes(w) || w.includes(t))));
      const f = friends.get(c._id) ?? 0;
      const a = active.get(c._id) ?? 0;
      const score = Math.min(f, 5) * 3 + shared.length * 4 + Math.min(a, 10) * 0.5 + Math.log10(c.membersCount + 1);
      const reason = f ? `${f} ${f === 1 ? 'person' : 'people'} you follow ${f === 1 ? 'is' : 'are'} here` : shared.length ? `Matches your interests: ${shared.slice(0, 2).join(', ')}` : a ? `${a} new discussion${a === 1 ? '' : 's'} this fortnight` : `Popular at your college`;
      return { c, score, reason };
    });
    scored.sort((x, y) => y.score - x.score);
    return {
      items: scored.slice(0, request.query.limit).map(({ c, reason }) => ({ id: c._id, slug: c.slug, name: c.name, kind: c.kind, privacy: c.privacy, description: c.description, tags: c.tags, membersCount: c.membersCount, membership: null, reason })),
    };
  });

  app.post('/spaces/:id/join', { config: limits.write, schema: { tags: ['spaces'], summary: 'Join (or ask to join a private space)', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const s = await access(auth, request.params.id);
    if (s.status !== 'active') throw Errors.conflict('This space is not open yet.');
    if (s.myStatus === 'banned') throw Errors.forbidden('You cannot join this space.');
    if (s.myStatus === 'active') return { status: 'active' };
    const status = s.privacy === 'private' ? 'pending' : 'active';
    const before = await members().findOneAndUpdate(
      { _id: memberId(s.id, auth.userId), status: { $ne: 'banned' } },
      { $set: { status, joinedAt: new Date() }, $setOnInsert: { spaceId: s.id, userId: auth.userId, role: 'member' } },
      { upsert: true, returnDocument: 'before' },
    );
    if (status === 'active' && before?.status !== 'active') await countMembers(s.id, 1);
    if (status === 'pending') {
      const managers = await members().find({ spaceId: s.id, role: { $in: ['owner', 'moderator'] }, status: 'active' }, { projection: { userId: 1 } }).toArray();
      await app.deps.notifier.send(
        managers.map((m) => ({ userId: m.userId, kind: 'space' as const, title: `${auth.displayName} asked to join ${s.name}`, link: `/spaces/${s.slug}`, actorId: auth.userId, entityType: 'space', entityId: s.id })),
      );
    }
    return { status };
  });

  app.delete('/spaces/:id/membership', { schema: { tags: ['spaces'], summary: 'Leave a space', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const s = await access(auth, request.params.id);
    if (s.myRole === 'owner') {
      const owners = await members().countDocuments({ spaceId: s.id, role: 'owner', status: 'active' });
      if (owners <= 1) throw Errors.conflict('Make someone else an owner before you leave.');
    }
    const removed = await members().findOneAndDelete({ _id: memberId(s.id, auth.userId), status: { $ne: 'banned' } });
    if (removed?.status === 'active') await countMembers(s.id, -1);
    // Leaving the space also leaves its group chat.
    const spaceChat = await db.col('chats').findOne({ spaceId: s.id, kind: 'community' }, { projection: { _id: 1 } });
    if (spaceChat) await db.col('chat_members').deleteOne({ _id: memberKey(spaceChat._id, auth.userId) });
    return { status: 'left' };
  });

  app.get(
    '/spaces/:id/members',
    { schema: { tags: ['spaces'], summary: 'Members (pending requests for managers)', params: idParam, querystring: pageQuery.extend({ status: z.enum(['active', 'pending', 'banned']).default('active') }) } },
    async (request) => {
      const auth = requireAuth(request);
      const s = await access(auth, request.params.id);
      if (!canRead(auth, s)) throw Errors.forbidden('Join this space to see its members.');
      if (request.query.status !== 'active' && !canManage(auth, s)) throw Errors.forbidden();
      const after = decodeCursor(request.query.cursor);
      const rows = await members()
        .find({
          spaceId: s.id,
          status: request.query.status,
          ...(after ? { $or: [{ joinedAt: { $gt: new Date(after.at) } }, { joinedAt: new Date(after.at), userId: { $gt: after.id } }] } : {}),
        })
        .sort({ joinedAt: 1, userId: 1 })
        .limit(request.query.limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(r.joinedAt, r.userId));
      const people = await loadPeople(app.deps, items.map((m) => m.userId));
      return {
        items: items.filter((m) => people.has(m.userId)).map((m) => ({ ...people.get(m.userId)!, spaceRole: m.role, status: m.status, joinedAt: m.joinedAt.toISOString() })),
        nextCursor,
      };
    },
  );

  app.post(
    '/spaces/:id/members/:userId',
    {
      schema: {
        tags: ['spaces'],
        summary: 'Manage a member: approve, decline, remove, ban, unban, promote, demote',
        params: z.object({ id: uuid, userId: uuid }),
        body: z.object({ action: z.enum(['approve', 'decline', 'remove', 'ban', 'unban', 'make_moderator', 'make_member', 'make_owner']) }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const s = await access(auth, request.params.id);
      if (!canManage(auth, s)) throw Errors.forbidden();
      const { userId } = request.params;
      const { action } = request.body;
      if (userId === auth.userId && action !== 'make_owner') throw Errors.badRequest('Use "leave" to change your own membership.');
      const id = memberId(s.id, userId);
      const target = await members().findOne({ _id: id });
      if (!target && action !== 'ban') throw Errors.notFound('This member');
      if (target?.role === 'owner' && s.myRole !== 'owner' && !canModerate(auth)) throw Errors.forbidden('Only an owner can change another owner.');
      if ((action === 'make_owner' || action === 'make_moderator') && s.myRole !== 'owner' && !canModerate(auth)) throw Errors.forbidden('Only an owner can do that.');
      const wasActive = target?.status === 'active';
      await db.tx(async (session) => {
        switch (action) {
          case 'approve': {
            const res = await members().updateOne({ _id: id, status: 'pending' }, { $set: { status: 'active', joinedAt: new Date() } }, { session });
            if (res.modifiedCount) await countMembers(s.id, 1, session);
            break;
          }
          case 'decline':
          case 'remove':
            await members().deleteOne({ _id: id }, { session });
            if (wasActive) await countMembers(s.id, -1, session);
            break;
          case 'ban':
            await members().updateOne(
              { _id: id },
              { $set: { status: 'banned', role: 'member' }, $setOnInsert: { spaceId: s.id, userId, joinedAt: new Date() } },
              { upsert: true, session },
            );
            if (wasActive) await countMembers(s.id, -1, session);
            break;
          case 'unban':
            await members().deleteOne({ _id: id, status: 'banned' }, { session });
            break;
          case 'make_moderator':
          case 'make_member':
          case 'make_owner':
            await members().updateOne({ _id: id, status: 'active' }, { $set: { role: action.slice(5) as SpaceRole } }, { session });
            break;
        }
        await audit(db, { action: `space.member_${action}`, actorId: auth.userId, collegeId: auth.collegeId, entityType: 'space', entityId: s.id, requestId: request.id, meta: { userId } }, session);
      });
      if (action === 'approve') {
        await app.deps.notifier.send({ userId, kind: 'space', title: `You joined ${s.name}`, body: 'Your request was approved.', link: `/spaces/${s.slug}`, actorId: auth.userId, entityType: 'space', entityId: s.id });
      }
      return { status: 'done' };
    },
  );

  // ---------------------------------------------------------------- discussions across spaces
  app.get(
    '/discussions',
    {
      schema: {
        tags: ['spaces'],
        summary: 'Discussions from spaces I can read (my spaces first), for Home and Boards',
        querystring: z.object({ sort: z.enum(['top', 'new']).default('top'), mine: boolQuery, flair: z.string().trim().max(24).optional(), limit: z.coerce.number().int().min(1).max(30).default(10) }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { sort, mine, flair, limit } = request.query;
      const [my, blocked] = await Promise.all([members().find({ userId: auth.userId, status: 'active' }, { projection: { spaceId: 1 } }).toArray(), blockedIds(db, auth.userId)]);
      const mySpaceIds = my.map((m) => m.spaceId);
      const publicSpaces = mine ? [] : await spaces().find({ collegeId: auth.collegeId, status: 'active', privacy: 'public', _id: { $nin: mySpaceIds } }, { projection: { _id: 1 } }).limit(2000).toArray();
      const activeMine = (await spaces().find({ _id: { $in: mySpaceIds }, status: 'active' }, { projection: { _id: 1 } }).toArray()).map((x) => x._id);
      const base: Filter<Discussion> = {
        collegeId: auth.collegeId,
        status: 'published',
        deletedAt: null,
        createdAt: { $gt: new Date(Date.now() - 60 * 86_400_000) },
        ...(flair ? { flair } : {}),
        ...(blocked.length ? { authorId: { $nin: blocked } } : {}),
      };
      const order: Sort = sort === 'top' ? { score: -1, lastActivityAt: -1 } : { createdAt: -1 };
      let rows: Discussion[];
      if (sort === 'top') {
        // Discussions from my spaces first, then the rest of the college's public spaces.
        rows = await discussions().find({ ...base, spaceId: { $in: activeMine } }).sort(order).limit(limit).toArray();
        if (rows.length < limit && publicSpaces.length) {
          rows = rows.concat(await discussions().find({ ...base, spaceId: { $in: publicSpaces.map((p) => p._id) } }).sort(order).limit(limit - rows.length).toArray());
        }
      } else {
        rows = await discussions().find({ ...base, spaceId: { $in: [...activeMine, ...publicSpaces.map((p) => p._id)] } }).sort(order).limit(limit).toArray();
      }
      const [people, spaceRows] = await Promise.all([
        loadPeople(app.deps, rows.map((r) => r.authorId)),
        spaces().find({ _id: { $in: [...new Set(rows.map((r) => r.spaceId))] } }, { projection: { slug: 1, name: 1 } }).toArray(),
      ]);
      const spaceBy = new Map(spaceRows.map((x) => [x._id, x]));
      const mySet = new Set(mySpaceIds);
      return {
        items: rows.map((r) => ({
          id: r._id,
          title: r.title,
          excerpt: r.body.slice(0, 200),
          flair: r.flair,
          score: r.score,
          commentsCount: r.repliesCount,
          space: { slug: spaceBy.get(r.spaceId)?.slug ?? '', name: spaceBy.get(r.spaceId)?.name ?? '', member: mySet.has(r.spaceId) },
          author: personOf(people, r.authorId),
          createdAt: r.createdAt.toISOString(),
          lastActivityAt: r.lastActivityAt.toISOString(),
        })),
      };
    },
  );

  // ---------------------------------------------------------------- discussions in a space
  const sortEnum = z.enum(['new', 'top', 'active']).default('new');
  app.get(
    '/spaces/:id/discussions',
    { schema: { tags: ['spaces'], summary: 'Discussions in a space', params: idParam, querystring: pageQuery.extend({ sort: sortEnum, flair: z.string().max(24).optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const s = await access(auth, request.params.id);
      if (!canRead(auth, s)) throw Errors.forbidden('Join this space to read its board.');
      const { cursor, limit, sort, flair } = request.query;
      const blocked = await blockedIds(db, auth.userId);
      const field = ({ new: 'createdAt', top: 'score', active: 'lastActivityAt' } as const)[sort];
      const base: Filter<Discussion> = { spaceId: s.id, status: 'published', deletedAt: null, ...(flair ? { flair } : {}), ...(blocked.length ? { authorId: { $nin: blocked } } : {}) };
      const after = decodeCursor(cursor);
      const keyset = (sort === 'top' ? lowerThan(field, after) : olderThan(field, after)) as Filter<Discussion>;
      // Pinned discussions lead the first page; later pages hold only the rest.
      const pinned = cursor ? [] : await discussions().find({ ...base, isPinned: true }).sort({ [field]: -1, _id: -1 }).limit(5).toArray();
      const rows = await discussions().find({ $and: [{ ...base, isPinned: { $ne: true } }, keyset] }).sort({ [field]: -1, _id: -1 }).limit(limit + 1).toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(sort === 'top' ? r.score : r[field as 'createdAt' | 'lastActivityAt'], r._id));
      const all = [...pinned, ...items];
      const [votes, people] = await Promise.all([myVotes(db, auth.userId, 'discussion', all.map((r) => r._id)), loadPeople(app.deps, all.map((r) => r.authorId))]);
      return {
        items: all.map((r) => ({
          id: r._id,
          title: r.title,
          excerpt: r.body.slice(0, 280),
          flair: r.flair,
          pinned: r.isPinned,
          locked: r.isLocked,
          score: r.score,
          myVote: votes.get(r._id) ?? 0,
          commentsCount: r.repliesCount,
          author: personOf(people, r.authorId),
          lastActivityAt: r.lastActivityAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
        })),
        nextCursor,
      };
    },
  );

  app.post(
    '/spaces/:id/discussions',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } }, schema: { tags: ['spaces'], summary: 'Start a discussion', params: idParam, body: z.object({ title: text(5, 200), body: optionalText(10000), flair: z.string().trim().min(1).max(24).default('Discussion') }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const s = await access(auth, request.params.id);
      if (s.myStatus !== 'active') throw Errors.forbidden('Join the space to post on its board.');
      if (s.status !== 'active') throw Errors.conflict('This space is not open yet.');
      const now = new Date();
      const id = uuidv7();
      await discussions().insertOne({
        _id: id,
        collegeId: auth.collegeId,
        spaceId: s.id,
        authorId: auth.userId,
        title: cleanText(request.body.title),
        body: cleanText(request.body.body ?? ''),
        flair: request.body.flair,
        isPinned: false,
        isLocked: false,
        score: 0,
        repliesCount: 0,
        status: 'published',
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      return reply.status(201).send({ id });
    },
  );

  async function discussionAccess(auth: AuthContext, discussionId: string) {
    const t = await discussions().findOne({ _id: discussionId, collegeId: auth.collegeId, deletedAt: null, status: 'published' });
    if (!t) throw Errors.notFound('This discussion');
    const s = await access(auth, t.spaceId);
    if (!canRead(auth, s)) throw Errors.notFound('This discussion');
    return { t, s };
  }

  app.get('/discussions/:id', { schema: { tags: ['spaces'], summary: 'A discussion', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const { t, s } = await discussionAccess(auth, request.params.id);
    const [votes, people] = await Promise.all([myVotes(db, auth.userId, 'discussion', [t._id]), loadPeople(app.deps, [t.authorId])]);
    return {
      id: t._id,
      space: { id: s.id, slug: s.slug, name: s.name },
      title: t.title,
      body: t.body,
      flair: t.flair,
      pinned: t.isPinned,
      locked: t.isLocked,
      score: t.score,
      myVote: votes.get(t._id) ?? 0,
      commentsCount: t.repliesCount,
      author: personOf(people, t.authorId),
      isMine: t.authorId === auth.userId,
      canManage: canManage(auth, s),
      createdAt: t.createdAt.toISOString(),
    };
  });

  app.patch(
    '/discussions/:id',
    { schema: { tags: ['spaces'], summary: 'Edit, pin or lock a discussion', params: idParam, body: z.object({ title: text(5, 200).optional(), body: optionalText(10000), flair: z.string().trim().min(1).max(24).optional(), pinned: z.boolean().optional(), locked: z.boolean().optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { t, s } = await discussionAccess(auth, request.params.id);
      const b = request.body;
      const mine = t.authorId === auth.userId;
      const manage = canManage(auth, s);
      if ((b.pinned !== undefined || b.locked !== undefined) && !manage) throw Errors.forbidden('Only space moderators can pin or lock.');
      if ((b.title !== undefined || b.body !== undefined || b.flair !== undefined) && !mine) throw Errors.forbidden('Only the author can edit this discussion.');
      const set: Partial<Discussion> = { updatedAt: new Date() };
      if (b.title) set.title = cleanText(b.title);
      if (b.body !== undefined) set.body = cleanText(b.body);
      if (b.flair) set.flair = b.flair;
      if (b.pinned !== undefined) set.isPinned = b.pinned;
      if (b.locked !== undefined) set.isLocked = b.locked;
      await discussions().updateOne({ _id: t._id }, { $set: set });
      return { status: 'saved' };
    },
  );

  app.delete('/discussions/:id', { schema: { tags: ['spaces'], summary: 'Delete a discussion', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const { t, s } = await discussionAccess(auth, request.params.id);
    if (t.authorId !== auth.userId && !canManage(auth, s)) throw Errors.forbidden();
    await discussions().updateOne({ _id: t._id }, { $set: { deletedAt: new Date(), updatedAt: new Date() } });
    return { status: 'deleted' };
  });

  const voteBody = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });
  app.put('/discussions/:id/vote', { config: limits.write, schema: { tags: ['spaces'], summary: 'Vote on a discussion (-1, 0, 1)', params: idParam, body: voteBody } }, async (request) => {
    const auth = requireAuth(request);
    const { t } = await discussionAccess(auth, request.params.id);
    const score = await applyVote(db, auth.userId, 'discussion', t._id, request.body.value);
    return { score, myVote: request.body.value };
  });

  app.get('/discussions/:id/replies', { schema: { tags: ['spaces'], summary: 'All replies in a discussion (flat, with parent ids)', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const { t } = await discussionAccess(auth, request.params.id);
    const blocked = await blockedIds(db, auth.userId);
    const rows = await replies()
      .find({ discussionId: t._id, status: 'published', ...(blocked.length ? { authorId: { $nin: blocked } } : {}) })
      .sort({ createdAt: 1, _id: 1 })
      .limit(1000)
      .toArray();
    const [votes, people] = await Promise.all([myVotes(db, auth.userId, 'discussion_reply', rows.map((r) => r._id)), loadPeople(app.deps, rows.filter((r) => !r.deletedAt).map((r) => r.authorId))]);
    return {
      items: rows.map((r) => ({
        id: r._id,
        parentId: r.parentId,
        depth: r.depth,
        body: r.deletedAt ? null : r.body,
        deleted: Boolean(r.deletedAt),
        score: r.score,
        myVote: votes.get(r._id) ?? 0,
        author: r.deletedAt ? null : personOf(people, r.authorId),
        isMine: r.authorId === auth.userId,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.post(
    '/discussions/:id/replies',
    { config: limits.write, schema: { tags: ['spaces'], summary: 'Reply in a discussion', params: idParam, body: z.object({ body: text(1, 5000), parentId: uuid.optional() }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const { t, s } = await discussionAccess(auth, request.params.id);
      if (t.isLocked && !canManage(auth, s)) throw Errors.conflict('This discussion is locked.');
      if (s.privacy === 'private' && s.myStatus !== 'active') throw Errors.forbidden('Join the space to reply.');
      let depth = 0;
      let parentAuthor: string | null = null;
      if (request.body.parentId) {
        const parent = await replies().findOne({ _id: request.body.parentId, discussionId: t._id, deletedAt: null }, { projection: { depth: 1, authorId: 1 } });
        if (!parent) throw Errors.validation([{ field: 'parentId', message: 'That reply is no longer there.' }]);
        depth = Math.min(parent.depth + 1, 8);
        parentAuthor = parent.authorId;
      }
      const body = cleanText(request.body.body);
      const now = new Date();
      const row: DiscussionReply = { _id: uuidv7(), discussionId: t._id, parentId: request.body.parentId ?? null, authorId: auth.userId, body, depth, score: 0, status: 'published', createdAt: now, updatedAt: now, deletedAt: null };
      await db.tx(async (session) => {
        await replies().insertOne(row, { session });
        await discussions().updateOne({ _id: t._id }, { $inc: { repliesCount: 1 }, $set: { lastActivityAt: now } }, { session });
      });
      const recipients = new Set([t.authorId, parentAuthor].filter((x): x is string => Boolean(x) && x !== auth.userId));
      await app.deps.notifier.send(
        [...recipients].map((userId) => ({
          userId,
          kind: userId === parentAuthor ? ('reply' as const) : ('comment' as const),
          title: userId === parentAuthor ? `${auth.displayName} replied to you` : `${auth.displayName} replied to "${t.title.slice(0, 60)}"`,
          body: body.slice(0, 140),
          link: `/spaces/${s.slug}/t/${t._id}`,
          actorId: auth.userId,
          entityType: 'discussion',
          entityId: t._id,
        })),
      );
      return reply.status(201).send({ id: row._id, depth });
    },
  );

  app.put('/discussion-replies/:id/vote', { config: limits.write, schema: { tags: ['spaces'], summary: 'Vote on a reply', params: idParam, body: voteBody } }, async (request) => {
    const auth = requireAuth(request);
    const c = await replies().findOne({ _id: request.params.id, deletedAt: null }, { projection: { discussionId: 1 } });
    if (!c) throw Errors.notFound('This reply');
    await discussionAccess(auth, c.discussionId);
    const score = await applyVote(db, auth.userId, 'discussion_reply', request.params.id, request.body.value);
    return { score, myVote: request.body.value };
  });

  app.delete('/discussion-replies/:id', { schema: { tags: ['spaces'], summary: 'Delete a reply', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const c = await replies().findOne({ _id: request.params.id, deletedAt: null }, { projection: { discussionId: 1, authorId: 1 } });
    if (!c) throw Errors.notFound('This reply');
    const { s } = await discussionAccess(auth, c.discussionId);
    if (c.authorId !== auth.userId && !canManage(auth, s)) throw Errors.forbidden();
    const res = await replies().updateOne({ _id: c._id, deletedAt: null }, { $set: { deletedAt: new Date(), updatedAt: new Date() } });
    if (res.modifiedCount) await discussions().updateOne({ _id: c.discussionId, repliesCount: { $gt: 0 } }, { $inc: { repliesCount: -1 } });
    return { status: 'deleted' };
  });
};
