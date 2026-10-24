import { createHash } from 'node:crypto';
import { audit } from '../../core/audit.js';
import type { Deps } from '../../deps.js';
import { uuidv7 } from '../../infra/db/ids.js';

// Data rights: the personal data export and the permanent deletion that runs when the 30-day
// grace period ends.
//
// Deletion removes the person's history, not just the account:
//   * posts, anonymous posts, Hush questions and answers, listings, lost & found reports,
//     Shelf uploads, lectures, feedback, survey answers and every uploaded file (bytes
//     included) are deleted
//   * comments, discussion replies and chat messages they sent become "[deleted]" placeholders,
//     so other people's conversations still make sense but nothing of theirs remains
//   * sessions, follows, likes, votes, RSVPs, applications, saved items, notifications,
//     memberships, consents, sign-in history and queued emails are removed
// Kept, with no link to the person: the audit trail (ids only, needed for security) and
// moderation records about reports they made. Events and opportunities they organised for the
// college stay, without their name.

export const DELETION_GRACE_DAYS = 30;
export const EXPORT_TTL_DAYS = 7;

const strip = <T extends Record<string, unknown>>(rows: T[], keys: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))));

/** Builds the export JSON for one person. */
export async function buildExport(deps: Deps, userId: string): Promise<Record<string, unknown>> {
  const db = deps.db;
  const vault = async (type: 'post' | 'comment' | 'hush_question' | 'hush_answer') =>
    (await db.col('anonymous_authors').find({ userId, contentType: type }, { projection: { contentId: 1 } }).toArray()).map((a) => a.contentId);
  const [anonPosts, anonComments, anonQuestions, anonAnswers] = await Promise.all([vault('post'), vault('comment'), vault('hush_question'), vault('hush_answer')]);
  const user = await db.col('users').findOne({ _id: userId });
  const usernames = async (ids: string[]) => {
    const rows = await db.col('users').find({ _id: { $in: ids } }, { projection: { 'profile.username': 1 } }).toArray();
    return new Map(rows.map((r) => [r._id, r.profile.username]));
  };
  const [following, followers, blocks] = await Promise.all([
    db.col('follows').find({ followerId: userId }).toArray(),
    db.col('follows').find({ followeeId: userId }).toArray(),
    db.col('blocks').find({ blockerId: userId }).toArray(),
  ]);
  const names = await usernames([...following.map((f) => f.followeeId), ...followers.map((f) => f.followerId), ...blocks.map((b) => b.blockedId)]);
  const rsvps = await db.col('event_rsvps').find({ userId }).toArray();
  const eventTitles = new Map((await db.col('events').find({ _id: { $in: rsvps.map((r) => r.eventId) } }, { projection: { title: 1 } }).toArray()).map((e) => [e._id, e.title]));
  const applications = await db.col('applications').find({ userId }).toArray();
  const oppTitles = new Map((await db.col('opportunities').find({ _id: { $in: applications.map((a) => a.opportunityId) } }, { projection: { title: 1, orgName: 1 } }).toArray()).map((o) => [o._id, `${o.title} (${o.orgName})`]));

  return {
    exportedAt: new Date().toISOString(),
    format: 'CampusConnect personal data export, version 2',
    account: user
      ? { id: user._id, email: user.email, role: user.role, pendingRole: user.pendingRole, status: user.status, emailVerifiedAt: user.emailVerifiedAt, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, termsVersion: user.termsVersion, termsAcceptedAt: user.termsAcceptedAt, deletionScheduledFor: user.deletionScheduledFor, roleInfo: user.roleInfo }
      : null,
    profile: user?.profile ?? null,
    settings: user?.settings ?? null,
    notificationPreferences: user?.notificationPrefs ?? null,
    consents: strip(await db.col('consents').find({ userId }).sort({ createdAt: 1 }).toArray(), ['ipHash', 'userId']),
    posts: strip(await db.col('posts').find({ $or: [{ authorId: userId }, { _id: { $in: anonPosts } }] }).sort({ createdAt: 1 }).toArray(), ['collegeId']),
    comments: strip(await db.col('comments').find({ $or: [{ authorId: userId }, { _id: { $in: anonComments } }] }).sort({ createdAt: 1 }).toArray(), []),
    discussions: strip(await db.col('discussions').find({ authorId: userId }).sort({ createdAt: 1 }).toArray(), ['collegeId']),
    discussionReplies: await db.col('discussion_replies').find({ authorId: userId }).sort({ createdAt: 1 }).toArray(),
    hushQuestions: strip(await db.col('hush_questions').find({ $or: [{ authorId: userId }, { _id: { $in: anonQuestions } }] }).toArray(), ['collegeId']),
    hushAnswers: strip(await db.col('hush_answers').find({ $or: [{ authorId: userId }, { _id: { $in: anonAnswers } }] }).toArray(), ['collegeId']),
    messagesSent: (await db.col('messages').find({ senderId: userId, deletedAt: null }).sort({ createdAt: 1 }).toArray()).map((m) => ({ id: m._id, chatId: m.chatId, kind: m.kind, body: m.body, createdAt: m.createdAt })),
    chats: await db.col('chat_members').find({ userId }, { projection: { chatId: 1, role: 1, joinedAt: 1 } }).toArray(),
    spaces: await db.col('space_members').find({ userId }, { projection: { spaceId: 1, role: 1, status: 1, joinedAt: 1 } }).toArray(),
    following: following.map((f) => ({ username: names.get(f.followeeId) ?? null, since: f.createdAt })),
    followers: followers.map((f) => ({ username: names.get(f.followerId) ?? null, since: f.createdAt })),
    blocked: blocks.map((b) => ({ username: names.get(b.blockedId) ?? null, since: b.createdAt })),
    eventRsvps: rsvps.map((r) => ({ event: eventTitles.get(r.eventId) ?? null, status: r.status, checkedInAt: r.checkedInAt, createdAt: r.createdAt })),
    applications: applications.map((a) => ({ opportunity: oppTitles.get(a.opportunityId) ?? null, stage: a.stage, note: a.note, createdAt: a.createdAt, updatedAt: a.updatedAt })),
    saved: await db.col('saved_items').find({ userId }, { projection: { itemType: 1, itemId: 1, createdAt: 1 } }).toArray(),
    listings: strip(await db.col('listings').find({ sellerId: userId }).toArray(), ['collegeId']),
    lostAndFound: strip(await db.col('lost_found_items').find({ reporterId: userId }).toArray(), ['collegeId']),
    shelfUploads: (await db.col('resources').find({ uploaderId: userId }).toArray()).map((r) => ({ id: r._id, title: r.title, kind: r.kind, subject: r.subject, status: r.status, createdAt: r.createdAt })),
    feedback: strip(await db.col('feedback').find({ userId }).toArray(), ['collegeId', 'userId']),
    surveyAnswers: strip(await db.col('survey_responses').find({ userId }).toArray(), ['collegeId', 'userId']),
    files: (await db.col('files').find({ ownerId: userId, deletedAt: null }).toArray()).map((f) => ({ id: f._id, purpose: f.purpose, name: f.originalName, mimeType: f.mimeType, size: f.sizeBytes, createdAt: f.createdAt })),
    devices: (await db.col('sessions').find({ userId }).sort({ createdAt: -1 }).toArray()).map((s) => ({ kind: s.kind, device: s.deviceLabel, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, revokedAt: s.revokedAt })),
    signInHistory: (await db.col('login_attempts').find({ userId }).sort({ createdAt: -1 }).limit(500).toArray()).map((a) => ({ success: a.success, reason: a.reason, at: a.createdAt })),
    notifications: (await db.col('notifications').find({ userId }).sort({ createdAt: -1 }).limit(2000).toArray()).map((n) => ({ kind: n.kind, title: n.title, body: n.body, createdAt: n.createdAt, readAt: n.readAt })),
  };
}

