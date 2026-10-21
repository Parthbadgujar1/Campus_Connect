import type { Filter } from 'mongodb';
import type { Deps } from '../../deps.js';
import { isStaff } from '../../core/guards.js';
import type { Post } from '../../infra/db/models.js';
import type { AuthContext } from '../../types/fastify.js';
import { loadFileViews, type FileView } from '../files/files.service.js';
import { blockedIds, departmentNames, loadPeople, type PersonSummary } from '../users/people.js';

// Who can see a post, and the shape every post takes in API responses.
//
// Audience rules (applied as one database filter, so no code path can forget them):
//   college    - everyone at the college
//   department - members of that department
//   year       - students in that year
//   division   - students in that year and division
//   space      - members of the space (public spaces: anyone, when browsing the space)
// Authors always see their own posts, staff see every audience, and blocked people never see
// each other's posts. Anonymous posts store no author on the post; the vault knows who wrote it.

export interface Viewer {
  auth: AuthContext;
  departmentId: string | null;
  year: number | null;
  division: string | null;
  staff: boolean;
  spaceIds: string[];
  blocked: string[];
  /** Anonymous posts written by the viewer (from the vault), so they still see them as theirs. */
  myAnonymousPostIds: string[];
}

export async function loadViewer(deps: Deps, auth: AuthContext): Promise<Viewer> {
  const [user, memberships, blocked, anon] = await Promise.all([
    deps.db.col('users').findOne({ _id: auth.userId }, { projection: { 'profile.departmentId': 1, 'profile.year': 1, 'profile.division': 1 } }),
    deps.db.col('space_members').find({ userId: auth.userId, status: 'active' }, { projection: { spaceId: 1 } }).toArray(),
    blockedIds(deps.db, auth.userId),
    deps.db.col('anonymous_authors').find({ userId: auth.userId, contentType: 'post' }, { projection: { contentId: 1 } }).sort({ createdAt: -1 }).limit(500).toArray(),
  ]);
  return {
    auth,
    departmentId: user?.profile.departmentId ?? null,
    year: user?.profile.year ?? null,
    division: user?.profile.division ?? null,
    staff: isStaff(auth),
    spaceIds: memberships.map((m) => m.spaceId),
    blocked,
    myAnonymousPostIds: anon.map((a) => a.contentId),
  };
}

/** The base conditions every visible post meets (college, published, not deleted, no blocks). */
export function baseFilter(v: Viewer): Filter<Post> {
  return { collegeId: v.auth.collegeId, status: 'published', deletedAt: null, ...(v.blocked.length ? { authorId: { $nin: v.blocked } } : {}) };
}

/** The audience rule: which of those posts this viewer may see. */
export function audienceFilter(v: Viewer): Filter<Post> {
  if (v.staff) return {};
  return {
    $or: [
      { 'audience.type': 'college' },
      ...(v.departmentId ? [{ 'audience.type': 'department' as const, 'audience.departmentId': v.departmentId }] : []),
      ...(v.year ? [{ 'audience.type': 'year' as const, 'audience.year': v.year }] : []),
      ...(v.year && v.division ? [{ 'audience.type': 'division' as const, 'audience.year': v.year, 'audience.division': v.division }] : []),
      ...(v.spaceIds.length ? [{ 'audience.type': 'space' as const, 'audience.spaceId': { $in: v.spaceIds } }] : []),
      { authorId: v.auth.userId },
      ...(v.myAnonymousPostIds.length ? [{ _id: { $in: v.myAnonymousPostIds } }] : []),
    ],
  };
}

export function visibleFilter(v: Viewer): Filter<Post> {
  return { $and: [baseFilter(v), audienceFilter(v)] };
}

export interface PostView {
  id: string;
  kind: string;
  body: string;
  tags: string[];
  author: PersonSummary | null;
  anonymous: boolean;
  isMine: boolean;
  audience: { type: string; departmentId: string | null; department: string | null; year: number | null; division: string | null; space: { id: string; name: string; slug: string } | null };
  attachments: FileView[];
  poll: { options: Array<{ id: string; label: string; votes: number }>; totalVotes: number; myVote: string | null } | null;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  liked: boolean;
  saved: boolean;
  pinned: boolean;
  createdAt: string;
}

