import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors } from '../../core/errors.js';
import { requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor } from '../../core/pagination.js';
import { cleanText, idParam, optionalText, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Chat, ChatMember, Message } from '../../infra/db/models.js';
import { fileView } from '../files/files.service.js';
import { blockedIds, isBlockedBetween, loadPeople, personOf } from '../users/people.js';
import { memberKey, newMember, openDirectChat, otherInDirect, postSystemMessage, requireMember, toMessageViews, type ChatMembership } from './chats.service.js';

// /v1/chats, /v1/messages — conversations.
//
// Sending is idempotent: the client sends a clientId with each message, and a retry after a
// dropped connection returns the original message instead of posting it twice (a unique index
// on chat + sender + clientId guarantees it). Unread counts come from one read pointer per
// member, not one document per message. Disappearing chats hide messages older than their
// timer (a cleanup job removes them for good).

const KINDS = ['text', 'image', 'file', 'voice', 'video', 'poll', 'plan', 'question', 'sticker', 'snap'] as const;
const FILE_KINDS: Record<string, string[]> = { image: ['image'], file: ['document', 'archive', 'image', 'video', 'audio'], voice: ['audio'], video: ['video'], snap: ['image', 'video'] };
const EDIT_WINDOW_MS = 15 * 60_000;
const ROLE_RANK: Record<ChatMember['role'], number> = { owner: 0, admin: 1, member: 2 };