/** Stores an export as a private, expiring file and marks the request complete. */
export async function completeExport(deps: Deps, requestId: string, userId: string, collegeId: string): Promise<string> {
  const data = await buildExport(deps, userId);
  const body = Buffer.from(JSON.stringify(data, null, 2));
  const id = uuidv7();
  const key = `${collegeId}/export/${new Date().getUTCFullYear()}/${id}`;
  await deps.storage.put(key, body, 'application/json');
  const now = new Date();
  await deps.db.tx(async (session) => {
    await deps.db.col('files').insertOne(
      {
        _id: id,
        collegeId,
        ownerId: userId,
        purpose: 'export',
        visibility: 'private',
        storageDriver: deps.storage.driverName as 'local' | 's3',
        storageKey: key,
        originalName: `campusconnect-data-${now.toISOString().slice(0, 10)}.json`,
        mimeType: 'application/json',
        sizeBytes: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
        kind: 'document',
        status: 'ready',
        width: null,
        height: null,
        hasThumbnail: false,
        scanResult: 'generated',
        expiresAt: new Date(now.getTime() + EXPORT_TTL_DAYS * 86_400_000),
        createdAt: now,
        deletedAt: null,
      },
      { session },
    );
    await deps.db.col('data_requests').updateOne({ _id: requestId }, { $set: { status: 'completed', isActive: false, completedAt: now, resultFileId: id, updatedAt: now } }, { session });
  });
  return id;
}

