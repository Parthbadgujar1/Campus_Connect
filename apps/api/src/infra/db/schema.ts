import type { CreateIndexesOptions, Document, IndexSpecification } from 'mongodb';
import type { CollectionName } from './models.js';

// Server-side validation rules and indexes for every collection.
//
// Validators run inside MongoDB on every insert and update (validationLevel strict), so data that
// breaks a rule is rejected no matter which code path wrote it. They combine $jsonSchema (types,
// required fields, enums, lengths, ranges) with $expr for rules across fields (for example,
// an event's goingCount can never exceed its capacity; anonymous content never stores an author).
//
// Index design notes:
//   * collegeId comes first in feed/board indexes: every list query is per college
//   * (createdAt desc, _id desc) pairs back keyset ("cursor") pagination
//   * unique indexes enforce one-per-person rules (one vote, one RSVP, one open report)
//   * TTL indexes (expireAfterSeconds) delete expired sessions, tokens, sign-in history,
//     notifications and audit entries automatically: retention needs no cron job
//   * partialFilterExpression keeps indexes small (only pending items, only open reports...)

// ---------------------------------------------------------------- tiny schema DSL
type J = Document;
const nullable = (t: string | string[]) => (Array.isArray(t) ? [...t, 'null'] : [t, 'null']);
const str = (o: { min?: number; max?: number; pattern?: string; enum?: readonly string[]; nullable?: boolean } = {}): J => ({
  bsonType: o.nullable ? nullable('string') : 'string',
  ...(o.min !== undefined && { minLength: o.min }),
  ...(o.max !== undefined && { maxLength: o.max }),
  ...(o.pattern && { pattern: o.pattern }),
  ...(o.enum && { enum: o.nullable ? [...o.enum, null] : [...o.enum] }),
});
const num = (o: { min?: number; max?: number; nullable?: boolean } = {}): J => ({
  bsonType: o.nullable ? nullable(['int', 'long', 'double']) : ['int', 'long', 'double'],
  ...(o.min !== undefined && { minimum: o.min }),
  ...(o.max !== undefined && { maximum: o.max }),
});
const date = (o: { nullable?: boolean } = {}): J => ({ bsonType: o.nullable ? nullable('date') : 'date' });
const bool = (): J => ({ bsonType: 'bool' });
const arr = (items: J, max?: number): J => ({ bsonType: 'array', items, ...(max !== undefined && { maxItems: max }) });
const obj = (properties: Record<string, J> = {}, required: string[] = []): J => ({ bsonType: 'object', properties, ...(required.length && { required }) });
const id = (o: { nullable?: boolean } = {}) => str({ min: 1, max: 120, nullable: o.nullable });
const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const uuid = (o: { nullable?: boolean } = {}) => str({ pattern: UUID, nullable: o.nullable });

const ROLES = ['student', 'faculty', 'expert', 'moderator', 'admin'] as const;
const CONTENT = ['published', 'hidden', 'removed'] as const;

export interface CollectionSpec {
  name: CollectionName;
  validator?: Document;
  indexes: Array<{ key: IndexSpecification; options?: CreateIndexesOptions }>;
}

const DAY = 86_400;

