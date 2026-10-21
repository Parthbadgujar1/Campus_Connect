// The MongoDB data model: one interface per collection. Field names are camelCase; every id is a
// UUIDv7 string (see ids.ts); every timestamp is a Date. Collections that hold one document per
// pair (a follow, a like, a membership) use a composite string _id such as "userA:userB", so a
// duplicate is impossible by construction.
//
// Every document that belongs to a college carries collegeId. It is the tenant key: each query
// filters on it first, and it is the shard key if the database is ever sharded by college.
//
// Validation rules and indexes for these collections live in schema.ts.

export type Role = 'student' | 'faculty' | 'expert' | 'moderator' | 'admin';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';
export type ContentStatus = 'published' | 'hidden' | 'removed';
export type FileKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

// ---------------------------------------------------------------- identity
export interface College {
  _id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string | null;
  state: string | null;
  timezone: string;
  shard: string;
  status: 'active' | 'suspended';
  /** Email domains that prove membership, and which roles each may sign up as. */
  domains: Array<{ domain: string; allowsRoles: Role[] }>;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  _id: string;
  collegeId: string;
  code: string;
  name: string;
  createdAt: Date;
}

/** Details asked for at sign-up, depending on the role. Never shown publicly. */
export interface RoleInfo {
  enrollmentNumber?: string | null; // students
  admissionYear?: number | null; // students
  employeeId?: string | null; // faculty and staff
  designation?: string | null; // faculty, experts
  organization?: string | null; // experts
  linkedinUrl?: string | null; // experts
}