/** Turns posts into API views, loading authors, files, polls and my likes/saves in bulk. */
export async function toPostViews(deps: Deps, viewerId: string, posts: Post[]): Promise<PostView[]> {
  if (!posts.length) return [];
  const db = deps.db;
  const ids = posts.map((p) => p._id);
  const [people, files, liked, saved, votes, mine, spaces, departments] = await Promise.all([
    loadPeople(deps, posts.map((p) => p.authorId)),
    loadFileViews(deps, posts.flatMap((p) => p.attachmentIds)),
    db.col('post_likes').find({ _id: { $in: ids.map((i) => `${i}:${viewerId}`) } }, { projection: { postId: 1 } }).toArray(),
    db.col('saved_items').find({ _id: { $in: ids.map((i) => `${viewerId}:post:${i}`) } }, { projection: { itemId: 1 } }).toArray(),
    db.col('poll_votes').find({ _id: { $in: posts.filter((p) => p.poll).map((p) => `${p._id}:${viewerId}`) } }, { projection: { postId: 1, optionId: 1 } }).toArray(),
    db.col('anonymous_authors').find({ _id: { $in: posts.filter((p) => p.isAnonymous).map((p) => `post:${p._id}`) }, userId: viewerId }, { projection: { contentId: 1 } }).toArray(),
    db.col('spaces').find({ _id: { $in: posts.map((p) => p.audience.spaceId).filter((x): x is string => Boolean(x)) } }, { projection: { name: 1, slug: 1 } }).toArray(),
    departmentNames(db, posts.map((p) => p.audience.departmentId)),
  ]);
  const likedSet = new Set(liked.map((l) => l.postId));
  const savedSet = new Set(saved.map((s) => s.itemId));
  const mineSet = new Set(mine.map((m) => m.contentId));
  const voteBy = new Map(votes.map((v) => [v.postId, v.optionId]));
  const spaceBy = new Map(spaces.map((s) => [s._id, s]));

  return posts.map((p) => {
    const space = p.audience.spaceId ? spaceBy.get(p.audience.spaceId) : undefined;
    return {
      id: p._id,
      kind: p.kind,
      body: p.body,
      tags: p.tags,
      author: p.isAnonymous ? null : (people.get(p.authorId ?? '') ?? null),
      anonymous: p.isAnonymous,
      isMine: p.authorId === viewerId || mineSet.has(p._id),
      audience: {
        type: p.audience.type,
        departmentId: p.audience.departmentId,
        department: p.audience.departmentId ? (departments.get(p.audience.departmentId) ?? null) : null,
        year: p.audience.year,
        division: p.audience.division,
        space: space ? { id: space._id, name: space.name, slug: space.slug } : null,
      },
      attachments: p.attachmentIds.map((id) => files.get(id)).filter((f): f is FileView => Boolean(f)),
      poll: p.poll ? { options: p.poll.options, totalVotes: p.poll.totalVotes, myVote: voteBy.get(p._id) ?? null } : null,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
      savesCount: p.savesCount,
      liked: likedSet.has(p._id),
      saved: savedSet.has(p._id),
      pinned: p.isPinned,
      createdAt: p.createdAt.toISOString(),
    };
  });
}

/** The real author of a post (also for anonymous posts, via the vault). For notifications only. */
export async function postOwner(deps: Deps, postId: string): Promise<string | null> {
  const post = await deps.db.col('posts').findOne({ _id: postId }, { projection: { authorId: 1 } });
  if (!post) return null;
  if (post.authorId) return post.authorId;
  const vault = await deps.db.col('anonymous_authors').findOne({ _id: `post:${postId}` }, { projection: { userId: 1 } });
  return vault?.userId ?? null;
}

/** Usernames mentioned as @name in a text (at most 10). */
export function mentionsIn(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/(?:^|[^A-Za-z0-9._])@([A-Za-z0-9._]{3,24})/g)) {
    names.add(m[1]!.toLowerCase());
    if (names.size >= 10) break;
  }
  return [...names];
}

export async function notifyMentions(deps: Deps, auth: AuthContext, text: string, link: string, entity: { type: string; id: string }, exclude: string[] = []): Promise<void> {
  const names = mentionsIn(text);
  if (!names.length) return;
  const rows = await deps.db.col('users').find({ collegeId: auth.collegeId, 'profile.usernameLower': { $in: names } }, { projection: { _id: 1 } }).toArray();
  await deps.notifier.send(
    rows
      .filter((r) => !exclude.includes(r._id))
      .map((r) => ({ userId: r._id, kind: 'mention' as const, title: `${auth.displayName} mentioned you`, body: text.slice(0, 140), link, actorId: auth.userId, entityType: entity.type, entityId: entity.id })),
  );
}
