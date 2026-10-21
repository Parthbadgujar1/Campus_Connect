// Shapes returned by the CampusConnect API (apps/api). Kept in one place so every screen reads
// the same fields; the API's OpenAPI docs at http://localhost:4000/docs are the full reference.

export type ApiRole = 'student' | 'faculty' | 'expert' | 'moderator' | 'admin';

export interface PersonSummary {
  id: string;
  username: string;
  displayName: string;
  role: ApiRole;
  isVerified: boolean;
  year: number | null;
  department: string | null;
  avatarUrl: string | null;
}

export interface RoleInfo {
  enrollmentNumber?: string | null;
  admissionYear?: number | null;
  employeeId?: string | null;
  designation?: string | null;
  organization?: string | null;
  linkedinUrl?: string | null;
}

export interface Me {
  id: string;
  email: string;
  role: ApiRole;
  /** Faculty or expert access asked for at sign-up, waiting for an admin. */
  pendingRole: 'faculty' | 'expert' | null;
  roleInfo: RoleInfo;
  status: 'active' | 'pending' | 'suspended' | 'deleted';
  emailVerified: boolean;
  createdAt: string;
  deletionScheduledFor: string | null;
  college: { id: string; name: string; shortName: string; slug: string };
  profile: {
    username: string;
    displayName: string;
    headline: string | null;
    bio: string | null;
    avatarUrl: string | null;
    departmentId: string | null;
    department: string | null;
    year: number | null;
    semester: number | null;
    division: string | null;
    skills: string[];
    interests: string[];
    links: Record<string, string>;
    isVerified: boolean;
    visibility: { profile?: 'campus' | 'connections'; showBranch?: boolean; showEmail?: boolean; showActivity?: boolean };
    messagePrivacy: 'everyone' | 'connections' | 'nobody';
    followersCount: number;
    followingCount: number;
  };
}

export interface SessionPayload {
  user: Me | null;
  session: { id: string; idleExpiresAt: string; absoluteExpiresAt: string } | null;
  csrfToken: string | null;
}

export type FontChoice = 'handwritten' | 'system' | 'readable';
export type ThemeChoice = 'system' | 'day' | 'night' | 'paper';
export type TextSizeChoice = 'sm' | 'md' | 'lg';

export interface Settings {
  theme: ThemeChoice;
  font: FontChoice;
  textSize: TextSizeChoice;
  reduceMotion: boolean;
  highContrast: boolean;
  onboarding: { completed: boolean; skipped: boolean; completedAt: string | null };
  tour: { completed: boolean; skipped: boolean; version: number; current: number };
  seen: string[];
}

export interface FileView {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
  status: string;
  width: number | null;
  height: number | null;
  url: string | null;
  thumbnailUrl: string | null;
}

export interface PostView {
  id: string;
  kind: 'post' | 'question' | 'poll' | 'announcement';
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

export interface CommentView {
  id: string;
  parentId: string | null;
  body: string | null;
  deleted: boolean;
  author: PersonSummary | null;
  byOriginalPoster: boolean;
  isMine: boolean;
  createdAt: string;
}

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  entity: { type: string; id: string } | null;
  actor: PersonSummary | null;
  read: boolean;
  createdAt: string;
}

export interface EventView {
  id: string;
  title: string;
  description: string;
  category: string;
  organizerName: string;
  space: { id: string; name: string; slug: string } | null;
  cover: FileView | null;
  startsAt: string;
  endsAt: string;
  venue: string;
  isOnline: boolean;
  onlineUrl: string | null;
  capacity: number;
  goingCount: number;
  interestedCount: number;
  spotsLeft: number;
  registrationDeadline: string | null;
  registrationOpen: boolean;
  feeText: string | null;
  hasCertificate: boolean;
  tags: string[];
  status: string;
  myRsvp: 'going' | 'interested' | null;
  checkedIn: boolean;
  canManage: boolean;
}

export interface SpaceView {
  id: string;
  slug: string;
  name: string;
  kind: string;
  privacy: 'public' | 'private';
  description: string;
  tags: string[];
  membersCount: number;
  membership: { role: 'owner' | 'moderator' | 'member'; status: 'active' | 'pending' | 'banned' } | null;
}

export interface DiscussionSummary {
  id: string;
  title: string;
  excerpt: string;
  flair: string;
  pinned: boolean;
  locked: boolean;
  score: number;
  myVote: number;
  commentsCount: number;
  author: PersonSummary;
  lastActivityAt: string;
  createdAt: string;
}

export interface OpportunityView {
  id: string;
  orgName: string;
  title: string;
  kind: string;
  mode: 'remote' | 'onsite' | 'hybrid';
  location: string;
  payText: string;
  deadline: string;
  open: boolean;
  minYear: number;
  skills: string[];
  description: string;
  applyUrl: string | null;
  status: string;
  saved: boolean;
  myApplication: { id: string; stage: string; updatedAt: string } | null;
  eligibility: { eligible: boolean; reasons: string[] };
  canManage: boolean;
  applicantsCount?: number;
  eligibleDepartmentIds: string[];
  postedBy?: PersonSummary | null;
}

export interface ChatListItem {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  other: PersonSummary | null;
  membersCount: number;
  myRole: string;
  unread: number;
  muted: boolean;
  pinned: boolean;
  archived: boolean;
  colorWash: string;
  disappearingSeconds: number | null;
  lastMessage: { id: string; kind: string; preview: string; senderName: string | null; createdAt: string } | null;
  activityAt: string;
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
  deleted: boolean;
  createdAt: string;
}

export interface PublicConfig {
  registrationOpen: boolean;
  flags: Record<string, boolean>;
  uploads: { maxMb: number; purposes: Record<string, { kinds: string[]; maxMb: number }> };
  legal: { termsVersion: string; privacyVersion: string; cookiesVersion: string; lastUpdated: string; minimumAge: number };
  operator: { name: string; address: string; supportEmail: string; privacyEmail: string };
}