export const SCHEMA: CollectionSpec[] = [
  // ------------------------------------------------------------ identity
  {
    name: 'colleges',
    validator: {
      $jsonSchema: obj(
        {
          _id: uuid(), slug: str({ pattern: '^[a-z0-9-]{2,40}$' }), name: str({ min: 2, max: 160 }), shortName: str({ min: 2, max: 40 }),
          status: str({ enum: ['active', 'suspended'] }), shard: str({ pattern: '^[a-z0-9_-]{1,32}$' }),
          domains: arr(obj({ domain: str({ pattern: '^[a-z0-9.-]+\\.[a-z]{2,}$' }), allowsRoles: arr(str({ enum: ROLES })) }, ['domain', 'allowsRoles']), 50),
        },
        ['_id', 'slug', 'name', 'shortName', 'status', 'domains', 'createdAt'],
      ),
    },
    indexes: [
      { key: { slug: 1 }, options: { unique: true } },
      // Unique among colleges that list email domains (colleges without any are fine).
      { key: { 'domains.domain': 1 }, options: { unique: true, name: 'college_email_domain', partialFilterExpression: { 'domains.domain': { $exists: true } } } },
    ],
  },
  {
    name: 'departments',
    validator: { $jsonSchema: obj({ _id: uuid(), collegeId: uuid(), code: str({ pattern: '^[A-Z0-9]{2,12}$' }), name: str({ min: 2, max: 120 }) }, ['_id', 'collegeId', 'code', 'name']) },
    indexes: [{ key: { collegeId: 1, code: 1 }, options: { unique: true } }, { key: { collegeId: 1, name: 1 } }],
  },
  {
    name: 'users',
    validator: {
      $jsonSchema: obj(
        {
          _id: uuid(), collegeId: uuid(), email: str({ min: 6, max: 254, pattern: '^[^A-Z\\s]+@[^A-Z\\s]+$' }),
          role: str({ enum: ROLES }), status: str({ enum: ['pending', 'active', 'suspended', 'deleted'] }),
          failedLoginCount: num({ min: 0 }), passwordHash: str({ nullable: true, max: 400 }),
          roleInfo: obj({ enrollmentNumber: str({ nullable: true, max: 40 }), employeeId: str({ nullable: true, max: 40 }), designation: str({ nullable: true, max: 120 }), organization: str({ nullable: true, max: 160 }) }),
          profile: obj(
            {
              username: str({ pattern: '^[A-Za-z0-9._]{3,24}$' }), usernameLower: str({ pattern: '^[a-z0-9._]{3,24}$' }), displayName: str({ min: 2, max: 80 }),
              headline: str({ nullable: true, max: 120 }), bio: str({ nullable: true, max: 300 }), year: num({ min: 1, max: 6, nullable: true }),
              semester: num({ min: 1, max: 12, nullable: true }), division: str({ nullable: true, max: 8 }), skills: arr(str({ max: 40 }), 30), interests: arr(str({ max: 40 }), 30),
              messagePrivacy: str({ enum: ['everyone', 'connections', 'nobody'] }), followersCount: num({ min: 0 }), followingCount: num({ min: 0 }), postsCount: num({ min: 0 }),
            },
            ['username', 'usernameLower', 'displayName', 'skills', 'interests', 'followersCount', 'followingCount'],
          ),
          settings: obj({ theme: str({ enum: ['system', 'pro', 'day', 'night', 'paper'] }), font: str({ enum: ['pro', 'handwritten', 'classic', 'system', 'readable'] }), textSize: str({ enum: ['sm', 'md', 'lg'] }), seen: arr(str({ max: 80 }), 500) }),
          notificationPrefs: obj({ emailDigest: str({ enum: ['off', 'daily', 'weekly'] }), marketingEmails: bool() }),
        },
        ['_id', 'collegeId', 'email', 'role', 'status', 'profile', 'settings', 'notificationPrefs', 'createdAt'],
      ),
    },
    indexes: [
      { key: { email: 1 }, options: { unique: true } },
      { key: { 'profile.usernameLower': 1 }, options: { unique: true } },
      { key: { collegeId: 1, role: 1, status: 1 } },
      { key: { collegeId: 1, 'profile.displayName': 1, _id: 1 } },
      { key: { collegeId: 1, createdAt: -1, _id: -1 } },
      { key: { 'profile.displayName': 'text', 'profile.username': 'text', 'profile.skills': 'text', 'profile.headline': 'text' }, options: { name: 'people_text', weights: { 'profile.displayName': 5, 'profile.username': 5, 'profile.skills': 2, 'profile.headline': 1 } } },
      { key: { deletionScheduledFor: 1 }, options: { partialFilterExpression: { deletionScheduledFor: { $type: 'date' } } } },
      { key: { status: 1, createdAt: 1 }, options: { partialFilterExpression: { status: 'pending' } } },
    ],
  },
  {
    name: 'sessions',
    validator: { $jsonSchema: obj({ _id: uuid(), userId: uuid(), tokenHash: str({ pattern: '^[0-9a-f]{64}$' }), kind: str({ enum: ['web', 'mobile'] }), expireAt: date() }, ['_id', 'userId', 'tokenHash', 'kind', 'idleExpiresAt', 'absoluteExpiresAt', 'expireAt']) },
    indexes: [
      { key: { tokenHash: 1 }, options: { unique: true } },
      { key: { userId: 1, lastSeenAt: -1 } },
      { key: { expireAt: 1 }, options: { expireAfterSeconds: 0 } },
    ],
  },
  {
    name: 'email_tokens',
    validator: { $jsonSchema: obj({ _id: uuid(), email: str(), purpose: str({ enum: ['verify_email', 'reset_password', 'data_request'] }), tokenHash: str({ pattern: '^[0-9a-f]{64}$' }), expireAt: date() }, ['_id', 'email', 'purpose', 'tokenHash', 'expiresAt', 'expireAt']) },
    indexes: [
      { key: { tokenHash: 1 }, options: { unique: true } },
      { key: { email: 1, purpose: 1 }, options: { partialFilterExpression: { consumedAt: null } } },
      { key: { expireAt: 1 }, options: { expireAfterSeconds: 0 } },
    ],
  },
  {
    name: 'login_attempts',
    indexes: [
      { key: { email: 1, createdAt: -1 } },
      { key: { ipHash: 1, createdAt: -1 } },
      { key: { userId: 1, createdAt: -1 } },
      { key: { createdAt: 1 }, options: { expireAfterSeconds: 30 * DAY } },
    ],
  },
  {
    name: 'consents',
    validator: {
      $and: [
        { $jsonSchema: obj({ purpose: str({ enum: ['necessary', 'preferences', 'analytics', 'marketing', 'terms', 'privacy', 'marketing_email', 'contact'] }), granted: bool(), policyVersion: str({ max: 32 }), source: str({ enum: ['banner', 'signup', 'settings', 'contact', 'data_request'] }) }, ['purpose', 'granted', 'policyVersion', 'source', 'createdAt']) },
        { $expr: { $or: [{ $ne: ['$userId', null] }, { $ne: ['$anonymousId', null] }] } },
      ],
    },
    indexes: [{ key: { userId: 1, purpose: 1, createdAt: -1 } }, { key: { anonymousId: 1, createdAt: -1 } }],
  },
  {
    name: 'follows',
    validator: { $and: [{ $jsonSchema: obj({ followerId: uuid(), followeeId: uuid() }, ['followerId', 'followeeId', 'createdAt']) }, { $expr: { $ne: ['$followerId', '$followeeId'] } }] },
    indexes: [{ key: { followeeId: 1, createdAt: -1 } }, { key: { followerId: 1, createdAt: -1 } }],
  },
  {
    name: 'blocks',
    validator: { $and: [{ $jsonSchema: obj({ blockerId: uuid(), blockedId: uuid() }, ['blockerId', 'blockedId', 'createdAt']) }, { $expr: { $ne: ['$blockerId', '$blockedId'] } }] },
    indexes: [{ key: { blockerId: 1, createdAt: -1 } }, { key: { blockedId: 1 } }],
  },
  { name: 'push_tokens', indexes: [{ key: { token: 1 }, options: { unique: true } }, { key: { userId: 1 } }] },
  {
    name: 'verification_requests',
    validator: { $jsonSchema: obj({ kind: str({ enum: ['student_id', 'faculty_role', 'expert_role'] }), status: str({ enum: ['pending', 'approved', 'rejected', 'cancelled'] }) }, ['collegeId', 'userId', 'kind', 'status', 'createdAt']) },
    indexes: [
      { key: { userId: 1, kind: 1 }, options: { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_per_kind' } },
      { key: { collegeId: 1, status: 1, createdAt: 1 } },
    ],
  },
  {
    name: 'files',
    validator: {
      $jsonSchema: obj(
        {
          purpose: str({ enum: ['avatar', 'post', 'message', 'resource', 'listing', 'lost_found', 'verification', 'lecture', 'event', 'export', 'other'] }),
          visibility: str({ enum: ['public', 'campus', 'private'] }), storageDriver: str({ enum: ['local', 's3'] }), storageKey: str({ max: 400 }),
          originalName: str({ min: 1, max: 255 }), sizeBytes: num({ min: 1, max: 5_368_709_120 }), sha256: str({ pattern: '^[0-9a-f]{64}$' }),
          kind: str({ enum: ['image', 'video', 'audio', 'document', 'archive', 'other'] }), status: str({ enum: ['pending', 'ready', 'quarantined', 'deleted'] }),
        },
        ['collegeId', 'purpose', 'visibility', 'storageKey', 'originalName', 'mimeType', 'sizeBytes', 'kind', 'status', 'createdAt'],
      ),
    },
    indexes: [
      { key: { storageKey: 1 }, options: { unique: true } },
      { key: { ownerId: 1, createdAt: -1 } },
      { key: { status: 1, createdAt: 1 }, options: { partialFilterExpression: { status: { $in: ['pending', 'deleted'] } } } },
      { key: { expiresAt: 1 }, options: { partialFilterExpression: { expiresAt: { $type: 'date' } } } },
    ],
  },

  // ------------------------------------------------------------ communities
  {
    name: 'spaces',
    validator: { $jsonSchema: obj({ slug: str({ pattern: '^[a-z0-9-]{2,48}$' }), name: str({ min: 2, max: 80 }), kind: str({ enum: ['club', 'interest', 'department', 'exam', 'hostel', 'city', 'class'] }), privacy: str({ enum: ['public', 'private'] }), description: str({ max: 600 }), membersCount: num({ min: 0 }), status: str({ enum: ['pending', 'active', 'archived', 'removed'] }), tags: arr(str(), 10) }, ['collegeId', 'slug', 'name', 'kind', 'privacy', 'status', 'membersCount', 'createdAt']) },
    indexes: [
      { key: { collegeId: 1, slug: 1 }, options: { unique: true } },
      { key: { collegeId: 1, status: 1, membersCount: -1, _id: -1 } },
      { key: { name: 'text', description: 'text', tags: 'text' }, options: { name: 'spaces_text', weights: { name: 5, tags: 3, description: 1 } } },
    ],
  },
  {
    name: 'space_members',
    validator: { $jsonSchema: obj({ role: str({ enum: ['owner', 'moderator', 'member'] }), status: str({ enum: ['active', 'pending', 'banned'] }) }, ['spaceId', 'userId', 'role', 'status', 'joinedAt']) },
    indexes: [{ key: { userId: 1, status: 1 } }, { key: { spaceId: 1, status: 1, joinedAt: 1 } }],
  },
  {
    name: 'discussions',
    validator: { $jsonSchema: obj({ title: str({ min: 5, max: 200 }), body: str({ max: 10_000 }), flair: str({ min: 1, max: 24 }), repliesCount: num({ min: 0 }), status: str({ enum: CONTENT }) }, ['collegeId', 'spaceId', 'title', 'body', 'flair', 'score', 'repliesCount', 'status', 'createdAt']) },
    indexes: [
      { key: { spaceId: 1, status: 1, isPinned: -1, createdAt: -1, _id: -1 } },
      { key: { spaceId: 1, status: 1, score: -1, _id: -1 } },
      { key: { spaceId: 1, status: 1, lastActivityAt: -1, _id: -1 } },
      { key: { collegeId: 1, status: 1, createdAt: -1 } },
      { key: { authorId: 1, createdAt: -1 } },
      { key: { title: 'text', body: 'text' }, options: { name: 'discussions_text', weights: { title: 4, body: 1 } } },
    ],
  },
  {
    name: 'discussion_replies',
    validator: { $jsonSchema: obj({ body: str({ min: 1, max: 5000 }), depth: num({ min: 0, max: 8 }), status: str({ enum: CONTENT }) }, ['discussionId', 'body', 'depth', 'score', 'status', 'createdAt']) },
    indexes: [{ key: { discussionId: 1, createdAt: 1 } }, { key: { authorId: 1, createdAt: -1 } }],
  },
  {
    name: 'votes',
    validator: { $jsonSchema: obj({ targetType: str({ enum: ['discussion', 'discussion_reply', 'hush_question', 'hush_answer'] }), value: { enum: [1, -1] } }, ['userId', 'targetType', 'targetId', 'value']) },
    indexes: [{ key: { targetType: 1, targetId: 1 } }, { key: { userId: 1, targetType: 1 } }],
  },

  // ------------------------------------------------------------ feed
  {
    name: 'posts',
    validator: {
      $and: [
        {
          $jsonSchema: obj(
            {
              kind: str({ enum: ['post', 'question', 'poll', 'announcement'] }), body: str({ max: 5000 }), isAnonymous: bool(),
              audience: obj({ type: str({ enum: ['college', 'department', 'year', 'division', 'space'] }) }, ['type']),
              tags: arr(str({ max: 30 }), 10), attachmentIds: arr(uuid(), 10), likesCount: num({ min: 0 }), commentsCount: num({ min: 0 }), savesCount: num({ min: 0 }), viewsCount: num({ min: 0 }), status: str({ enum: CONTENT }),
            },
            ['collegeId', 'isAnonymous', 'kind', 'body', 'audience', 'tags', 'attachmentIds', 'likesCount', 'commentsCount', 'savesCount', 'status', 'createdAt'],
          ),
        },
        // Anonymous posts never store their author on the post itself.
        { $expr: { $or: [{ $eq: ['$isAnonymous', false] }, { $eq: ['$authorId', null] }] } },
      ],
    },
    indexes: [
      { key: { collegeId: 1, status: 1, createdAt: -1, _id: -1 } },
      { key: { authorId: 1, createdAt: -1 } },
      { key: { 'audience.spaceId': 1, createdAt: -1 }, options: { partialFilterExpression: { 'audience.type': 'space' } } },
      { key: { collegeId: 1, tags: 1, createdAt: -1 } },
      { key: { collegeId: 1, isPinned: 1, createdAt: -1 }, options: { partialFilterExpression: { isPinned: true } } },
      { key: { collegeId: 1, mediaKinds: 1, createdAt: -1 } },
      { key: { collegeId: 1, status: 1, likesCount: -1, _id: -1 } },
      { key: { body: 'text', tags: 'text' }, options: { name: 'posts_text', weights: { tags: 3, body: 1 } } },
    ],
  },
  { name: 'poll_votes', indexes: [{ key: { postId: 1, userId: 1 } }] },
  { name: 'post_likes', indexes: [{ key: { userId: 1, createdAt: -1 } }, { key: { postId: 1, createdAt: -1 } }] },
  { name: 'comment_likes', indexes: [{ key: { userId: 1, createdAt: -1 } }, { key: { commentId: 1, createdAt: -1 } }] },
  // One row per person who watched a video post, so each viewer is counted once.
  { name: 'post_views', indexes: [{ key: { userId: 1 } }, { key: { postId: 1 } }] },
  // Status updates and who saw them disappear 24 hours after posting (TTL on expiresAt).
  {
    name: 'statuses',
    validator: { $jsonSchema: obj({ collegeId: uuid(), userId: uuid(), kind: str({ enum: ['text', 'image', 'video'] }), text: str({ nullable: true, max: 700 }), caption: str({ nullable: true, max: 300 }), viewsCount: num({ min: 0 }), expiresAt: date() }, ['collegeId', 'userId', 'kind', 'viewsCount', 'createdAt', 'expiresAt']) },
    indexes: [
      { key: { collegeId: 1, userId: 1, expiresAt: 1 } },
      { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
    ],
  },
  {
    name: 'status_views',
    indexes: [
      { key: { statusId: 1, createdAt: -1 } },
      { key: { viewerId: 1 } },
      { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
    ],
  },
  {
    name: 'comments',
    validator: {
      $and: [
        { $jsonSchema: obj({ body: str({ min: 1, max: 2000 }), isAnonymous: bool(), status: str({ enum: CONTENT }) }, ['postId', 'body', 'isAnonymous', 'status', 'createdAt']) },
        { $expr: { $or: [{ $eq: ['$isAnonymous', false] }, { $eq: ['$authorId', null] }] } },
      ],
    },
    indexes: [{ key: { postId: 1, createdAt: 1, _id: 1 } }, { key: { authorId: 1, createdAt: -1 } }],
  },
  { name: 'saved_items', indexes: [{ key: { userId: 1, createdAt: -1, _id: -1 } }, { key: { itemType: 1, itemId: 1 } }] },

  // ------------------------------------------------------------ campus life
  {
    name: 'events',
    validator: {
      $and: [
        {
          $jsonSchema: obj(
            {
              title: str({ min: 3, max: 160 }), description: str({ max: 5000 }), venue: str({ min: 2, max: 160 }), capacity: num({ min: 1, max: 100_000 }),
              goingCount: num({ min: 0 }), interestedCount: num({ min: 0 }), status: str({ enum: ['draft', 'pending', 'published', 'cancelled', 'rejected'] }),
              onlineUrl: str({ nullable: true, pattern: '^https://' }), tags: arr(str(), 10),
            },
            ['collegeId', 'organizerName', 'title', 'category', 'startsAt', 'endsAt', 'venue', 'capacity', 'goingCount', 'interestedCount', 'checkInSecret', 'status', 'createdAt'],
          ),
        },
        // Capacity is enforced by the database: a seat can never be over-sold.
        { $expr: { $and: [{ $lte: ['$goingCount', '$capacity'] }, { $gt: ['$endsAt', '$startsAt'] }] } },
      ],
    },
    indexes: [
      { key: { collegeId: 1, status: 1, startsAt: 1, _id: 1 } },
      { key: { createdBy: 1, startsAt: -1 } },
      { key: { spaceId: 1, startsAt: 1 }, options: { partialFilterExpression: { spaceId: { $type: 'string' } } } },
      { key: { title: 'text', description: 'text', tags: 'text' }, options: { name: 'events_text', weights: { title: 4, tags: 2, description: 1 } } },
    ],
  },
  {
    name: 'event_rsvps',
    validator: { $jsonSchema: obj({ status: str({ enum: ['going', 'interested'] }) }, ['eventId', 'userId', 'status', 'createdAt']) },
    indexes: [{ key: { userId: 1, status: 1 } }, { key: { eventId: 1, status: 1, createdAt: 1 } }],
  },
  {
    name: 'announcements',
    validator: { $jsonSchema: obj({ title: str({ min: 3, max: 160 }), body: str({ min: 1, max: 5000 }), category: str({ enum: ['notice', 'news', 'results', 'event', 'club', 'important'] }), status: str({ enum: ['draft', 'published', 'archived'] }), audience: obj({ scope: str({ enum: ['college', 'department', 'year'] }) }, ['scope']) }, ['collegeId', 'authorLabel', 'title', 'body', 'category', 'audience', 'status', 'publishedAt']) },
    indexes: [{ key: { collegeId: 1, status: 1, isPinned: -1, publishedAt: -1, _id: -1 } }],
  },
  {
    name: 'lost_found_items',
    validator: { $jsonSchema: obj({ kind: str({ enum: ['lost', 'found'] }), title: str({ min: 3, max: 120 }), category: str({ enum: ['electronics', 'books', 'id_card', 'keys', 'clothing', 'bag', 'other'] }), location: str({ min: 2, max: 160 }), status: str({ enum: ['open', 'claim_pending', 'returned', 'closed'] }) }, ['collegeId', 'kind', 'title', 'category', 'location', 'occurredAt', 'status', 'createdAt']) },
    indexes: [{ key: { collegeId: 1, status: 1, occurredAt: -1, _id: -1 } }, { key: { reporterId: 1, createdAt: -1 } }, { key: { title: 'text', location: 'text', description: 'text' }, options: { name: 'lost_found_text' } }],
  },
  {
    name: 'lost_found_claims',
    validator: { $jsonSchema: obj({ answer: str({ min: 3, max: 500 }), status: str({ enum: ['pending', 'approved', 'rejected', 'withdrawn'] }) }, ['itemId', 'claimantId', 'answer', 'status', 'createdAt']) },
    indexes: [{ key: { itemId: 1, claimantId: 1 }, options: { unique: true } }, { key: { itemId: 1, status: 1 } }],
  },
  {
    name: 'listings',
    validator: {
      $and: [
        { $jsonSchema: obj({ title: str({ min: 3, max: 120 }), mode: str({ enum: ['sell', 'rent', 'borrow', 'exchange', 'free'] }), condition: str({ enum: ['new', 'like_new', 'good', 'fair'] }), pricePaise: num({ min: 0, max: 100_000_000, nullable: true }), status: str({ enum: ['available', 'reserved', 'borrowed', 'sold', 'removed'] }), imageIds: arr(uuid(), 8) }, ['collegeId', 'sellerId', 'title', 'mode', 'category', 'condition', 'location', 'status', 'imageIds', 'createdAt']) },
        // Prices are whole paise; items for sale or rent need a price, the rest are free.
        { $expr: { $or: [{ $and: [{ $in: ['$mode', ['sell', 'rent']] }, { $gt: ['$pricePaise', 0] }] }, { $and: [{ $not: [{ $in: ['$mode', ['sell', 'rent']] }] }, { $in: [{ $ifNull: ['$pricePaise', 0] }, [0]] }] }] } },
      ],
    },
    indexes: [{ key: { collegeId: 1, status: 1, createdAt: -1, _id: -1 } }, { key: { sellerId: 1, createdAt: -1 } }, { key: { title: 'text', description: 'text' }, options: { name: 'listings_text', weights: { title: 4, description: 1 } } }],
  },

  // ------------------------------------------------------------ chat
  {
    name: 'chats',
    validator: { $jsonSchema: obj({ kind: str({ enum: ['direct', 'group', 'class', 'department', 'community', 'event', 'anonymous', 'channel'] }), title: str({ nullable: true, min: 1, max: 120 }), disappearingSeconds: { enum: [86_400, 604_800, null] } }, ['collegeId', 'kind', 'createdAt']) },
    indexes: [
      { key: { directKey: 1 }, options: { unique: true, partialFilterExpression: { directKey: { $type: 'string' } } } },
      { key: { collegeId: 1, kind: 1 } },
      { key: { spaceId: 1 }, options: { partialFilterExpression: { spaceId: { $type: 'string' } } } },
      // One group chat per space (spaces work like communities).
      { key: { spaceId: 1, kind: 1 }, options: { unique: true, name: 'one_chat_per_space', partialFilterExpression: { kind: 'community' } } },
    ],
  },
  {
    name: 'chat_members',
    validator: { $jsonSchema: obj({ role: str({ enum: ['owner', 'admin', 'member'] }), colorWash: str({ enum: ['none', 'meadow', 'ocean', 'blossom', 'ember'] }) }, ['chatId', 'userId', 'role', 'joinedAt', 'lastReadAt']) },
    indexes: [{ key: { userId: 1, pinnedAt: -1 } }, { key: { chatId: 1, joinedAt: 1 } }],
  },
  {
    name: 'messages',
    validator: { $jsonSchema: obj({ kind: str({ enum: ['text', 'image', 'file', 'voice', 'video', 'poll', 'plan', 'question', 'sticker', 'snap', 'system'] }), body: str({ nullable: true, max: 4000 }), payload: obj(), clientId: str({ nullable: true, pattern: '^[A-Za-z0-9_-]{8,64}$' }) }, ['chatId', 'kind', 'payload', 'createdAt']) },
    indexes: [
      { key: { chatId: 1, createdAt: -1, _id: -1 } },
      // Idempotent sends: a retried message with the same clientId cannot be stored twice.
      { key: { chatId: 1, senderId: 1, clientId: 1 }, options: { unique: true, partialFilterExpression: { clientId: { $type: 'string' } }, name: 'idempotent_send' } },
      { key: { senderId: 1, createdAt: -1 } },
      { key: { chatId: 1, fileId: 1, createdAt: -1 }, options: { partialFilterExpression: { fileId: { $type: 'string' } } } },
    ],
  },
  { name: 'message_reactions', indexes: [{ key: { messageId: 1, createdAt: 1 } }] },
  { name: 'message_responses', indexes: [{ key: { messageId: 1 } }] },
  { name: 'message_views', indexes: [{ key: { messageId: 1 } }] },

  // ------------------------------------------------------------ learning & careers
  {
    name: 'subjects',
    validator: { $jsonSchema: obj({ name: str({ min: 2, max: 80 }), nameLower: str({ min: 2, max: 80 }), resourcesCount: num({ min: 0 }) }, ['collegeId', 'name', 'nameLower', 'resourcesCount', 'createdAt']) },
    indexes: [{ key: { collegeId: 1, nameLower: 1 }, options: { unique: true } }, { key: { collegeId: 1, departmentId: 1, semester: 1 } }],
  },
  {
    name: 'resources',
    validator: { $jsonSchema: obj({ title: str({ min: 4, max: 200 }), status: str({ enum: ['pending', 'approved', 'rejected', 'removed'] }), downloadsCount: num({ min: 0 }), ratingSum: num({ min: 0 }), ratingCount: num({ min: 0 }), externalUrl: str({ nullable: true, pattern: '^https?://' }) }, ['collegeId', 'title', 'kind', 'subjectId', 'subject', 'status', 'createdAt']) },
    indexes: [
      { key: { collegeId: 1, status: 1, subjectId: 1, createdAt: -1 } },
      { key: { collegeId: 1, status: 1, semester: 1, departmentId: 1 } },
      { key: { collegeId: 1, status: 1, createdAt: 1 }, options: { partialFilterExpression: { status: 'pending' } } },
      { key: { uploaderId: 1, createdAt: -1 } },
      { key: { title: 'text', subject: 'text', tags: 'text' }, options: { name: 'resources_text', weights: { title: 4, subject: 3, tags: 2 } } },
    ],
  },
  { name: 'resource_ratings', indexes: [{ key: { resourceId: 1 } }] },
  {
    name: 'lectures',
    validator: { $jsonSchema: obj({ title: str({ min: 4, max: 200 }), source: str({ enum: ['upload', 'youtube', 'link'] }), status: str({ enum: ['draft', 'pending', 'published', 'rejected'] }), viewsCount: num({ min: 0 }) }, ['collegeId', 'title', 'subject', 'source', 'status', 'createdAt']) },
    indexes: [{ key: { collegeId: 1, status: 1, createdAt: -1, _id: -1 } }, { key: { teacherId: 1, createdAt: -1 } }, { key: { title: 'text', subject: 'text', description: 'text' }, options: { name: 'lectures_text' } }],
  },
  {
    name: 'opportunities',
    validator: { $jsonSchema: obj({ title: str({ min: 3, max: 160 }), orgName: str({ min: 2, max: 120 }), mode: str({ enum: ['remote', 'onsite', 'hybrid'] }), status: str({ enum: ['pending', 'published', 'closed', 'rejected'] }), minYear: num({ min: 1, max: 6 }), applicantsCount: num({ min: 0 }), applyUrl: str({ nullable: true, pattern: '^https://' }) }, ['collegeId', 'orgName', 'title', 'kind', 'mode', 'location', 'deadline', 'status', 'createdAt']) },
    indexes: [{ key: { collegeId: 1, status: 1, deadline: 1, _id: 1 } }, { key: { postedBy: 1, createdAt: -1 } }, { key: { title: 'text', orgName: 'text', description: 'text', skills: 'text' }, options: { name: 'opportunities_text', weights: { title: 4, orgName: 3, skills: 2, description: 1 } } }],
  },
  {
    name: 'applications',
    validator: { $jsonSchema: obj({ stage: str({ enum: ['applied', 'shortlisted', 'interview', 'offer', 'rejected', 'withdrawn'] }) }, ['opportunityId', 'userId', 'stage', 'createdAt']) },
    indexes: [{ key: { opportunityId: 1, userId: 1 }, options: { unique: true } }, { key: { userId: 1, updatedAt: -1 } }, { key: { opportunityId: 1, createdAt: 1 } }],
  },

  // ------------------------------------------------------------ hush & vault
  {
    name: 'anonymous_authors',
    validator: { $jsonSchema: obj({ contentType: str({ enum: ['post', 'comment', 'hush_question', 'hush_answer'] }), contentId: uuid(), userId: uuid() }, ['contentType', 'contentId', 'userId', 'createdAt']) },
    indexes: [{ key: { userId: 1, contentType: 1 } }],
  },
  {
    name: 'hush_questions',
    validator: { $and: [{ $jsonSchema: obj({ topic: str({ min: 2, max: 40 }), body: str({ min: 12, max: 2000 }), answersCount: num({ min: 0 }), status: str({ enum: CONTENT }) }, ['collegeId', 'isAnonymous', 'topic', 'body', 'votesCount', 'answersCount', 'status', 'createdAt']) }, { $expr: { $or: [{ $eq: ['$isAnonymous', false] }, { $eq: ['$authorId', null] }] } }] },
    indexes: [{ key: { collegeId: 1, status: 1, createdAt: -1, _id: -1 } }, { key: { collegeId: 1, status: 1, votesCount: -1, _id: -1 } }, { key: { collegeId: 1, topic: 1, createdAt: -1 } }, { key: { topic: 'text', body: 'text' }, options: { name: 'hush_text' } }],
  },
  {
    name: 'hush_answers',
    validator: { $and: [{ $jsonSchema: obj({ body: str({ min: 10, max: 5000 }), status: str({ enum: CONTENT }) }, ['questionId', 'isAnonymous', 'body', 'votesCount', 'isAccepted', 'status', 'createdAt']) }, { $expr: { $or: [{ $eq: ['$isAnonymous', false] }, { $eq: ['$authorId', null] }] } }] },
    indexes: [{ key: { questionId: 1, isAccepted: -1, votesCount: -1 } }, { key: { questionId: 1 }, options: { unique: true, partialFilterExpression: { isAccepted: true }, name: 'one_accepted_answer' } }],
  },

  // ------------------------------------------------------------ platform
  {
    name: 'notifications',
    validator: { $jsonSchema: obj({ title: str({ min: 1, max: 160 }), body: str({ max: 500 }), link: str({ nullable: true, pattern: '^/[A-Za-z0-9/_?=&%.#-]*$' }) }, ['userId', 'kind', 'title', 'body', 'createdAt']) },
    indexes: [
      { key: { userId: 1, createdAt: -1, _id: -1 } },
      { key: { userId: 1, readAt: 1 }, options: { partialFilterExpression: { readAt: null } } },
      { key: { createdAt: 1 }, options: { expireAfterSeconds: 180 * DAY } },
    ],
  },
  {
    name: 'email_outbox',
    validator: { $jsonSchema: obj({ status: str({ enum: ['queued', 'sending', 'sent', 'failed', 'dead', 'suppressed'] }), category: str({ enum: ['transactional', 'security', 'notification', 'marketing'] }), attempts: num({ min: 0 }), template: str({ pattern: '^[a-z_]{2,40}$' }) }, ['toEmail', 'template', 'category', 'status', 'attempts', 'nextAttemptAt', 'createdAt']) },
    indexes: [
      { key: { status: 1, nextAttemptAt: 1 }, options: { partialFilterExpression: { status: { $in: ['queued', 'failed'] } } } },
      { key: { dedupeKey: 1 }, options: { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } } },
      { key: { createdAt: -1, _id: -1 } },
      { key: { toEmail: 1, template: 1, createdAt: -1 } },
      { key: { status: 1, lockedAt: 1 }, options: { partialFilterExpression: { status: 'sending' } } },
    ],
  },
  { name: 'email_suppressions', indexes: [{ key: { email: 1 } }] },
  {
    name: 'reports',
    validator: { $jsonSchema: obj({ status: str({ enum: ['open', 'reviewing', 'actioned', 'dismissed'] }), isOpen: bool(), priority: num({ min: 1, max: 5 }), details: str({ nullable: true, max: 1000 }) }, ['collegeId', 'targetType', 'targetId', 'reason', 'status', 'isOpen', 'priority', 'createdAt']) },
    indexes: [
      { key: { reporterId: 1, targetType: 1, targetId: 1 }, options: { unique: true, partialFilterExpression: { isOpen: true }, name: 'one_open_report_per_reporter' } },
      { key: { collegeId: 1, status: 1, priority: 1, createdAt: 1 } },
      { key: { targetType: 1, targetId: 1, isOpen: 1 } },
    ],
  },
  { name: 'moderation_actions', indexes: [{ key: { targetType: 1, targetId: 1, createdAt: -1 } }] },
  { name: 'identity_reveals', indexes: [{ key: { collegeId: 1, status: 1, createdAt: -1 } }] },
  {
    name: 'audit_logs',
    validator: { $jsonSchema: obj({ action: str({ pattern: '^[a-z_.]{3,64}$' }) }, ['action', 'meta', 'createdAt']) },
    indexes: [{ key: { collegeId: 1, createdAt: -1, _id: -1 } }, { key: { actorId: 1, createdAt: -1 } }, { key: { action: 1, createdAt: -1 } }, { key: { entityId: 1 } }, { key: { createdAt: 1 }, options: { expireAfterSeconds: 365 * DAY } }],
  },
  { name: 'feature_flags', validator: { $jsonSchema: obj({ enabled: bool(), rolloutPercent: num({ min: 0, max: 100 }) }, ['enabled', 'rolloutPercent', 'allowedRoles', 'allowedCollegeIds']) }, indexes: [] },
  {
    name: 'data_requests',
    validator: { $jsonSchema: obj({ kind: str({ enum: ['export', 'deletion'] }), status: str({ enum: ['pending_verification', 'pending', 'processing', 'completed', 'cancelled', 'rejected', 'failed'] }), isActive: bool() }, ['email', 'kind', 'status', 'isActive', 'createdAt']) },
    indexes: [{ key: { email: 1, kind: 1 }, options: { unique: true, partialFilterExpression: { isActive: true }, name: 'one_active_request' } }, { key: { status: 1, kind: 1, createdAt: 1 } }, { key: { userId: 1, kind: 1, createdAt: -1 } }],
  },
  {
    name: 'contact_messages',
    validator: { $jsonSchema: obj({ name: str({ min: 2, max: 80 }), subject: str({ min: 3, max: 140 }), message: str({ min: 10, max: 4000 }), consentProcessing: { enum: [true] }, status: str({ enum: ['new', 'in_progress', 'resolved', 'spam'] }) }, ['name', 'email', 'topic', 'subject', 'message', 'consentProcessing', 'status', 'createdAt']) },
    indexes: [{ key: { status: 1, createdAt: -1 } }],
  },
  { name: 'job_runs', indexes: [] },
  { name: 'job_locks', indexes: [{ key: { lockedUntil: 1 } }] },
  { name: 'app_settings', indexes: [] },

  // ------------------------------------------------------------ surveys & feedback
  {
    name: 'surveys',
    validator: {
      $jsonSchema: obj(
        {
          title: str({ min: 3, max: 160 }), description: str({ max: 1000 }), compulsory: bool(), anonymous: bool(), status: str({ enum: ['draft', 'published', 'closed'] }),
          category: str({ enum: ['app', 'campus', 'academics', 'events', 'other'] }), audienceRoles: arr(str({ enum: ROLES })),
          questions: arr(obj({ id: str({ min: 1, max: 40 }), type: str({ enum: ['single', 'multiple', 'text', 'rating', 'scale'] }), prompt: str({ min: 3, max: 300 }), options: arr(str({ min: 1, max: 120 }), 12), required: bool() }, ['id', 'type', 'prompt', 'options', 'required']), 30),
          responsesCount: num({ min: 0 }),
        },
        ['collegeId', 'title', 'compulsory', 'status', 'questions', 'createdBy', 'responsesCount', 'createdAt'],
      ),
    },
    indexes: [{ key: { collegeId: 1, status: 1, publishedAt: -1 } }],
  },
  { name: 'survey_responses', indexes: [{ key: { surveyId: 1, submittedAt: -1 } }, { key: { userId: 1, surveyId: 1 } }] },
  {
    name: 'feedback',
    validator: { $jsonSchema: obj({ category: str({ enum: ['bug', 'idea', 'praise', 'question', 'other'] }), rating: num({ min: 1, max: 5, nullable: true }), message: str({ min: 3, max: 4000 }), status: str({ enum: ['new', 'reviewed', 'planned', 'done'] }) }, ['collegeId', 'userId', 'category', 'message', 'status', 'createdAt']) },
    indexes: [{ key: { collegeId: 1, createdAt: -1, _id: -1 } }, { key: { collegeId: 1, status: 1, category: 1 } }],
  },
  { name: 'schema_versions', indexes: [] },
];