/** Permanently removes one person and their history. Returns false if nothing was due. */
export async function purgeAccount(deps: Deps, userId: string): Promise<boolean> {
  const db = deps.db;
  const now = new Date();
  // Claim the account first, so two workers never purge the same person at once.
  const u = await db.col('users').findOneAndUpdate(
    { _id: userId, deletionScheduledFor: { $lte: now }, status: { $ne: 'deleted' } },
    { $set: { status: 'deleted', updatedAt: now } },
    { projection: { email: 1, collegeId: 1, 'profile.displayName': 1 } },
  );
  if (!u) return false;
  const email = u.email;
  const vaultIds = async (type: 'post' | 'comment' | 'hush_question' | 'hush_answer') =>
    (await db.col('anonymous_authors').find({ userId, contentType: type }, { projection: { contentId: 1 } }).toArray()).map((a) => a.contentId);
  const [anonPosts, anonComments, anonQuestions, anonAnswers] = await Promise.all([vaultIds('post'), vaultIds('comment'), vaultIds('hush_question'), vaultIds('hush_answer')]);

  // Content they created. Comments and likes on their posts go with the posts.
  const postIds = (await db.col('posts').find({ $or: [{ authorId: userId }, { _id: { $in: anonPosts } }] }, { projection: { _id: 1 } }).toArray()).map((p) => p._id);
  await Promise.all([
    db.col('comments').deleteMany({ postId: { $in: postIds } }),
    db.col('post_likes').deleteMany({ postId: { $in: postIds } }),
    db.col('post_views').deleteMany({ postId: { $in: postIds } }),
    db.col('poll_votes').deleteMany({ postId: { $in: postIds } }),
    db.col('saved_items').deleteMany({ itemType: 'post', itemId: { $in: postIds } }),
  ]);
  await db.col('posts').deleteMany({ _id: { $in: postIds } });
  const questionIds = (await db.col('hush_questions').find({ $or: [{ authorId: userId }, { _id: { $in: anonQuestions } }] }, { projection: { _id: 1 } }).toArray()).map((h) => h._id);
  await db.col('hush_answers').deleteMany({ $or: [{ authorId: userId }, { _id: { $in: anonAnswers } }, { questionId: { $in: questionIds } }] });
  await db.col('hush_questions').deleteMany({ _id: { $in: questionIds } });
  await Promise.all([
    db.col('lectures').deleteMany({ teacherId: userId }),
    db.col('resources').deleteMany({ uploaderId: userId }),
    db.col('lost_found_items').deleteMany({ reporterId: userId }),
    db.col('lost_found_claims').deleteMany({ claimantId: userId }),
    db.col('listings').deleteMany({ sellerId: userId }),
    db.col('feedback').deleteMany({ userId }),
    db.col('survey_responses').deleteMany({ userId }),
  ]);

  // Replies inside other people's conversations become placeholders.
  const stamp = { deletedAt: now, updatedAt: now };
  await Promise.all([
    db.col('comments').updateMany({ $or: [{ authorId: userId }, { _id: { $in: anonComments } }] }, { $set: { body: '[deleted]', authorId: null, isAnonymous: false, ...stamp } }),
    db.col('discussion_replies').updateMany({ authorId: userId }, { $set: { body: '[deleted]', authorId: null, ...stamp } }),
    db.col('discussions').updateMany({ authorId: userId }, { $set: { title: '[deleted discussion]', body: '', authorId: null, ...stamp } }),
    db.col('messages').updateMany({ senderId: userId }, { $set: { body: null, payload: {}, fileId: null, senderId: null, clientId: null, deletedAt: now } }),
    db.col('events').updateMany({ createdBy: userId }, { $set: { createdBy: null } }),
    db.col('opportunities').updateMany({ postedBy: userId }, { $set: { postedBy: null } }),
    db.col('announcements').updateMany({ authorId: userId }, { $set: { authorId: null } }),
    db.col('spaces').updateMany({ createdBy: userId }, { $set: { createdBy: null } }),
    db.col('subjects').updateMany({ createdBy: userId }, { $set: { createdBy: null } }),
  ]);

  // Every file they uploaded, bytes included.
  const files = await db.col('files').find({ ownerId: userId }, { projection: { storageKey: 1, hasThumbnail: 1 } }).toArray();
  for (const f of files) {
    await deps.storage.delete(f.storageKey).catch(() => undefined);
    if (f.hasThumbnail) await deps.storage.delete(`${f.storageKey}.thumb.webp`).catch(() => undefined);
  }
  await db.col('files').deleteMany({ ownerId: userId });

  // Relationships and personal records. Counters on the other side are kept accurate.
  const [follows, followed] = await Promise.all([db.col('follows').find({ followerId: userId }).toArray(), db.col('follows').find({ followeeId: userId }).toArray()]);
  if (follows.length) await db.col('users').updateMany({ _id: { $in: follows.map((f) => f.followeeId) }, 'profile.followersCount': { $gt: 0 } }, { $inc: { 'profile.followersCount': -1 } });
  if (followed.length) await db.col('users').updateMany({ _id: { $in: followed.map((f) => f.followerId) }, 'profile.followingCount': { $gt: 0 } }, { $inc: { 'profile.followingCount': -1 } });
  const going = await db.col('event_rsvps').find({ userId, checkedInAt: null }).toArray();
  for (const r of going) await db.col('events').updateOne({ _id: r.eventId }, { $inc: r.status === 'going' ? { goingCount: -1 } : { interestedCount: -1 } });
  const memberships = await db.col('space_members').find({ userId, status: 'active' }, { projection: { spaceId: 1 } }).toArray();
  if (memberships.length) await db.col('spaces').updateMany({ _id: { $in: memberships.map((m) => m.spaceId) }, membersCount: { $gt: 0 } }, { $inc: { membersCount: -1 } });
  await Promise.all([
    db.col('follows').deleteMany({ $or: [{ followerId: userId }, { followeeId: userId }] }),
    db.col('blocks').deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
    db.col('sessions').deleteMany({ userId }),
    db.col('push_tokens').deleteMany({ userId }),
    db.col('post_likes').deleteMany({ userId }),
    db.col('post_views').deleteMany({ userId }),
    db.col('statuses').deleteMany({ userId }),
    db.col('status_views').deleteMany({ $or: [{ viewerId: userId }, { ownerId: userId }] }),
    db.col('poll_votes').deleteMany({ userId }),
    db.col('votes').deleteMany({ userId }),
    db.col('event_rsvps').deleteMany({ userId }),
    db.col('applications').deleteMany({ userId }),
    db.col('saved_items').deleteMany({ userId }),
    db.col('notifications').deleteMany({ $or: [{ userId }, { actorId: userId }] }),
    db.col('space_members').deleteMany({ userId }),
    db.col('chat_members').deleteMany({ userId }),
    db.col('message_reactions').deleteMany({ userId }),
    db.col('message_responses').deleteMany({ userId }),
    db.col('message_views').deleteMany({ userId }),
    db.col('resource_ratings').deleteMany({ userId }),
    db.col('verification_requests').deleteMany({ userId }),
    db.col('anonymous_authors').deleteMany({ userId }),
    db.col('email_tokens').deleteMany({ $or: [{ userId }, { email }] }),
    db.col('login_attempts').deleteMany({ $or: [{ userId }, { email }] }),
    db.col('consents').deleteMany({ userId }),
    db.col('contact_messages').deleteMany({ $or: [{ userId }, { email }] }),
    db.col('email_outbox').deleteMany({ $or: [{ userId }, { toEmail: email }] }),
    db.col('email_suppressions').deleteMany({ email }),
  ]);
  // Proof that the request was honoured, without the address itself.
  const hashed = `deleted-${createHash('sha256').update(email).digest('hex').slice(0, 24)}@deleted.invalid`;
  await db.col('data_requests').updateMany(
    { $or: [{ userId }, { email }] },
    [{ $set: { email: hashed, userId: null, isActive: false, status: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, 'completed', '$status'] }, completedAt: { $ifNull: ['$completedAt', '$$NOW'] }, updatedAt: '$$NOW' } }],
  );

  // The account itself. The goodbye email is queued last, after the address was scrubbed from
  // everything else (it is sent once and then removed by the mail job's retention).
  await db.col('users').deleteOne({ _id: userId });
  await deps.mailer.enqueue({ to: email, template: 'account_deleted', category: 'transactional', payload: { name: u.profile.displayName?.split(' ')[0] ?? 'there' } });
  await audit(db, { action: 'account.deleted', collegeId: u.collegeId, entityType: 'user', entityId: userId, meta: { reason: 'grace_period_ended' } });
  return true;
}
