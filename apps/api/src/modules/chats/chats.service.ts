import type { Deps } from '../../deps.js';
import { Errors } from '../../core/errors.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Chat, ChatMember, Message } from '../../infra/db/models.js';
import type { Mongo } from '../../infra/db/mongo.js';
import type { AuthContext } from '../../types/fastify.js';
import { loadFileViews, type FileView } from '../files/files.service.js';
import { isBlockedBetween, loadPeople, type PersonSummary } from '../users/people.js';

// Chat building blocks shared by the chat routes and other modules (marketplace "contact
// seller", event chats). The database is always written first; realtime delivery follows and
// clients that missed it catch up with GET /messages?after=...

export const memberKey = (chatId: string, userId: string) => `${chatId}:${userId}`;

export interface ChatMembership {
  chatId: string;
  kind: Chat['kind'];
  role: ChatMember['role'];
  collegeId: string;
  onlyAdminsPost: boolean;
  disappearingSeconds: number | null;
  directKey: string | null;
  anonymousAlias: number | null;
  chat: Chat;
  member: ChatMember;
}

export async function membership(db: Mongo, userId: string, chatId: string): Promise<ChatMembership | null> {
  const member = await db.col('chat_members').findOne({ _id: memberKey(chatId, userId) });
  if (!member) return null;
  const chat = await db.col('chats').findOne({ _id: chatId });
  if (!chat) return null;
  return {
    chatId,
    kind: chat.kind,
    role: member.role,
    collegeId: chat.collegeId,
    onlyAdminsPost: chat.onlyAdminsPost,
    disappearingSeconds: chat.disappearingSeconds,
    directKey: chat.directKey,
    anonymousAlias: member.anonymousAlias,
    chat,
    member,
  };
}

export async function requireMember(db: Mongo, userId: string, chatId: string): Promise<ChatMembership> {
  const m = await membership(db, userId, chatId);
  if (!m) throw Errors.notFound('This chat');
  return m;
}

/** The other person in a direct chat. */
export function otherInDirect(m: Pick<ChatMembership, 'directKey'>, userId: string): string | null {
  if (!m.directKey) return null;
  const [a, b] = m.directKey.split(':');
  return a === userId ? (b ?? null) : (a ?? null);
}

export function newMember(chatId: string, userId: string, role: ChatMember['role'] = 'member', anonymousAlias: number | null = null): ChatMember {
  const now = new Date();
  return { _id: memberKey(chatId, userId), chatId, userId, role, joinedAt: now, lastReadAt: now, mutedUntil: null, archivedAt: null, pinnedAt: null, colorWash: 'none', anonymousAlias };
}

