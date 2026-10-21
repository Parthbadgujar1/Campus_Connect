// Shapes for the content modules (events, spaces, Shelf, Hush, marketplace, surveys...).
// The account and feed shapes live in ./types.

import type { ApiRole, EventView, FileView, PersonSummary, SpaceView } from './types';

export interface EventDetail extends EventView {
  createdBy: PersonSummary | null;
  friendsGoing: PersonSummary[];
}

export interface SpaceDetail extends SpaceView {
  status: string;
  createdAt: string;
  canRead: boolean;
  canManage: boolean;
  channels: Array<{ id: string; chatId: string; name: string; topic: string; kind: string }>;
}

export interface SpaceMemberView extends PersonSummary {
  spaceRole: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'banned';
  joinedAt: string;
}

export interface DiscussionDetail {
  id: string;
  space: { id: string; slug: string; name: string };
  title: string;
  body: string;
  flair: string;
  pinned: boolean;
  locked: boolean;
  score: number;
  myVote: number;
  commentsCount: number;
  author: PersonSummary;
  isMine: boolean;
  canManage: boolean;
  createdAt: string;
}

export interface DiscussionReply {
  id: string;
  parentId: string | null;
  depth: number;
  body: string | null;
  deleted: boolean;
  score: number;
  myVote: number;
  author: PersonSummary | null;
  isMine: boolean;
  createdAt: string;
}

export interface HomeDiscussion {
  id: string;
  title: string;
  excerpt: string;
  flair: string;
  score: number;
  commentsCount: number;
  space: { slug: string; name: string; member: boolean };
  author: PersonSummary;
  createdAt: string;
  lastActivityAt: string;
}

export interface AnnouncementView {
  id: string;
  title: string;
  body: string;
  category: 'notice' | 'news' | 'results' | 'event' | 'club' | 'important';
  authorLabel: string;
  audience: { scope: 'college' } | { scope: 'department'; departmentId: string } | { scope: 'year'; year: number };
  pinned: boolean;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string;
  expiresAt: string | null;
  isMine: boolean;
}

export interface ApplicationTrackerItem {
  id: string;
  stage: string;
  note: string | null;
  appliedAt: string;
  updatedAt: string;
  opportunity: { id: string; title: string; orgName: string; kind: string; deadline: string };
}

export interface ApplicantView {
  id: string;
  stage: string;
  note: string | null;
  appliedAt: string;
  hasResume: boolean;
  person: PersonSummary;
}

export interface ResourceView {
  id: string;
  title: string;
  kind: string;
  subjectId: string;
  subject: string;
  semester: number | null;
  departmentId: string | null;
  department: string | null;
  tags: string[];
  externalUrl: string | null;
  hasFile: boolean;
  status: string;
  reviewNote?: string | null;
  downloadsCount: number;
  rating: number | null;
  ratingCount: number;
  myRating: number | null;
  saved: boolean;
  uploader: PersonSummary | null;
  isMine: boolean;
  createdAt: string;
  file?: FileView | null;
}

export interface SubjectView {
  id: string;
  name: string;
  departmentId: string | null;
  department: string | null;
  semester: number | null;
  resourcesCount: number;
  canEdit: boolean;
}

export interface ShelfFilters {
  total: number;
  departments: Array<{ id: string; name: string; code: string; count: number }>;
  semesters: Array<{ value: number; count: number }>;
  subjects: Array<{ id: string; name: string; count: number }>;
  kinds: Array<{ value: string; count: number }>;
}

export interface LectureView {
  id: string;
  title: string;
  description: string;
  subject: string;
  semester: number | null;
  source: 'upload' | 'youtube' | 'link';
  url: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  file: FileView | null;
  durationSeconds: number | null;
  viewsCount: number;
  chapters: Array<{ at: number; title: string }>;
  status: string;
  teacher: PersonSummary | null;
  canManage: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface HushQuestionView {
  id: string;
  topic: string;
  body: string;
  anonymous: boolean;
  author: PersonSummary | null;
  votesCount: number;
  myVote: number;
  answersCount: number;
  acceptedAnswerId: string | null;
  isMine: boolean;
  createdAt: string;
}

export interface HushAnswerView {
  id: string;
  body: string;
  anonymous: boolean;
  author: PersonSummary | null;
  votesCount: number;
  myVote: number;
  accepted: boolean;
  isMine: boolean;
  createdAt: string;
}

export interface HushDetail extends HushQuestionView {
  answers: HushAnswerView[];
}

export interface LostFoundView {
  id: string;
  kind: 'lost' | 'found';
  title: string;
  category: string;
  location: string;
  occurredAt: string;
  description: string;
  verificationQuestion: string | null;
  image: FileView | null;
  status: 'open' | 'claim_pending' | 'returned' | 'closed';
  reporter: PersonSummary;
  isMine: boolean;
  myClaim: string | null;
  pendingClaims?: number;
  createdAt: string;
}

export interface ClaimView {
  id: string;
  answer: string;
  status: string;
  claimant: PersonSummary;
  createdAt: string;
}

export interface ListingView {
  id: string;
  title: string;
  mode: 'sell' | 'rent' | 'borrow' | 'exchange' | 'free';
  category: string;
  pricePaise: number | null;
  condition: 'new' | 'like_new' | 'good' | 'fair';
  location: string;
  description: string;
  returnBy: string | null;
  status: string;
  images: FileView[];
  seller: PersonSummary;
  isMine: boolean;
  saved: boolean;
  createdAt: string;
}

export interface ChatDetail {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  onlyAdminsPost: boolean;
  disappearingSeconds: number | null;
  myRole: string;
  canPost: boolean;
  settings: { muted: boolean; mutedUntil: string | null; archived: boolean; pinned: boolean; colorWash: string };
  lastReadAt: string;
  members: Array<(Partial<PersonSummary> & { id: string | null; displayName: string }) & { chatRole: string; joinedAt: string }>;
}

export type SearchType = 'people' | 'posts' | 'discussions' | 'spaces' | 'events' | 'opportunities' | 'resources' | 'lectures' | 'hush' | 'listings' | 'lost_found';
export interface SearchResults {
  q: string;
  total: number;
  unavailable: string[];
  results: Partial<Record<SearchType, Array<Record<string, any> & { id: string; link: string }>>>;
}

export type SurveyQuestionType = 'single' | 'multiple' | 'text' | 'rating' | 'scale';
export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  options: string[];
  required: boolean;
}
export type SurveyAnswer = string | string[] | number;

