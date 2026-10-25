import type { ClientSession } from 'mongodb';
import type { Deps } from '../../deps.js';
import type { FileDoc, User } from '../../infra/db/models.js';
import type { Mongo } from '../../infra/db/mongo.js';

// Shared shapes for people, so every module returns authors, members and senders the same way.
// People are loaded in one batch per response (loadPeople), never one query per row.

export interface PersonSummary {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isVerified: boolean;
  year: number | null;
  department: string | null;
  avatarUrl: string | null;
}

export const DELETED_PERSON: PersonSummary = {
  id: '00000000-0000-0000-0000-000000000000',
  username: 'deleted',
  displayName: 'Deleted user',
  role: 'student',
  isVerified: false,
  year: null,
  department: null,
  avatarUrl: null,
};

export const PERSON_PROJECTION = {
  _id: 1,
  role: 1,
  status: 1,
  collegeId: 1,
  'profile.username': 1,
  'profile.displayName': 1,
  'profile.isVerified': 1,
  'profile.year': 1,
  'profile.departmentId': 1,
  'profile.avatarFileId': 1,
  'profile.headline': 1,
} as const;

export type PersonDoc = Pick<User, '_id' | 'role' | 'status' | 'collegeId'> & { profile: Pick<User['profile'], 'username' | 'displayName' | 'isVerified' | 'year' | 'departmentId' | 'avatarFileId' | 'headline'> };

// Department names change rarely: a small per-process cache saves a lookup on every list.
const departmentCache = new Map<string, { name: string; at: number }>();

export async function departmentNames(db: Mongo, ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const id of new Set(ids.filter((x): x is string => Boolean(x)))) {
    const hit = departmentCache.get(id);
    if (hit && Date.now() - hit.at < 10 * 60_000) out.set(id, hit.name);
    else missing.push(id);
  }
  if (missing.length) {
    const rows = await db.col('departments').find({ _id: { $in: missing } }, { projection: { name: 1 } }).toArray();
    for (const r of rows) {
      departmentCache.set(r._id, { name: r.name, at: Date.now() });
      out.set(r._id, r.name);
    }
  }
  return out;
}

/** Signed avatar thumbnails for a set of file ids. */
export async function avatarUrls(deps: Deps, fileIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const ids = [...new Set(fileIds.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const files = await deps.db.col('files').find({ _id: { $in: ids }, status: 'ready' }, { projection: { storageKey: 1, originalName: 1, mimeType: 1, hasThumbnail: 1 } }).toArray();
  await Promise.all(
    files.map(async (f) => {
      out.set(f._id, await deps.storage.signedUrl({ id: f._id, storageKey: f.storageKey, originalName: f.originalName, mimeType: f.mimeType }, f.hasThumbnail ? 'thumb' : 'original', 24 * 3600));
    }),
  );
  return out;
}

/** Turns user documents into person summaries (batching department names and avatars). */
export async function toPeople(deps: Deps, docs: PersonDoc[]): Promise<Map<string, PersonSummary>> {
  const [departments, avatars] = await Promise.all([
    departmentNames(deps.db, docs.map((d) => d.profile.departmentId)),
    avatarUrls(deps, docs.map((d) => d.profile.avatarFileId)),
  ]);
  const out = new Map<string, PersonSummary>();
  for (const d of docs) {
    if (d.status === 'deleted') continue;
    out.set(d._id, {
      id: d._id,
      username: d.profile.username,
      displayName: d.profile.displayName,
      role: d.role,
      isVerified: d.profile.isVerified,
      year: d.profile.year ?? null,
      department: d.profile.departmentId ? (departments.get(d.profile.departmentId) ?? null) : null,
      avatarUrl: d.profile.avatarFileId ? (avatars.get(d.profile.avatarFileId) ?? null) : null,
    });
  }
  return out;
}

/** Loads person summaries for a set of user ids in one query. Unknown ids are left out. */
export async function loadPeople(deps: Deps, ids: Array<string | null | undefined>): Promise<Map<string, PersonSummary>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return new Map();
  const docs = (await deps.db.col('users').find({ _id: { $in: unique } }, { projection: PERSON_PROJECTION }).toArray()) as unknown as PersonDoc[];
  return toPeople(deps, docs);
}

/** The person for an id, or the "Deleted user" placeholder. */
export function personOf(people: Map<string, PersonSummary>, id: string | null | undefined): PersonSummary {
  return (id && people.get(id)) || DELETED_PERSON;
}

/** Ids the viewer must not see content from (people they blocked, and people who blocked them). */
export async function blockedIds(db: Mongo, userId: string, session?: ClientSession): Promise<string[]> {
  const rows = await db
    .col('blocks')
    .find({ $or: [{ blockerId: userId }, { blockedId: userId }] }, { projection: { blockerId: 1, blockedId: 1 }, session })
    .toArray();
  return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
}

export async function isBlockedBetween(db: Mongo, a: string, b: string): Promise<boolean> {
  const row = await db.col('blocks').findOne({ _id: { $in: [`${a}:${b}`, `${b}:${a}`] } }, { projection: { _id: 1 } });
  return Boolean(row);
}

export type { FileDoc };