/** Finds or creates the one direct chat between two people, respecting blocks and message privacy. */
export async function openDirectChat(deps: Deps, auth: AuthContext, otherUserId: string): Promise<string> {
  const db = deps.db;
  if (otherUserId === auth.userId) throw Errors.badRequest('You cannot message yourself.');
  const other = await db.col('users').findOne({ _id: otherUserId }, { projection: { collegeId: 1, status: 1, 'profile.messagePrivacy': 1 } });
  if (!other || other.collegeId !== auth.collegeId || other.status !== 'active') throw Errors.notFound('This person');
  if (await isBlockedBetween(db, auth.userId, otherUserId)) throw Errors.notFound('This person');

  const key = [auth.userId, otherUserId].sort().join(':');
  const existing = await db.col('chats').findOne({ directKey: key }, { projection: { _id: 1 } });
  if (existing) {
    // Someone who left (or deleted) the conversation gets it back when either side writes again.
    await db.col('chat_members').updateOne({ _id: memberKey(existing._id, auth.userId) }, { $setOnInsert: newMember(existing._id, auth.userId) }, { upsert: true });
    return existing._id;
  }

  const privacy = other.profile.messagePrivacy;
  if (privacy === 'nobody') throw Errors.forbidden('This person is not accepting new messages.');
  if (privacy === 'connections') {
    const [followsMe, iFollow] = await Promise.all([
      db.col('follows').findOne({ _id: `${otherUserId}:${auth.userId}` }, { projection: { _id: 1 } }),
      db.col('follows').findOne({ _id: `${auth.userId}:${otherUserId}` }, { projection: { _id: 1 } }),
    ]);
    if (!(followsMe && iFollow)) throw Errors.forbidden('This person accepts messages only from people they follow back.');
  }
  const now = new Date();
  const id = uuidv7();
  try {
    // Two people opening the chat at the same moment: the unique directKey makes one insert win.
    await db.col('chats').insertOne({ _id: id, collegeId: auth.collegeId, kind: 'direct', title: null, description: null, createdBy: auth.userId, directKey: key, spaceId: null, eventId: null, onlyAdminsPost: false, disappearingSeconds: null, lastMessageAt: null, createdAt: now, updatedAt: now });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
  }
  const chat = await db.col('chats').findOne({ directKey: key }, { projection: { _id: 1 } });
  if (!chat) throw Errors.internal();
  for (const userId of [auth.userId, otherUserId]) {
    await db.col('chat_members').updateOne({ _id: memberKey(chat._id, userId) }, { $setOnInsert: newMember(chat._id, userId) }, { upsert: true });
  }
  return chat._id;
}

/** A message from the system (joins, renames, marketplace enquiries). */
export async function postSystemMessage(deps: Deps, chatId: string, body: string, payload: Record<string, unknown> = {}): Promise<void> {
  const now = new Date();
  const msg: Message = { _id: uuidv7(), chatId, senderId: null, kind: 'system', body: body.slice(0, 4000), replyToId: null, fileId: null, payload, clientId: null, editedAt: null, deletedAt: null, createdAt: now };
  await deps.db.col('messages').insertOne(msg);
  await deps.db.col('chats').updateOne({ _id: chatId }, { $set: { lastMessageAt: now } });
  deps.realtime.toChat(chatId, {
    type: 'message.created',
    chatId,
    message: { id: msg._id, chatId, kind: 'system', body: msg.body, payload, sender: null, reactions: [], createdAt: now.toISOString() },
  });
}

export interface MessageView {
  id: string;
  chatId: string;
  kind: string;
  body: string | null;
  sender: (PersonSummary & { alias?: string }) | null;
  isMine: boolean;
  replyTo: { id: string; body: string | null; senderName: string | null } | null;
  file: FileView | null;
  snap: { viewed: boolean } | null;
  payload: Record<string, unknown>;
  reactions: Array<{ emoji: string; count: number; mine: boolean }>;
  responses: { counts: Record<string, number>; mine: string | null } | null;
  edited: boolean;
  forwarded: boolean;
  deleted: boolean;
  createdAt: string;
}

const ANONYMOUS_ID = '00000000-0000-0000-0000-000000000000';