export interface SurveyView {
  id: string;
  title: string;
  description: string;
  category: 'app' | 'campus' | 'academics' | 'events' | 'other';
  compulsory: boolean;
  anonymous: boolean;
  questions?: SurveyQuestion[];
  questionsCount?: number;
  publishedAt: string | null;
  closesAt: string | null;
  answered: boolean;
  myAnswers?: Record<string, SurveyAnswer> | null;
}

export interface AdminSurveyRow {
  id: string;
  title: string;
  description: string;
  category: SurveyView['category'];
  compulsory: boolean;
  anonymous: boolean;
  audienceRoles: ApiRole[];
  status: 'draft' | 'published' | 'closed';
  questionsCount: number;
  responsesCount: number;
  audienceSize: number;
  responseRate: number;
  publishedAt: string | null;
  closesAt: string | null;
  createdAt: string;
}

export interface AdminSurveyDetail extends SurveyView {
  status: 'draft' | 'published' | 'closed';
  audienceRoles: ApiRole[];
  responsesCount: number;
  createdAt: string;
}

export type SurveySummary =
  | { questionId: string; prompt: string; type: 'single' | 'multiple'; answered: number; options: Array<{ option: string; count: number; percent: number }> }
  | { questionId: string; prompt: string; type: 'rating' | 'scale'; answered: number; average: number | null; distribution: Array<{ value: number; count: number }>; nps: number | null }
  | { questionId: string; prompt: string; type: 'text'; answered: number; latest: string[] };

export interface SurveyResults {
  survey: { id: string; title: string; anonymous: boolean; compulsory: boolean; status: string; responsesCount: number; questions: SurveyQuestion[] };
  summary: SurveySummary[];
  responses: Array<{ id: string; submittedAt: string; respondent: PersonSummary | null; answers: Record<string, SurveyAnswer> }>;
}

export interface FeedbackView {
  id: string;
  category: 'bug' | 'idea' | 'praise' | 'question' | 'other';
  rating: number | null;
  message: string;
  status: 'new' | 'reviewed' | 'planned' | 'done';
  page?: string | null;
  appVersion?: string | null;
  from?: PersonSummary;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackStats {
  total: number;
  averageRating: number | null;
  ratedCount: number;
  byCategory: Record<FeedbackView['category'], number>;
  byStatus: Record<FeedbackView['status'], number>;
}

export interface AdminOverview {
  people: Record<string, number>;
  activity: Record<string, number>;
  queues: Record<string, number>;
  email: Record<string, number>;
  modules: Array<{ name: string; status: string }>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  username: string;
  role: ApiRole;
  pendingRole: 'faculty' | 'expert' | null;
  status: string;
  verified: boolean;
  department: string | null;
  year: number | null;
  division: string | null;
  roleInfo: Record<string, string | number | null>;
  joinedAt: string;
  lastSignInAt: string | null;
  deletionScheduledFor: string | null;
}

export interface VerificationRow {
  id: string;
  kind: 'student_id' | 'faculty_role' | 'expert_role';
  status: string;
  note: string | null;
  reviewerNote: string | null;
  person: PersonSummary;
  email: string | null;
  roleInfo: Record<string, string | number | null>;
  documentUrl: string | null;
  createdAt: string;
}

export interface ReportQueueRow {
  reportId: string;
  targetType: string | null;
  targetId: string;
  priority: number;
  reports: number;
  reasons: string[];
  details: string[];
  preview: string;
  anonymous: boolean;
  firstReportedAt: string;
  lastReportedAt: string;
}

export interface QueueItem {
  id: string;
  title: string;
  submittedBy: PersonSummary;
  link: string;
  submittedAt: string;
}