const sendBody = z
  .object({
    clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    kind: z.enum(KINDS).default('text'),
    body: z.string().max(4000).optional(),
    replyToId: uuid.optional(),
    fileId: uuid.optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => (FILE_KINDS[b.kind] ? Boolean(b.fileId) : true), { message: 'Attach the file for this message.', path: ['fileId'] })
  .refine((b) => (['text', 'question'].includes(b.kind) ? Boolean(b.body?.trim()) : true), { message: 'Write a message.', path: ['body'] });

// Structured payloads are validated per kind; anything else is dropped.
const pollPayload = z.object({ question: text(1, 200), options: z.array(text(1, 80)).min(2).max(8), multiple: z.boolean().default(false) });
const planPayload = z.object({ title: text(1, 120), when: z.iso.datetime().optional(), place: optionalText(120) });
const stickerPayload = z.object({ sticker: z.string().regex(/^[a-z0-9_-]{1,40}$/) });

function cleanPayload(kind: string, payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (kind === 'poll') return pollPayload.parse(payload ?? {});
  if (kind === 'plan') return planPayload.parse(payload ?? {});
  if (kind === 'sticker') return stickerPayload.parse(payload ?? {});
  return {};
}

export const chatRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db, realtime } = app.deps;
  const chats = () => db.col('chats');
  const members = () => db.col('chat_members');
  const messages = () => db.col('messages');

  // The realtime hub asks this before letting a socket subscribe to a chat.
  realtime.setMembershipCheck(async (userId, chatId) => Boolean(await db.col('chat_members').findOne({ _id: memberKey(chatId, userId) }, { projection: { _id: 1 } })));

  /** People who may be added to a chat by this person: same college, active, open to messages, no blocks. */
  async function addable(auth: { userId: string; collegeId: string }, ids: string[]): Promise<string[]> {
    const blocked = await blockedIds(db, auth.userId);
    const rows = await db
      .col('users')
      .find({ _id: { $in: ids, $nin: blocked }, collegeId: auth.collegeId, status: 'active', 'profile.messagePrivacy': { $ne: 'nobody' } }, { projection: { _id: 1 } })
      .toArray();
    return rows.map((r) => r._id);
  }

  async function addMembers(chatId: string, userIds: string[]): Promise<number> {
    if (!userIds.length) return 0;
    const res = await members().bulkWrite(
      userIds.map((userId) => ({ updateOne: { filter: { _id: memberKey(chatId, userId) }, update: { $setOnInsert: newMember(chatId, userId) }, upsert: true } })),
      { ordered: false },
    );
    return res.upsertedCount;
  }

  // ---------------------------------------------------------------- chat list
  app.get(
    '/chats',
    { schema: { tags: ['chats'], summary: 'My chats, pinned first then most recent', querystring: z.object({ filter: z.enum(['all', 'unread', 'direct', 'groups', 'archived']).default('all'), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().max(200).optional(), q: z.string().trim().max(60).optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { filter, limit, cursor, q } = request.query;
      const after = decodeCursor(cursor);
      const mine = await members()
        .find({ userId: auth.userId, archivedAt: filter === 'archived' ? { $ne: null } : null })
        .limit(1000)
        .toArray();
      const memberBy = new Map(mine.map((m) => [m.chatId, m]));
      const [chatRows, blocked] = await Promise.all([
        chats().find({ _id: { $in: mine.map((m) => m.chatId) }, ...(filter === 'direct' ? { kind: 'direct' as const } : filter === 'groups' ? { kind: { $ne: 'direct' as const } } : {}) }).toArray(),
        blockedIds(db, auth.userId),
      ]);
      const blockedSet = new Set(blocked);
      const activity = (c: Chat) => c.lastMessageAt ?? c.createdAt;
      const others = new Map(chatRows.filter((c) => c.kind === 'direct').map((c) => [c._id, otherInDirect(c, auth.userId)]));
      const people = await loadPeople(app.deps, [...others.values()]);
      const needle = q?.toLowerCase();
      let list = chatRows
        .filter((c) => c.kind !== 'direct' || !blockedSet.has(others.get(c._id) ?? ''))
        .filter((c) => !needle || (c.kind === 'direct' ? personOf(people, others.get(c._id)).displayName : (c.title ?? '')).toLowerCase().includes(needle))
        .sort((a, b) => {
          // Pinned first (on the first page), then by latest activity.
          if (!cursor) {
            const pa = memberBy.get(a._id)?.pinnedAt?.getTime() ?? 0;
            const pb = memberBy.get(b._id)?.pinnedAt?.getTime() ?? 0;
            if (pa !== pb) return pb - pa;
          }
          return activity(b).getTime() - activity(a).getTime() || (b._id < a._id ? -1 : 1);
        });
      if (after) {
        const at = new Date(after.at).getTime();
        list = list.filter((c) => !memberBy.get(c._id)?.pinnedAt && (activity(c).getTime() < at || (activity(c).getTime() === at && c._id < after.id)));
      }
      const hasMore = list.length > limit;
      const pageRows = list.slice(0, limit);
      const ids = pageRows.map((c) => c._id);
      const [lastMessages, counts, unread] = await Promise.all([
        messages()
          .aggregate<{ _id: string; last: Message }>([{ $match: { chatId: { $in: ids } } }, { $sort: { chatId: 1, createdAt: -1, _id: -1 } }, { $group: { _id: '$chatId', last: { $first: '$$ROOT' } } }])
          .toArray(),
        members().aggregate<{ _id: string; n: number }>([{ $match: { chatId: { $in: ids } } }, { $group: { _id: '$chatId', n: { $sum: 1 } } }]).toArray(),
        Promise.all(
          pageRows.map(async (c) => {
            const me = memberBy.get(c._id)!;
            if (c.lastMessageAt && c.lastMessageAt <= me.lastReadAt) return [c._id, 0] as const;
            const n = await messages().countDocuments({ chatId: c._id, createdAt: { $gt: me.lastReadAt }, senderId: { $ne: auth.userId }, deletedAt: null }, { limit: 100 });
            return [c._id, n] as const;
          }),
        ),
      ]);
      const lastBy = new Map(lastMessages.map((x) => [x._id, x.last]));
      const countBy = new Map(counts.map((x) => [x._id, x.n]));
      const unreadBy = new Map(unread);
      const senderPeople = await loadPeople(app.deps, lastMessages.map((x) => x.last.senderId));
      const now = new Date();
      const items = pageRows
        .filter((c) => filter !== 'unread' || (unreadBy.get(c._id) ?? 0) > 0)
        .map((c) => {
          const me = memberBy.get(c._id)!;
          const otherId = others.get(c._id);
          const person = otherId ? people.get(otherId) : undefined;
          const last = lastBy.get(c._id);
          return {
            id: c._id,
            kind: c.kind,
            title: c.kind === 'direct' ? (person?.displayName ?? 'Deleted user') : c.title,
            description: c.description,
            other: person ?? null,
            membersCount: countBy.get(c._id) ?? 0,
            myRole: me.role,
            unread: unreadBy.get(c._id) ?? 0,
            muted: Boolean(me.mutedUntil && me.mutedUntil > now),
            pinned: Boolean(me.pinnedAt),
            archived: Boolean(me.archivedAt),
            colorWash: me.colorWash,
            disappearingSeconds: c.disappearingSeconds,
            lastMessage: last
              ? {
                  id: last._id,
                  kind: last.kind,
                  preview: last.deletedAt ? 'Message deleted' : last.kind === 'text' || last.kind === 'system' ? String(last.body ?? '').slice(0, 100) : `[${last.kind}]`,
                  senderName: c.kind === 'anonymous' ? null : last.senderId === auth.userId ? 'You' : (senderPeople.get(last.senderId ?? '')?.displayName ?? null),
                  createdAt: last.createdAt.toISOString(),
                }
              : null,
            activityAt: activity(c).toISOString(),
          };
        });
      const lastRow = pageRows[pageRows.length - 1];
      return { items, nextCursor: hasMore && lastRow ? encodeCursor(activity(lastRow), lastRow._id) : null };
    },
  );

  app.get('/chats/unread-count', { schema: { tags: ['chats'], summary: 'Chats with unread messages (badge)' } }, async (request) => {
    const auth = requireAuth(request);
    const now = new Date();
    const mine = await members()
      .find({ userId: auth.userId, archivedAt: null, $or: [{ mutedUntil: null }, { mutedUntil: { $lt: now } }] }, { projection: { chatId: 1, lastReadAt: 1 } })
      .limit(1000)
      .toArray();
    const active = await chats().find({ _id: { $in: mine.map((m) => m.chatId) }, lastMessageAt: { $ne: null } }, { projection: { lastMessageAt: 1 } }).toArray();
    const readBy = new Map(mine.map((m) => [m.chatId, m.lastReadAt]));
    const candidates = active.filter((c) => c.lastMessageAt! > readBy.get(c._id)!);
    const flags = await Promise.all(
      candidates.map((c) => messages().findOne({ chatId: c._id, createdAt: { $gt: readBy.get(c._id)! }, senderId: { $ne: auth.userId }, deletedAt: null }, { projection: { _id: 1 } })),
    );
    return { count: flags.filter(Boolean).length };
  });

  // ---------------------------------------------------------------- create
  app.post('/chats/direct', { config: { rateLimit: { max: 60, timeWindow: '1 hour' } }, schema: { tags: ['chats'], summary: 'Open a direct chat with someone', body: z.object({ userId: uuid }) } }, async (request) => {
    const auth = requireAuth(request);
    return { chatId: await openDirectChat(app.deps, auth, request.body.userId) };
  });

  app.post(
    '/chats/group',
    { config: { rateLimit: { max: 20, timeWindow: '1 day' } }, schema: { tags: ['chats'], summary: 'Create a group chat', body: z.object({ title: text(1, 120), description: optionalText(500), memberIds: z.array(uuid).min(1).max(255) }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const ids = [...new Set(request.body.memberIds.filter((id) => id !== auth.userId))];
      const allowed = await addable(auth, ids);
      if (!allowed.length) throw Errors.validation([{ field: 'memberIds', message: 'None of these people can be added.' }]);
      const now = new Date();
      const chatId = uuidv7();
      await db.tx(async (session) => {
        await chats().insertOne(
          { _id: chatId, collegeId: auth.collegeId, kind: 'group', title: cleanText(request.body.title), description: request.body.description ? cleanText(request.body.description) : null, createdBy: auth.userId, directKey: null, spaceId: null, eventId: null, onlyAdminsPost: false, disappearingSeconds: null, lastMessageAt: null, createdAt: now, updatedAt: now },
          { session },
        );
        await members().insertMany([newMember(chatId, auth.userId, 'owner'), ...allowed.map((id) => newMember(chatId, id))], { session });
      });
      await postSystemMessage(app.deps, chatId, `${auth.displayName} created the group "${request.body.title}".`);
      return reply.status(201).send({ chatId, added: allowed.length, skipped: ids.length - allowed.length });
    },
  );

  // ---------------------------------------------------------------- chat details & settings
  app.get('/chats/:id', { schema: { tags: ['chats'], summary: 'Chat details and members', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const m = await requireMember(db, auth.userId, request.params.id);
    const c = m.chat;
    const me = m.member;
    const list = (await members().find({ chatId: m.chatId }).sort({ joinedAt: 1 }).limit(300).toArray()).sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime());
    const anonymous = c.kind === 'anonymous';
    const people = anonymous ? new Map() : await loadPeople(app.deps, list.map((x) => x.userId));
    const otherId = otherInDirect(m, auth.userId);
    const blocked = otherId ? await isBlockedBetween(db, auth.userId, otherId) : false;
    const now = new Date();
    return {
      id: c._id,
      kind: c.kind,
      title: c.kind === 'direct' ? (people.get(otherId ?? '')?.displayName ?? 'Deleted user') : c.title,
      description: c.description,
      onlyAdminsPost: c.onlyAdminsPost,
      disappearingSeconds: c.disappearingSeconds,
      myRole: m.role,
      canPost: !blocked && (!c.onlyAdminsPost || m.role !== 'member'),
      settings: { muted: Boolean(me.mutedUntil && me.mutedUntil > now), mutedUntil: me.mutedUntil?.toISOString() ?? null, archived: Boolean(me.archivedAt), pinned: Boolean(me.pinnedAt), colorWash: me.colorWash },
      lastReadAt: me.lastReadAt.toISOString(),
      members: list.map((x) => ({
        ...(anonymous ? { id: null, displayName: `Anonymous #${x.anonymousAlias ?? '0000'}` } : personOf(people, x.userId)),
        chatRole: x.role,
        joinedAt: x.joinedAt.toISOString(),
      })),
    };
  });

  app.patch(
    '/chats/:id',
    { schema: { tags: ['chats'], summary: 'Rename or change group rules (owners and admins)', params: idParam, body: z.object({ title: text(1, 120).optional(), description: optionalText(500), onlyAdminsPost: z.boolean().optional(), disappearingSeconds: z.union([z.literal(86400), z.literal(604800), z.null()]).optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const m = await requireMember(db, auth.userId, request.params.id);
      const b = request.body;
      if (m.kind === 'direct' && (b.title || b.onlyAdminsPost !== undefined)) throw Errors.badRequest('Direct chats have no title or admins.');
      if (m.kind !== 'direct' && m.role === 'member') throw Errors.forbidden('Only group admins can change this.');
      const set: Partial<Chat> = { updatedAt: new Date() };
      if (b.title) set.title = cleanText(b.title);
      if (b.description !== undefined) set.description = cleanText(b.description);
      if (b.onlyAdminsPost !== undefined) set.onlyAdminsPost = b.onlyAdminsPost;
      if (b.disappearingSeconds !== undefined) set.disappearingSeconds = b.disappearingSeconds;
      await chats().updateOne({ _id: m.chatId }, { $set: set });
      if (b.title) await postSystemMessage(app.deps, m.chatId, `${auth.displayName} renamed the group to "${b.title}".`);
      if (b.disappearingSeconds !== undefined) {
        await postSystemMessage(app.deps, m.chatId, b.disappearingSeconds ? `${auth.displayName} turned on disappearing messages (${b.disappearingSeconds === 86400 ? '24 hours' : '7 days'}).` : `${auth.displayName} turned off disappearing messages.`);
      }
      realtime.toChat(m.chatId, { type: 'chat.updated', chatId: m.chatId });
      return { status: 'saved' };
    },
  );

  app.patch(
    '/chats/:id/settings',
    { schema: { tags: ['chats'], summary: 'My settings for a chat: mute, archive, pin, colour', params: idParam, body: z.object({ muteHours: z.number().int().min(0).max(24 * 365).optional(), archived: z.boolean().optional(), pinned: z.boolean().optional(), colorWash: z.enum(['none', 'meadow', 'ocean', 'blossom', 'ember']).optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const m = await requireMember(db, auth.userId, request.params.id);
      const b = request.body;
      const now = new Date();
      const set: Partial<ChatMember> = {};
      if (b.muteHours !== undefined) set.mutedUntil = b.muteHours === 0 ? null : new Date(now.getTime() + b.muteHours * 3600_000);
      if (b.archived !== undefined) set.archivedAt = b.archived ? (m.member.archivedAt ?? now) : null;
      if (b.pinned !== undefined) set.pinnedAt = b.pinned ? (m.member.pinnedAt ?? now) : null;
      if (b.colorWash) set.colorWash = b.colorWash;
      if (Object.keys(set).length) await members().updateOne({ _id: m.member._id }, { $set: set });
      return { status: 'saved' };
    },
  );

  app.post('/chats/:id/members', { schema: { tags: ['chats'], summary: 'Add people to a group (admins)', params: idParam, body: z.object({ userIds: z.array(uuid).min(1).max(100) }) } }, async (request) => {
    const auth = requireAuth(request);
    const m = await requireMember(db, auth.userId, request.params.id);
    if (m.kind === 'direct') throw Errors.badRequest('Start a group to chat with more people.');
    if (m.role === 'member') throw Errors.forbidden('Only group admins can add people.');
    const added = await addMembers(m.chatId, await addable(auth, [...new Set(request.body.userIds)]));
    if (added) await postSystemMessage(app.deps, m.chatId, `${auth.displayName} added ${added} ${added === 1 ? 'person' : 'people'}.`);
    return { added };
  });

  app.delete('/chats/:id/members/:userId', { schema: { tags: ['chats'], summary: 'Leave a group, or remove someone (admins)', params: z.object({ id: uuid, userId: uuid }) } }, async (request) => {
    const auth = requireAuth(request);
    const m = await requireMember(db, auth.userId, request.params.id);
    if (m.kind === 'direct') throw Errors.badRequest('Direct chats cannot be left; archive or block instead.');
    const self = request.params.userId === auth.userId;
    if (!self && m.role === 'member') throw Errors.forbidden('Only group admins can remove people.');
    await db.tx(async (session) => {
      const target = await members().findOne({ _id: memberKey(m.chatId, request.params.userId) }, { session });
      if (!target) throw Errors.notFound('This member');
      if (target.role === 'owner' && !self) throw Errors.forbidden('The owner cannot be removed.');
      await members().deleteOne({ _id: target._id }, { session });
      // Keep the group manageable: if the last owner leaves, the longest-standing admin (or member) takes over.
      if (target.role === 'owner' && !(await members().findOne({ chatId: m.chatId, role: 'owner' }, { session }))) {
        const next =
          (await members().find({ chatId: m.chatId, role: 'admin' }, { session }).sort({ joinedAt: 1 }).limit(1).next()) ??
          (await members().find({ chatId: m.chatId }, { session }).sort({ joinedAt: 1 }).limit(1).next());
        if (next) await members().updateOne({ _id: next._id }, { $set: { role: 'owner' } }, { session });
      }
    });
    await postSystemMessage(app.deps, m.chatId, self ? `${auth.displayName} left.` : `${auth.displayName} removed a member.`);
    return { status: 'removed' };
  });

  // ---------------------------------------------------------------- messages
  function visibleSince(m: ChatMembership): Filter<Message> {
    return m.disappearingSeconds ? { createdAt: { $gt: new Date(Date.now() - m.disappearingSeconds * 1000) } } : {};
  }

  app.get(
    '/chats/:id/messages',
    {
      schema: {
        tags: ['chats'],
        summary: 'Messages: newest page, older with ?before, catch up with ?after',
        params: idParam,
        querystring: z.object({
          before: z.string().max(200).optional(),
          after: z.string().max(200).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(40),
          // Search this chat's messages (newest matches first, up to the limit).
          q: z.string().trim().min(2).max(80).optional(),
        }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const m = await requireMember(db, auth.userId, request.params.id);
      const { before, after, limit, q } = request.query;
      if (q) {
        const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const found = await messages()
          .find({ $and: [{ chatId: m.chatId, deletedAt: null, body: { $regex: pattern, $options: 'i' } }, visibleSince(m)] })
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .toArray();
        return { items: await toMessageViews(app.deps, auth.userId, m.chat, found), olderCursor: null, newerCursor: null, hasMoreNewer: false };
      }
      const b = decodeCursor(before);
      const a = decodeCursor(after);
      const and: Filter<Message>[] = [{ chatId: m.chatId }, visibleSince(m)];
      if (b) and.push({ $or: [{ createdAt: { $lt: new Date(b.at) } }, { createdAt: new Date(b.at), _id: { $lt: b.id } }] });
      if (a) and.push({ $or: [{ createdAt: { $gt: new Date(a.at) } }, { createdAt: new Date(a.at), _id: { $gt: a.id } }] });
      const rows = await messages()
        .find({ $and: and })
        .sort(a ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .toArray();
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const ordered = a ? pageRows : [...pageRows].reverse(); // always oldest -> newest in the response
      const items = await toMessageViews(app.deps, auth.userId, m.chat, ordered);
      const oldest = ordered[0];
      const newest = ordered[ordered.length - 1];
      return {
        items,
        olderCursor: !a && hasMore && oldest ? encodeCursor(oldest.createdAt, oldest._id) : null,
        newerCursor: newest ? encodeCursor(newest.createdAt, newest._id) : (after ?? null),
        hasMoreNewer: Boolean(a && hasMore),
      };
    },
  );

  app.post(
    '/chats/:id/messages',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } }, schema: { tags: ['chats'], summary: 'Send a message (idempotent with clientId)', params: idParam, body: sendBody } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const m = await requireMember(db, auth.userId, request.params.id);
      const b = request.body;

      // A retry of a message that already went through: return it unchanged.
      const dup = await messages().findOne({ chatId: m.chatId, senderId: auth.userId, clientId: b.clientId });
      if (dup) {
        const [view] = await toMessageViews(app.deps, auth.userId, m.chat, [dup]);
        return reply.status(200).send(view);
      }

      if (m.onlyAdminsPost && m.role === 'member') throw Errors.forbidden('Only admins can post in this chat.');
      const otherId = otherInDirect(m, auth.userId);
      if (otherId && (await isBlockedBetween(db, auth.userId, otherId))) throw Errors.forbidden('You cannot message this person.');
      if (b.kind === 'snap' && !(await app.deps.flags.isEnabled('feature.chat_snaps', { userId: auth.userId, role: auth.role, collegeId: auth.collegeId }))) {
        throw Errors.featureDisabled('feature.chat_snaps');
      }
      if (b.fileId) {
        const f = await db.col('files').findOne({ _id: b.fileId, ownerId: auth.userId, purpose: 'message', status: { $in: ['ready', 'pending'] }, deletedAt: null }, { projection: { kind: 1 } });
        if (!f || !(FILE_KINDS[b.kind] ?? []).includes(f.kind)) throw Errors.validation([{ field: 'fileId', message: 'Upload the attachment again.' }]);
      }
      if (b.replyToId) {
        const r = await messages().findOne({ _id: b.replyToId, chatId: m.chatId }, { projection: { _id: 1 } });
        if (!r) throw Errors.validation([{ field: 'replyToId', message: 'That message is no longer here.' }]);
      }
      let payload: Record<string, unknown>;
      try {
        payload = cleanPayload(b.kind, b.payload);
      } catch (err) {
        throw Errors.validation([{ field: 'payload', message: (err as Error).message.slice(0, 200) }]);
      }
      const body = b.body ? cleanText(b.body).trim() : null;
      const now = new Date();
      const msg: Message = { _id: uuidv7(), chatId: m.chatId, senderId: auth.userId, kind: b.kind, body: body || null, replyToId: b.replyToId ?? null, fileId: b.fileId ?? null, payload, clientId: b.clientId, editedAt: null, deletedAt: null, createdAt: now };
      try {
        await messages().insertOne(msg);
      } catch (err) {
        // Two identical retries racing: the unique index lets one in; the other gets that message.
        if ((err as { code?: number }).code !== 11000) throw err;
        const first = await messages().findOne({ chatId: m.chatId, senderId: auth.userId, clientId: b.clientId });
        if (!first) throw err;
        const [view] = await toMessageViews(app.deps, auth.userId, m.chat, [first]);
        return reply.status(200).send(view);
      }
      await Promise.all([
        chats().updateOne({ _id: m.chatId }, { $max: { lastMessageAt: now } }),
        members().updateOne({ _id: m.member._id }, { $max: { lastReadAt: now } }),
      ]);
      const [view] = await toMessageViews(app.deps, auth.userId, m.chat, [msg]);
      realtime.toChat(m.chatId, { type: 'message.created', chatId: m.chatId, message: { ...view, isMine: false } }, auth.userId);

      // Notify the other person in a direct chat (not every message of busy groups).
      if (otherId) {
        const other = await members().findOne({ _id: memberKey(m.chatId, otherId) }, { projection: { mutedUntil: 1 } });
        if (!(other?.mutedUntil && other.mutedUntil > new Date())) {
          await app.deps.notifier.send({
            userId: otherId,
            kind: 'message',
            title: `${auth.displayName} sent you a message`,
            body: b.kind === 'text' ? (body ?? '').slice(0, 140) : `Sent a ${b.kind}`,
            link: `/chats/${m.chatId}`,
            actorId: auth.userId,
            entityType: 'chat',
            entityId: m.chatId,
          });
        }
      }
      return reply.status(201).send(view);
    },
  );

  async function loadMessage(auth: { userId: string }, messageId: string) {
    const row = await messages().findOne({ _id: messageId });
    if (!row) throw Errors.notFound('This message');
    const m = await requireMember(db, auth.userId, row.chatId);
    return { row, m };
  }

  // Forward a message to up to 5 chats, like WhatsApp. The copy keeps the text, photo or file
  // and is marked "Forwarded". View-once snaps, plans and polls cannot be forwarded.
  app.post(
    '/messages/:id/forward',
    { config: { rateLimit: { max: 60, timeWindow: '1 hour' } }, schema: { tags: ['chats'], summary: 'Forward a message to other chats', params: idParam, body: z.object({ chatIds: z.array(uuid).min(1).max(5) }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { row } = await loadMessage(auth, request.params.id);
      if (row.deletedAt || !['text', 'image', 'file', 'voice', 'video'].includes(row.kind)) throw Errors.badRequest('This message cannot be forwarded.');
      let sent = 0;
      for (const chatId of [...new Set(request.body.chatIds)]) {
        const target = await requireMember(db, auth.userId, chatId);
        if (target.onlyAdminsPost && target.role === 'member') continue;
        const otherId = otherInDirect(target, auth.userId);
        if (otherId && (await isBlockedBetween(db, auth.userId, otherId))) continue;
        const now = new Date();
        const copy: Message = { _id: uuidv7(), chatId: target.chatId, senderId: auth.userId, kind: row.kind, body: row.body, replyToId: null, fileId: row.fileId, payload: {}, clientId: null, forwarded: true, editedAt: null, deletedAt: null, createdAt: now };
        await messages().insertOne(copy);
        await Promise.all([
          chats().updateOne({ _id: target.chatId }, { $max: { lastMessageAt: now } }),
          members().updateOne({ _id: target.member._id }, { $max: { lastReadAt: now } }),
        ]);
        const [view] = await toMessageViews(app.deps, auth.userId, target.chat, [copy]);
        realtime.toChat(target.chatId, { type: 'message.created', chatId: target.chatId, message: { ...view, isMine: false } }, auth.userId);
        if (otherId) await app.deps.notifier.send({ userId: otherId, kind: 'message', title: `${auth.displayName} forwarded a message`, body: copy.body?.slice(0, 140) ?? '', link: `/chats/${target.chatId}`, actorId: auth.userId, entityType: 'chat', entityId: target.chatId });
        sent++;
      }
      return { sent };
    },
  );

  // Group admins can make others admins (or take it back); the owner cannot be changed here.
  app.patch(
    '/chats/:id/members/:userId',
    { schema: { tags: ['chats'], summary: 'Make someone a group admin, or a member again', params: z.object({ id: uuid, userId: uuid }), body: z.object({ role: z.enum(['admin', 'member']) }) } },
    async (request) => {
      const auth = requireAuth(request);
      const m = await requireMember(db, auth.userId, request.params.id);
      if (m.kind === 'direct') throw Errors.badRequest('Direct chats have no admins.');
      if (m.role === 'member') throw Errors.forbidden('Only group admins can change roles.');
      const target = await members().findOne({ _id: memberKey(m.chatId, request.params.userId) });
      if (!target) throw Errors.notFound('This member');
      if (target.role === 'owner') throw Errors.forbidden('The owner stays the owner.');
      await members().updateOne({ _id: target._id }, { $set: { role: request.body.role } });
      const people = await loadPeople(app.deps, [target.userId]);
      const name = people.get(target.userId)?.displayName ?? 'Someone';
      await postSystemMessage(app.deps, m.chatId, request.body.role === 'admin' ? `${auth.displayName} made ${name} an admin.` : `${auth.displayName} removed ${name} as admin.`);
      realtime.toChat(m.chatId, { type: 'chat.updated', chatId: m.chatId });
      return { status: 'saved' };
    },
  );

  app.patch('/messages/:id', { schema: { tags: ['chats'], summary: 'Edit my text message (15 minutes)', params: idParam, body: z.object({ body: text(1, 4000) }) } }, async (request) => {
    const auth = requireAuth(request);
    const { row, m } = await loadMessage(auth, request.params.id);
    if (row.senderId !== auth.userId || row.kind !== 'text' || row.deletedAt) throw Errors.forbidden('You can edit only your own text messages.');
    if (Date.now() - row.createdAt.getTime() > EDIT_WINDOW_MS) throw Errors.conflict('Messages can be edited for 15 minutes after sending.');
    const updated = await messages().findOneAndUpdate({ _id: row._id }, { $set: { body: cleanText(request.body.body), editedAt: new Date() } }, { returnDocument: 'after' });
    const [view] = await toMessageViews(app.deps, auth.userId, m.chat, [updated ?? row]);
    realtime.toChat(m.chatId, { type: 'message.created', chatId: m.chatId, message: { ...view, isMine: false } }, auth.userId);
    return view;
  });

  app.delete('/messages/:id', { schema: { tags: ['chats'], summary: 'Delete a message for everyone (sender or group admin)', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const { row, m } = await loadMessage(auth, request.params.id);
    if (row.senderId !== auth.userId && m.role === 'member') throw Errors.forbidden();
    await messages().updateOne({ _id: row._id }, { $set: { deletedAt: new Date(), body: null, payload: {} } });
    realtime.toChat(m.chatId, { type: 'message.deleted', chatId: m.chatId, messageId: row._id });
    return { status: 'deleted' };
  });

  async function broadcastReactions(chatId: string, messageId: string) {
    const rows = await db
      .col('message_reactions')
      .aggregate<{ _id: string; n: number; first: Date }>([{ $match: { messageId } }, { $group: { _id: '$emoji', n: { $sum: 1 }, first: { $min: '$createdAt' } } }, { $sort: { first: 1 } }])
      .toArray();
    const reactions = rows.map((r) => ({ emoji: r._id, n: r.n }));
    realtime.toChat(chatId, { type: 'message.reactions', chatId, messageId, reactions: reactions.map((r) => ({ emoji: r.emoji, count: r.n })) });
    return reactions;
  }

  const emojiBody = z.object({ emoji: z.string().min(1).max(16).refine((e) => !/[<>"'`\s:]/.test(e), 'Use an emoji.') });
  app.put('/messages/:id/reactions', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } }, schema: { tags: ['chats'], summary: 'React to a message', params: idParam, body: emojiBody } }, async (request) => {
    const auth = requireAuth(request);
    const { row, m } = await loadMessage(auth, request.params.id);
    if (row.deletedAt) throw Errors.gone('This message was deleted.');
    const id = `${row._id}:${auth.userId}:${request.body.emoji}`;
    const already = await db.col('message_reactions').findOne({ _id: id }, { projection: { _id: 1 } });
    if (!already) {
      const count = await db.col('message_reactions').countDocuments({ messageId: row._id, userId: auth.userId });
      if (count >= 3) throw Errors.conflict('You can add up to 3 reactions to a message.');
      await db.col('message_reactions').updateOne({ _id: id }, { $setOnInsert: { messageId: row._id, chatId: m.chatId, userId: auth.userId, emoji: request.body.emoji, createdAt: new Date() } }, { upsert: true });
    }
    return { reactions: await broadcastReactions(m.chatId, row._id) };
  });

  app.delete('/messages/:id/reactions', { schema: { tags: ['chats'], summary: 'Remove my reaction', params: idParam, body: emojiBody } }, async (request) => {
    const auth = requireAuth(request);
    const { row, m } = await loadMessage(auth, request.params.id);
    await db.col('message_reactions').deleteOne({ _id: `${row._id}:${auth.userId}:${request.body.emoji}` });
    return { reactions: await broadcastReactions(m.chatId, row._id) };
  });

  app.put(
    '/messages/:id/response',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } }, schema: { tags: ['chats'], summary: 'Answer a plan ("in"/"maybe"/"out") or an in-chat poll (option index)', params: idParam, body: z.object({ response: z.string().regex(/^(in|maybe|out|[0-7])$/).nullable() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { row, m } = await loadMessage(auth, request.params.id);
      if (!['plan', 'poll'].includes(row.kind) || row.deletedAt) throw Errors.badRequest('This message does not take answers.');
      const r = request.body.response;
      if (r !== null && row.kind === 'plan' && !['in', 'maybe', 'out'].includes(r)) throw Errors.validation([{ field: 'response', message: 'Answer in, maybe or out.' }]);
      if (r !== null && row.kind === 'poll' && !/^[0-7]$/.test(r)) throw Errors.validation([{ field: 'response', message: 'Choose an option.' }]);
      const id = `${row._id}:${auth.userId}`;
      if (r === null) await db.col('message_responses').deleteOne({ _id: id });
      else await db.col('message_responses').updateOne({ _id: id }, { $set: { response: r, updatedAt: new Date() }, $setOnInsert: { messageId: row._id, userId: auth.userId } }, { upsert: true });
      const counts = await db.col('message_responses').aggregate<{ _id: string; n: number }>([{ $match: { messageId: row._id } }, { $group: { _id: '$response', n: { $sum: 1 } } }]).toArray();
      const responses = Object.fromEntries(counts.map((c) => [c._id, c.n]));
      realtime.toChat(m.chatId, { type: 'message.response', chatId: m.chatId, messageId: row._id, responses });
      return { counts: responses, mine: r };
    },
  );

  app.post('/messages/:id/open-snap', { schema: { tags: ['chats'], summary: 'Open a view-once snap (only once)', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const { row } = await loadMessage(auth, request.params.id);
    if (row.kind !== 'snap' || row.deletedAt || !row.fileId) throw Errors.notFound('This snap');
    if (row.senderId !== auth.userId) {
      const res = await db.col('message_views').updateOne({ _id: `${row._id}:${auth.userId}` }, { $setOnInsert: { messageId: row._id, userId: auth.userId, viewedAt: new Date() } }, { upsert: true });
      if (!res.upsertedCount) throw Errors.gone('You have already opened this snap.');
    }
    const f = await db.col('files').findOne({ _id: row.fileId, status: 'ready', deletedAt: null });
    if (!f) throw Errors.gone('This snap is no longer available.');
    // A very short-lived link: long enough to load, too short to share.
    return { file: await fileView(app.deps, f, 60) };
  });

  app.post('/chats/:id/read', { schema: { tags: ['chats'], summary: 'Mark the chat as read', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const m = await requireMember(db, auth.userId, request.params.id);
    const row = await members().findOneAndUpdate({ _id: m.member._id }, { $max: { lastReadAt: new Date() } }, { returnDocument: 'after', projection: { lastReadAt: 1 } });
    const at = (row?.lastReadAt ?? new Date()).toISOString();
    // Read receipts are not shown in anonymous chats.
    if (m.kind !== 'anonymous') realtime.toChat(m.chatId, { type: 'chat.read', chatId: m.chatId, userId: auth.userId, at }, auth.userId);
    return { lastReadAt: at };
  });

  app.get('/chats/:id/media', { schema: { tags: ['chats'], summary: 'Shared photos, videos and files', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const m = await requireMember(db, auth.userId, request.params.id);
    const rows = await messages()
      .find({ $and: [{ chatId: m.chatId, fileId: { $type: 'string' }, kind: { $ne: 'snap' }, deletedAt: null }, visibleSince(m)] })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return { items: await toMessageViews(app.deps, auth.userId, m.chat, rows) };
  });
};