/** Shapes messages, loading senders, files, reactions, responses, replies and snap state in bulk. */
export async function toMessageViews(deps: Deps, viewerId: string, chat: Pick<Chat, '_id' | 'kind'>, rows: Message[]): Promise<MessageView[]> {
  if (!rows.length) return [];
  const db = deps.db;
  const ids = rows.map((r) => r._id);
  const replyIds = rows.map((r) => r.replyToId).filter((x): x is string => Boolean(x));
  const anonymousChat = chat.kind === 'anonymous';
  const [reactions, responses, views, replies, aliases] = await Promise.all([
    db
      .col('message_reactions')
      .aggregate<{ _id: { m: string; e: string }; n: number; mine: number; first: Date }>([
        { $match: { messageId: { $in: ids } } },
        { $group: { _id: { m: '$messageId', e: '$emoji' }, n: { $sum: 1 }, mine: { $max: { $cond: [{ $eq: ['$userId', viewerId] }, 1, 0] } }, first: { $min: '$createdAt' } } },
        { $sort: { first: 1 } },
      ])
      .toArray(),
    db
      .col('message_responses')
      .aggregate<{ _id: { m: string; r: string }; n: number; mine: number }>([
        { $match: { messageId: { $in: ids } } },
        { $group: { _id: { m: '$messageId', r: '$response' }, n: { $sum: 1 }, mine: { $max: { $cond: [{ $eq: ['$userId', viewerId] }, 1, 0] } } } },
      ])
      .toArray(),
    db.col('message_views').find({ _id: { $in: ids.map((i) => `${i}:${viewerId}`) } }, { projection: { messageId: 1 } }).toArray(),
    replyIds.length ? db.col('messages').find({ _id: { $in: replyIds } }, { projection: { body: 1, deletedAt: 1, senderId: 1 } }).toArray() : Promise.resolve([]),
    anonymousChat
      ? db.col('chat_members').find({ chatId: chat._id, userId: { $in: rows.map((r) => r.senderId).filter((x): x is string => Boolean(x)) } }, { projection: { userId: 1, anonymousAlias: 1 } }).toArray()
      : Promise.resolve([]),
  ]);
  const [people, files] = await Promise.all([
    anonymousChat ? Promise.resolve(new Map<string, PersonSummary>()) : loadPeople(deps, [...rows.map((r) => r.senderId), ...replies.map((r) => r.senderId)]),
    loadFileViews(deps, rows.filter((r) => r.fileId && r.kind !== 'snap' && !r.deletedAt).map((r) => r.fileId)),
  ]);
  const viewed = new Set(views.map((v) => v.messageId));
  const replyBy = new Map(replies.map((r) => [r._id, r]));
  const aliasBy = new Map(aliases.map((a) => [a.userId, a.anonymousAlias]));

  return rows.map((r) => {
    const deleted = Boolean(r.deletedAt);
    const reply = r.replyToId ? replyBy.get(r.replyToId) : undefined;
    const resp = responses.filter((x) => x._id.m === r._id);
    let sender: MessageView['sender'] = null;
    if (r.senderId) {
      if (anonymousChat) {
        const alias = String(aliasBy.get(r.senderId) ?? '0000');
        sender = { id: ANONYMOUS_ID, username: 'anonymous', displayName: `Anonymous #${alias}`, role: 'student', isVerified: false, year: null, department: null, avatarUrl: null, alias };
      } else {
        sender = people.get(r.senderId) ?? { id: ANONYMOUS_ID, username: 'deleted', displayName: 'Deleted user', role: 'student', isVerified: false, year: null, department: null, avatarUrl: null };
      }
    }
    return {
      id: r._id,
      chatId: r.chatId,
      kind: r.kind,
      body: deleted ? null : r.body,
      sender,
      isMine: r.senderId === viewerId,
      replyTo: r.replyToId
        ? { id: r.replyToId, body: reply && !reply.deletedAt ? (reply.body ?? '').slice(0, 140) : null, senderName: anonymousChat ? null : (people.get(reply?.senderId ?? '')?.displayName ?? null) }
        : null,
      file: deleted || r.kind === 'snap' ? null : r.fileId ? (files.get(r.fileId) ?? null) : null,
      snap: r.kind === 'snap' ? { viewed: viewed.has(r._id) || r.senderId === viewerId } : null,
      payload: deleted ? {} : r.payload,
      reactions: reactions.filter((x) => x._id.m === r._id).map((x) => ({ emoji: x._id.e, count: x.n, mine: x.mine === 1 })),
      responses:
        resp.length || r.kind === 'plan' || r.kind === 'poll'
          ? { counts: Object.fromEntries(resp.map((x) => [x._id.r, x.n])), mine: resp.find((x) => x.mine === 1)?._id.r ?? null }
          : null,
      edited: Boolean(r.editedAt),
      forwarded: Boolean(r.forwarded),
      deleted,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
