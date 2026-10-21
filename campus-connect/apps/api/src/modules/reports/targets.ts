import type { ClientSession, Document, UpdateFilter } from 'mongodb';
import type { Mongo } from '../../infra/db/mongo.js';

// Everything that can be reported, where it lives, and how moderation hides or restores it.
// Collection and field names come only from this fixed map, never from request input.

export const TARGET_TYPES = ['post', 'comment', 'discussion', 'discussion_reply', 'message', 'user', 'listing', 'hush_question', 'hush_answer', 'lost_found', 'resource', 'event', 'space', 'lecture'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

type Doc = Document & { _id: string };

interface TargetDef {
  collection: string;
  /** Where the item's college is: on the item, or on a parent (comment -> post). */
  college: { field: string } | { parent: string; via: string; field: string };
  /** The author/owner field; anonymous items keep the author in the vault under vaultType. */
  owner: string;
  vaultType?: 'post' | 'comment' | 'hush_question' | 'hush_answer';
  preview: (d: Doc) => string;
  /** Updates that hide / remove / restore the item; null when the item cannot be hidden. */
  hide: { filter: Document; update: UpdateFilter<Doc> } | null;
  remove: UpdateFilter<Doc> | null;
  restore: UpdateFilter<Doc> | null;
}

const statusFlow = (visible: string, hidden: string, removed: string): Pick<TargetDef, 'hide' | 'remove' | 'restore'> => ({
  hide: { filter: { status: visible }, update: { $set: { status: hidden } } },
  remove: { $set: { status: removed } },
  restore: { $set: { status: visible } },
});

const cut = (s: unknown, n = 300) => String(s ?? '').slice(0, n);

export const TARGETS: Record<TargetType, TargetDef> = {
  post: { collection: 'posts', college: { field: 'collegeId' }, owner: 'authorId', vaultType: 'post', preview: (d) => cut(d.body), ...statusFlow('published', 'hidden', 'removed') },
  comment: { collection: 'comments', college: { parent: 'posts', via: 'postId', field: 'collegeId' }, owner: 'authorId', vaultType: 'comment', preview: (d) => cut(d.body), ...statusFlow('published', 'hidden', 'removed') },
  discussion: { collection: 'discussions', college: { field: 'collegeId' }, owner: 'authorId', preview: (d) => cut(`${d.title}: ${d.body}`), ...statusFlow('published', 'hidden', 'removed') },
  discussion_reply: { collection: 'discussion_replies', college: { parent: 'discussions', via: 'discussionId', field: 'collegeId' }, owner: 'authorId', preview: (d) => cut(d.body), ...statusFlow('published', 'hidden', 'removed') },
  message: {
    collection: 'messages',
    college: { parent: 'chats', via: 'chatId', field: 'collegeId' },
    owner: 'senderId',
    preview: (d) => cut(d.body ?? `[${d.kind}]`),
    hide: { filter: { deletedAt: null }, update: { $set: { deletedAt: new Date() } } },
    remove: { $set: { deletedAt: new Date(), body: null, payload: {} } },
    restore: null,
  },
  user: { collection: 'users', college: { field: 'collegeId' }, owner: '_id', preview: (d) => `${d.profile?.displayName ?? 'Someone'} (@${d.profile?.username ?? ''})`, hide: null, remove: null, restore: null },
  listing: {
    collection: 'listings',
    college: { field: 'collegeId' },
    owner: 'sellerId',
    preview: (d) => cut(`${d.title}: ${d.description}`),
    hide: { filter: { status: { $ne: 'removed' } }, update: { $set: { status: 'removed' } } },
    remove: { $set: { status: 'removed', deletedAt: new Date() } },
    restore: { $set: { status: 'available', deletedAt: null } },
  },
  hush_question: { collection: 'hush_questions', college: { field: 'collegeId' }, owner: 'authorId', vaultType: 'hush_question', preview: (d) => cut(d.body), ...statusFlow('published', 'hidden', 'removed') },
  hush_answer: { collection: 'hush_answers', college: { field: 'collegeId' }, owner: 'authorId', vaultType: 'hush_answer', preview: (d) => cut(d.body), ...statusFlow('published', 'hidden', 'removed') },
  lost_found: {
    collection: 'lost_found_items',
    college: { field: 'collegeId' },
    owner: 'reporterId',
    preview: (d) => cut(d.title),
    hide: { filter: { status: { $ne: 'closed' } }, update: { $set: { status: 'closed' } } },
    remove: { $set: { deletedAt: new Date() } },
    restore: { $set: { status: 'open', deletedAt: null } },
  },
  resource: { collection: 'resources', college: { field: 'collegeId' }, owner: 'uploaderId', preview: (d) => cut(d.title), ...statusFlow('approved', 'pending', 'removed') },
  event: { collection: 'events', college: { field: 'collegeId' }, owner: 'createdBy', preview: (d) => cut(d.title), ...statusFlow('published', 'pending', 'rejected') },
  space: { collection: 'spaces', college: { field: 'collegeId' }, owner: 'createdBy', preview: (d) => cut(`${d.name}: ${d.description}`), ...statusFlow('active', 'pending', 'removed') },
  lecture: { collection: 'lectures', college: { field: 'collegeId' }, owner: 'teacherId', preview: (d) => cut(d.title), ...statusFlow('published', 'pending', 'rejected') },
};

export interface TargetInfo {
  collegeId: string | null;
  ownerId: string | null;
  preview: string;
  /** Posted without a name (the author is only in the vault). */
  anonymous: boolean;
}

/** The item's college, real owner (also for anonymous content, from the vault) and a preview. */
export async function lookupTarget(db: Mongo, type: TargetType, id: string): Promise<TargetInfo | null> {
  const def = TARGETS[type];
  const doc = await db.raw<Doc>(def.collection).findOne({ _id: id });
  if (!doc) return null;
  let collegeId: string | null;
  if ('parent' in def.college) {
    const parent = await db.raw<Doc>(def.college.parent).findOne({ _id: doc[def.college.via] }, { projection: { [def.college.field]: 1 } });
    collegeId = (parent?.[def.college.field] as string | undefined) ?? null;
  } else {
    collegeId = (doc[def.college.field] as string | undefined) ?? null;
  }
  let ownerId = (doc[def.owner] as string | null | undefined) ?? null;
  const anonymous = !ownerId && Boolean(def.vaultType);
  if (!ownerId && def.vaultType) {
    ownerId = (await db.col('anonymous_authors').findOne({ _id: `${def.vaultType}:${id}` }, { projection: { userId: 1 } }))?.userId ?? null;
  }
  return { collegeId, ownerId, preview: def.preview(doc), anonymous };
}

/** Applies a moderation step. Returns true when the item changed. */
export async function applyTarget(db: Mongo, type: TargetType, id: string, step: 'hide' | 'remove' | 'restore', session?: ClientSession): Promise<boolean> {
  const def = TARGETS[type];
  const col = db.raw<Doc>(def.collection);
  if (step === 'hide') {
    if (!def.hide) return false;
    const res = await col.updateOne({ _id: id, ...def.hide.filter }, def.hide.update, { session });
    return res.modifiedCount > 0;
  }
  const update = def[step];
  if (!update) return false;
  const res = await col.updateOne({ _id: id }, update, { session });
  return res.modifiedCount > 0;
}