export interface Profile {
  username: string;
  usernameLower: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  departmentId: string | null;
  year: number | null;
  semester: number | null;
  division: string | null;
  skills: string[];
  interests: string[];
  links: Record<string, string>;
  avatarFileId: string | null;
  isVerified: boolean;
  visibility: { profile: 'campus' | 'connections'; showBranch: boolean; showEmail: boolean; showActivity: boolean };
  messagePrivacy: 'everyone' | 'connections' | 'nobody';
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

export interface UserSettings {
  theme: 'system' | 'day' | 'night' | 'paper';
  font: 'handwritten' | 'classic' | 'system' | 'readable';
  textSize: 'sm' | 'md' | 'lg';
  reduceMotion: boolean;
  highContrast: boolean;
  onboardingCompletedAt: Date | null;
  onboardingSkipped: boolean;
  tourCompletedAt: Date | null;
  tourSkipped: boolean;
  tourVersion: number;
  seen: string[];
}

export interface NotificationPrefs {
  inApp: Record<string, boolean>;
  email: Record<string, boolean>;
  emailDigest: 'off' | 'daily' | 'weekly';
  marketingEmails: boolean;
  quietStart: string | null;
  quietEnd: string | null;
}

export interface User {
  _id: string;
  collegeId: string;
  email: string; // lower-case
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  role: Role;
  /**
   * Faculty and expert access is granted only after an admin reviews it. Until then the account
   * works with the student role and pendingRole says what was asked for.
   */
  pendingRole: 'faculty' | 'expert' | null;
  status: UserStatus;
  roleInfo: RoleInfo;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  termsVersion: string | null;
  termsAcceptedAt: Date | null;
  adultConfirmedAt: Date | null;
  deletionScheduledFor: Date | null;
  deletionReason: string | null;
  profile: Profile;
  settings: UserSettings;
  notificationPrefs: NotificationPrefs;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  _id: string;
  userId: string;
  tokenHash: string; // SHA-256 hex of the opaque token
  kind: 'web' | 'mobile';
  persistent: boolean;
  ipHash: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  /** TTL: the document is removed a week after it can no longer be used. */
  expireAt: Date;
}

export interface EmailToken {
  _id: string;
  userId: string | null;
  email: string;
  purpose: 'verify_email' | 'reset_password' | 'data_request';
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  ipHash: string | null;
  createdAt: Date;
  expireAt: Date; // TTL
}

export interface LoginAttempt {
  _id: string;
  email: string;
  userId: string | null;
  ipHash: string | null;
  success: boolean;
  reason: string;
  createdAt: Date; // TTL 30 days
}

export interface Consent {
  _id: string;
  userId: string | null;
  anonymousId: string | null;
  purpose: 'necessary' | 'preferences' | 'analytics' | 'marketing' | 'terms' | 'privacy' | 'marketing_email' | 'contact';
  granted: boolean;
  policyVersion: string;
  source: 'banner' | 'signup' | 'settings' | 'contact' | 'data_request';
  ipHash: string | null;
  createdAt: Date;
}

export interface Follow {
  _id: string; // follower:followee
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

export interface Block {
  _id: string; // blocker:blocked
  blockerId: string;
  blockedId: string;
  createdAt: Date;
}

export interface PushToken {
  _id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: Date;
  lastSeenAt: Date;
}

export interface VerificationRequest {
  _id: string;
  collegeId: string;
  userId: string;
  kind: 'student_id' | 'faculty_role' | 'expert_role';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  fileId: string | null;
  note: string | null;
  reviewerId: string | null;
  reviewerNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileDoc {
  _id: string;
  collegeId: string;
  ownerId: string | null;
  purpose: 'avatar' | 'post' | 'message' | 'resource' | 'listing' | 'lost_found' | 'verification' | 'lecture' | 'event' | 'export' | 'other';
  visibility: 'public' | 'campus' | 'private';
  storageDriver: 'local' | 's3';
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  kind: FileKind;
  status: 'pending' | 'ready' | 'quarantined' | 'deleted';
  width: number | null;
  height: number | null;
  hasThumbnail: boolean;
  scanResult: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
}

// ---------------------------------------------------------------- communities
export interface Space {
  _id: string;
  collegeId: string;
  slug: string;
  name: string;
  kind: 'club' | 'interest' | 'department' | 'exam' | 'hostel' | 'city' | 'class';
  privacy: 'public' | 'private';
  description: string;
  tags: string[];
  avatarFileId: string | null;
  membersCount: number;
  status: 'pending' | 'active' | 'archived' | 'removed';
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpaceMember {
  _id: string; // space:user
  spaceId: string;
  userId: string;
  role: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'banned';
  joinedAt: Date;
}

export interface Discussion {
  _id: string;
  collegeId: string;
  spaceId: string;
  authorId: string | null;
  title: string;
  body: string;
  flair: string;
  isPinned: boolean;
  isLocked: boolean;
  score: number;
  repliesCount: number;
  status: ContentStatus;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface DiscussionReply {
  _id: string;
  discussionId: string;
  parentId: string | null;
  authorId: string | null;
  body: string;
  depth: number;
  score: number;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type VoteTarget = 'discussion' | 'discussion_reply' | 'hush_question' | 'hush_answer';
export interface Vote {
  _id: string; // user:targetType:targetId
  userId: string;
  targetType: VoteTarget;
  targetId: string;
  value: 1 | -1;
  createdAt: Date;
}

// ---------------------------------------------------------------- feed
export interface Post {
  _id: string;
  collegeId: string;
  /** null for anonymous posts: the author lives only in anonymous_authors. */
  authorId: string | null;
  isAnonymous: boolean;
  kind: 'post' | 'question' | 'poll' | 'announcement';
  body: string;
  audience: { type: 'college' | 'department' | 'year' | 'division' | 'space'; departmentId: string | null; year: number | null; division: string | null; spaceId: string | null };
  tags: string[];
  attachmentIds: string[];
  /** Kinds of the attached files (image, video...), so Loops can list video posts quickly. */
  mediaKinds: string[];
  poll: { options: Array<{ id: string; label: string; votes: number }>; totalVotes: number } | null;
  isPinned: boolean;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PollVote {
  _id: string; // post:user
  postId: string;
  optionId: string;
  userId: string;
  createdAt: Date;
}

export interface PostLike {
  _id: string; // post:user
  postId: string;
  userId: string;
  createdAt: Date;
}

export interface Comment {
  _id: string;
  postId: string;
  authorId: string | null;
  isAnonymous: boolean;
  parentId: string | null;
  body: string;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type SavedType = 'post' | 'discussion' | 'event' | 'opportunity' | 'listing' | 'resource' | 'lecture' | 'hush_question';
export interface SavedItem {
  _id: string; // user:type:item
  userId: string;
  itemType: SavedType;
  itemId: string;
  createdAt: Date;
}

// ---------------------------------------------------------------- campus life
export interface CampusEvent {
  _id: string;
  collegeId: string;
  spaceId: string | null;
  createdBy: string | null;
  organizerName: string;
  title: string;
  description: string;
  category: string;
  startsAt: Date;
  endsAt: Date;
  venue: string;
  isOnline: boolean;
  onlineUrl: string | null;
  capacity: number;
  goingCount: number;
  interestedCount: number;
  registrationDeadline: Date | null;
  feeText: string | null;
  hasCertificate: boolean;
  coverFileId: string | null;
  tags: string[];
  /** Secret for rotating check-in codes; never sent to clients. */
  checkInSecret: string;
  status: 'draft' | 'pending' | 'published' | 'cancelled' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRsvp {
  _id: string; // event:user
  eventId: string;
  userId: string;
  status: 'going' | 'interested';
  checkedInAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Announcement {
  _id: string;
  collegeId: string;
  authorId: string | null;
  authorLabel: string;
  title: string;
  body: string;
  category: 'notice' | 'news' | 'results' | 'event' | 'club' | 'important';
  audience: { scope: 'college' } | { scope: 'department'; departmentId: string } | { scope: 'year'; year: number };
  isPinned: boolean;
  status: 'draft' | 'published' | 'archived';
  publishedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LostFoundItem {
  _id: string;
  collegeId: string;
  reporterId: string | null;
  kind: 'lost' | 'found';
  title: string;
  category: 'electronics' | 'books' | 'id_card' | 'keys' | 'clothing' | 'bag' | 'other';
  location: string;
  occurredAt: Date;
  description: string;
  verificationQuestion: string | null;
  imageFileId: string | null;
  status: 'open' | 'claim_pending' | 'returned' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface LostFoundClaim {
  _id: string;
  itemId: string;
  claimantId: string;
  answer: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  decidedAt: Date | null;
  createdAt: Date;
}

export interface Listing {
  _id: string;
  collegeId: string;
  sellerId: string;
  title: string;
  /** rent = rooms and PGs (price per month). */
  mode: 'sell' | 'rent' | 'borrow' | 'exchange' | 'free';
  category: string;
  pricePaise: number | null;
  condition: 'new' | 'like_new' | 'good' | 'fair';
  location: string;
  description: string;
  returnBy: string | null; // YYYY-MM-DD
  imageIds: string[];
  status: 'available' | 'reserved' | 'borrowed' | 'sold' | 'removed';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ---------------------------------------------------------------- chat
export interface Chat {
  _id: string;
  collegeId: string;
  kind: 'direct' | 'group' | 'class' | 'department' | 'community' | 'event' | 'anonymous' | 'channel';
  title: string | null;
  description: string | null;
  createdBy: string | null;
  /** For direct chats: "<smaller id>:<larger id>", unique, so two people share one chat. */
  directKey: string | null;
  spaceId: string | null;
  eventId: string | null;
  onlyAdminsPost: boolean;
  disappearingSeconds: number | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMember {
  _id: string; // chat:user
  chatId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  lastReadAt: Date;
  mutedUntil: Date | null;
  archivedAt: Date | null;
  pinnedAt: Date | null;
  colorWash: 'none' | 'meadow' | 'ocean' | 'blossom' | 'ember';
  anonymousAlias: number | null;
}

export interface Message {
  _id: string;
  chatId: string;
  senderId: string | null;
  kind: 'text' | 'image' | 'file' | 'voice' | 'video' | 'poll' | 'plan' | 'question' | 'sticker' | 'snap' | 'system';
  body: string | null;
  replyToId: string | null;
  fileId: string | null;
  payload: Record<string, unknown>;
  /** Idempotency key from the sender's device; unique per chat and sender. */
  clientId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface MessageReaction {
  _id: string; // message:user:emoji
  messageId: string;
  chatId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface MessageResponse {
  _id: string; // message:user
  messageId: string;
  userId: string;
  response: string;
  updatedAt: Date;
}

export interface MessageView {
  _id: string; // message:user
  messageId: string;
  userId: string;
  viewedAt: Date;
}

// ---------------------------------------------------------------- learning & careers
export interface Subject {
  _id: string;
  collegeId: string;
  name: string;
  nameLower: string;
  departmentId: string | null;
  semester: number | null;
  createdBy: string | null;
  resourcesCount: number;
  createdAt: Date;
}

export interface Resource {
  _id: string;
  collegeId: string;
  uploaderId: string | null;
  title: string;
  kind: string;
  subjectId: string;
  subject: string; // denormalised subject name, for display and search
  semester: number | null;
  departmentId: string | null;
  fileId: string | null;
  externalUrl: string | null;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  reviewerId: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  downloadsCount: number;
  ratingSum: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ResourceRating {
  _id: string; // resource:user
  resourceId: string;
  userId: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lecture {
  _id: string;
  collegeId: string;
  teacherId: string | null;
  title: string;
  description: string;
  subject: string;
  semester: number | null;
  source: 'upload' | 'youtube' | 'link';
  fileId: string | null;
  url: string | null;
  durationSeconds: number | null;
  viewsCount: number;
  chapters: Array<{ at: number; title: string }>;
  status: 'draft' | 'pending' | 'published' | 'rejected';
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Opportunity {
  _id: string;
  collegeId: string;
  postedBy: string | null;
  orgName: string;
  title: string;
  kind: string;
  mode: 'remote' | 'onsite' | 'hybrid';
  location: string;
  payText: string;
  deadline: Date;
  eligibleDepartmentIds: string[];
  minYear: number;
  skills: string[];
  description: string;
  applyUrl: string | null;
  status: 'pending' | 'published' | 'closed' | 'rejected';
  applicantsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Application {
  _id: string;
  opportunityId: string;
  userId: string;
  stage: 'applied' | 'shortlisted' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
  note: string | null;
  resumeFileId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------- hush & anonymity vault
export interface AnonymousAuthor {
  _id: string; // contentType:contentId
  contentType: 'post' | 'comment' | 'hush_question' | 'hush_answer';
  contentId: string;
  userId: string;
  createdAt: Date;
}

export interface HushQuestion {
  _id: string;
  collegeId: string;
  authorId: string | null;
  isAnonymous: boolean;
  topic: string;
  body: string;
  votesCount: number;
  answersCount: number;
  acceptedAnswerId: string | null;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HushAnswer {
  _id: string;
  questionId: string;
  collegeId: string;
  authorId: string | null;
  isAnonymous: boolean;
  body: string;
  votesCount: number;
  isAccepted: boolean;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ---------------------------------------------------------------- platform
export interface Notification {
  _id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date; // TTL 180 days
}

export interface EmailOutbox {
  _id: string;
  toEmail: string;
  userId: string | null;
  template: string;
  category: 'transactional' | 'security' | 'notification' | 'marketing';
  payload: Record<string, unknown>;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'dead' | 'suppressed';
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lockedAt: Date | null;
  lastError: string | null;
  providerMessageId: string | null;
  renderedSubject: string | null;
  renderedHtml: string | null;
  renderedText: string | null;
  dedupeKey: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface EmailSuppression {
  _id: string; // email:scope
  email: string;
  scope: 'marketing' | 'notification' | 'all';
  reason: 'unsubscribed' | 'bounced' | 'complaint' | 'manual';
  createdAt: Date;
}

export interface Report {
  _id: string;
  collegeId: string;
  reporterId: string | null;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed';
  /** true while open or reviewing: lets a unique index allow one open report per reporter. */
  isOpen: boolean;
  priority: number;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationAction {
  _id: string;
  collegeId: string;
  actorId: string | null;
  targetType: string;
  targetId: string;
  action: string;
  reason: string | null;
  reportId: string | null;
  createdAt: Date;
}

export interface IdentityReveal {
  _id: string;
  collegeId: string;
  contentType: AnonymousAuthor['contentType'];
  contentId: string;
  reason: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export interface AuditLog {
  _id: string;
  collegeId: string | null;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipHash: string | null;
  requestId: string | null;
  meta: Record<string, unknown>;
  createdAt: Date; // TTL 365 days
}

export interface FeatureFlag {
  _id: string; // the key, e.g. module.feed
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  allowedRoles: string[];
  allowedCollegeIds: string[];
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataRequest {
  _id: string;
  userId: string | null;
  email: string;
  kind: 'export' | 'deletion';
  status: 'pending_verification' | 'pending' | 'processing' | 'completed' | 'cancelled' | 'rejected' | 'failed';
  /** true while not finished: lets a unique index allow one active request per email and kind. */
  isActive: boolean;
  scheduledFor: Date | null;
  verifiedAt: Date | null;
  completedAt: Date | null;
  resultFileId: string | null;
  note: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactMessage {
  _id: string;
  userId: string | null;
  name: string;
  email: string;
  topic: 'general' | 'support' | 'privacy' | 'safety' | 'partnership' | 'press';
  subject: string;
  message: string;
  consentProcessing: true;
  utm: Record<string, string> | null;
  ipHash: string | null;
  status: 'new' | 'in_progress' | 'resolved' | 'spam';
  createdAt: Date;
  updatedAt: Date;
}

export interface JobRun {
  _id: string; // job name
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastStatus: 'ok' | 'error' | 'skipped' | null;
  lastError: string | null;
  lastDurationMs: number | null;
  runCount: number;
}

export interface JobLock {
  _id: string; // job name
  owner: string;
  lockedUntil: Date;
}

export interface AppSetting {
  _id: string;
  value: unknown;
  updatedBy: string | null;
  updatedAt: Date;
}

// ---------------------------------------------------------------- surveys & feedback
export type SurveyQuestionType = 'single' | 'multiple' | 'text' | 'rating' | 'scale';
export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  options: string[]; // for single / multiple
  required: boolean;
}

export interface Survey {
  _id: string;
  collegeId: string;
  title: string;
  description: string;
  category: 'app' | 'campus' | 'academics' | 'events' | 'other';
  /** Compulsory surveys must be answered before using the app (shown on sign-in). */
  compulsory: boolean;
  /** Anonymous surveys never show who answered, not even to admins or in exports. */
  anonymous: boolean;
  audienceRoles: Role[]; // empty = everyone
  questions: SurveyQuestion[];
  status: 'draft' | 'published' | 'closed';
  publishedAt: Date | null;
  closesAt: Date | null;
  createdBy: string;
  responsesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveyResponse {
  _id: string; // survey:user
  surveyId: string;
  collegeId: string;
  userId: string;
  answers: Array<{ questionId: string; value: string | string[] | number }>;
  submittedAt: Date;
}

export interface Feedback {
  _id: string;
  collegeId: string;
  userId: string;
  category: 'bug' | 'idea' | 'praise' | 'question' | 'other';
  rating: number | null; // 1-5
  message: string;
  page: string | null;
  appVersion: string | null;
  status: 'new' | 'reviewed' | 'planned' | 'done';
  createdAt: Date;
  updatedAt: Date;
}

export interface SchemaVersion {
  _id: string; // migration id
  checksum: string;
  appliedAt: Date;
}

/** Collection name -> document type. */
export interface Models {
  colleges: College;
  departments: Department;
  users: User;
  sessions: Session;
  email_tokens: EmailToken;
  login_attempts: LoginAttempt;
  consents: Consent;
  follows: Follow;
  blocks: Block;
  push_tokens: PushToken;
  verification_requests: VerificationRequest;
  files: FileDoc;
  spaces: Space;
  space_members: SpaceMember;
  discussions: Discussion;
  discussion_replies: DiscussionReply;
  votes: Vote;
  posts: Post;
  poll_votes: PollVote;
  post_likes: PostLike;
  comments: Comment;
  saved_items: SavedItem;
  events: CampusEvent;
  event_rsvps: EventRsvp;
  announcements: Announcement;
  lost_found_items: LostFoundItem;
  lost_found_claims: LostFoundClaim;
  listings: Listing;
  chats: Chat;
  chat_members: ChatMember;
  messages: Message;
  message_reactions: MessageReaction;
  message_responses: MessageResponse;
  message_views: MessageView;
  subjects: Subject;
  resources: Resource;
  resource_ratings: ResourceRating;
  lectures: Lecture;
  opportunities: Opportunity;
  applications: Application;
  anonymous_authors: AnonymousAuthor;
  hush_questions: HushQuestion;
  hush_answers: HushAnswer;
  notifications: Notification;
  email_outbox: EmailOutbox;
  email_suppressions: EmailSuppression;
  reports: Report;
  moderation_actions: ModerationAction;
  identity_reveals: IdentityReveal;
  audit_logs: AuditLog;
  feature_flags: FeatureFlag;
  data_requests: DataRequest;
  contact_messages: ContactMessage;
  job_runs: JobRun;
  job_locks: JobLock;
  app_settings: AppSetting;
  surveys: Survey;
  survey_responses: SurveyResponse;
  feedback: Feedback;
  schema_versions: SchemaVersion;
}

export type CollectionName = keyof Models;
