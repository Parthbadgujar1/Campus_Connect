// Domain types for the frontend. Keep these as the single source of truth for screens;
// a future backend can return the same shapes so mock data can be swapped out.

export type Role = 'student' | 'faculty' | 'expert' | 'admin';

export interface Person {
  id: string;
  name: string;
  username: string;
  role: Role | 'business';
  branch?: string;
  department?: string;
  year?: number;
  semester?: number;
  division?: string;
  bio?: string;
  skills: string[];
  interests: string[];
  verified: boolean;
  followers: number;
  following: number;
  github?: string;
  linkedin?: string;
  designation?: string;
}

export type PostScope = 'college' | 'department' | 'year' | 'division' | 'community';

export interface PollOption {
  label: string;
  votes: number;
}

export interface Post {
  id: string;
  authorId: string | 'anonymous';
  body: string;
  createdAt: string;
  scope: PostScope;
  scopeLabel?: string;
  tags: string[];
  likes: number;
  comments: number;
  saves: number;
  media?: { seed: string; label: string };
  poll?: { question: string; options: PollOption[] };
  pinned?: boolean;
  communityId?: string;
  kind?: 'post' | 'question' | 'anonymous' | 'announcement';
}

export type EventCategory =
  | 'Hackathon'
  | 'Workshop'
  | 'Seminar'
  | 'Webinar'
  | 'Competition'
  | 'Cultural'
  | 'Sports'
  | 'Club'
  | 'Meetup'
  | 'Fest'
  | 'Placement'
  | 'Academic';

export interface CampusEvent {
  id: string;
  title: string;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  venue: string;
  isOnline: boolean;
  organizer: string;
  organizerSlug?: string;
  description: string;
  tags: string[];
  capacity: number;
  going: number;
  interested: number;
  seed: string;
  registrationDeadline: string;
  certificate: boolean;
  fee?: string;
  chatId?: string;
  attendeeIds: string[];
  checkInCode: string;
}

export type OpportunityKind =
  | 'Internship'
  | 'Job'
  | 'Freelance'
  | 'Hackathon'
  | 'Competition'
  | 'Scholarship'
  | 'Research'
  | 'Workshop'
  | 'Certification'
  | 'Open Source'
  | 'Startup'
  | 'Ambassador'
  | 'Volunteering'
  | 'Part-time';

export type WorkMode = 'Remote' | 'On-site' | 'Hybrid';

export type ApplicationStage = 'Applied' | 'Shortlisted' | 'Interview' | 'Offer' | 'Rejected';

export interface Opportunity {
  id: string;
  title: string;
  org: string;
  kind: OpportunityKind;
  mode: WorkMode;
  location: string;
  pay: string;
  deadline: string;
  eligibleBranches: string[];
  minYear: number;
  skills: string[];
  description: string;
  seed: string;
  reviewsRating: number;
  reviewsCount: number;
  applicants: number;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  kind: 'Interest' | 'Department' | 'Exam' | 'Hostel' | 'City' | 'Club';
  privacy: 'Public' | 'Private';
  members: number;
  description: string;
  moderators: string[];
  tags: string[];
  seed: string;
  lead?: string;
  upcoming: number;
  chatId?: string;
  projects: string[];
  resources: string[];
}

export type ChatKind =
  | 'direct'
  | 'group'
  | 'class'
  | 'department'
  | 'community'
  | 'event'
  | 'anonymous'
  | 'temporary';

export interface Chat {
  id: string;
  kind: ChatKind;
  title: string;
  subtitle?: string;
  seed: string;
  memberIds: string[];
  unread: number;
  pinned?: boolean;
  muted?: boolean;
  online?: boolean;
  lastAt: string;
}

export type MessageType = 'text' | 'voice' | 'file' | 'poll' | 'system' | 'snap' | 'sticker' | 'ask' | 'plan';

export interface Message {
  id: string;
  chatId: string;
  from: string | 'me';
  type: MessageType;
  text?: string;
  createdAt: string;
  reactions?: Record<string, number>;
  replyTo?: string;
  file?: { name: string; size: string };
  voiceSeconds?: number;
  poll?: { question: string; options: PollOption[] };
  /** Emoji sticker shown large, without a lane. */
  sticker?: string;
  /** View-once photo: a seed for the placeholder and a caption. */
  snap?: { seed: string; caption: string };
  /** A small plan people can join: what, when and where. `text` is unused. */
  plan?: { title: string; when: string; where?: string; going: string[] };
}

export type ListingMode = 'Buy' | 'Borrow' | 'Exchange' | 'Free';

export interface MarketListing {
  id: string;
  title: string;
  mode: ListingMode;
  category: string;
  price: number | null;
  condition: 'New' | 'Like new' | 'Good' | 'Fair';
  sellerId: string;
  location: string;
  postedAt: string;
  seed: string;
  description: string;
  returnBy?: string;
  status: 'Available' | 'Reserved' | 'Borrowed' | 'Sold';
}

export type HousingKind = 'PG' | 'Room' | 'Hostel' | 'Flat';

export interface HousingListing {
  id: string;
  title: string;
  kind: HousingKind;
  rent: number;
  deposit: number;
  distanceKm: number;
  area: string;
  gender: 'Any' | 'Boys' | 'Girls' | 'Co-ed';
  food: 'Veg' | 'Non-veg' | 'Both' | 'No meals';
  amenities: string[];
  verified: boolean;
  rating: number;
  availableFrom: string;
  ownerName: string;
  seeds: string[];
  description: string;
  reports: number;
}

export interface RoommateMatch {
  personId: string;
  budget: number;
  area: string;
  food: 'Veg' | 'Non-veg' | 'Both';
  smoking: boolean;
  studyTime: 'Early bird' | 'Night owl' | 'Flexible';
  sleepBy: string;
  score: number;
  sharedInterests: string[];
}

export type TripPurpose = 'College trip' | 'Hackathon' | 'Event' | 'Festival' | 'Leisure';

export interface TripExpense {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  splitWith: string[];
  category: 'Transport' | 'Stay' | 'Food' | 'Other';
}

export interface Trip {
  id: string;
  destination: string;
  from: string;
  departs: string;
  returns: string;
  transport: 'Train' | 'Bus' | 'Flight' | 'Cab';
  budget: number;
  seats: number;
  seatsTaken: number;
  purpose: TripPurpose;
  organizerId: string;
  memberIds: string[];
  chatId?: string;
  itinerary: string[];
  expenses: TripExpense[];
}

export interface Service {
  id: string;
  title: string;
  category: string;
  providerId: string;
  price: string;
  rating: number;
  reviews: number;
  delivery: string;
  description: string;
  seed: string;
}

export interface Offer {
  id: string;
  business: string;
  category: string;
  headline: string;
  discount: string;
  code: string;
  validTill: string;
  distanceKm: number;
  verified: boolean;
  redeemed: number;
  seed: string;
  terms: string;
}

export interface StudyRoom {
  id: string;
  title: string;
  subject: string;
  type: 'Pomodoro' | 'Virtual room' | 'Group session' | 'Exam group' | 'Peer tutoring';
  hostId: string;
  members: number;
  live: boolean;
  schedule: string;
  focusMinutes: number;
  breakMinutes: number;
  tags: string[];
  seed: string;
  sharedNotes: string[];
}

export interface Tutor {
  id: string;
  personId: string;
  subjects: string[];
  rate: number;
  rating: number;
  sessions: number;
  availability: string[];
  bio: string;
  verified: boolean;
}

export interface WatchParty {
  id: string;
  title: string;
  source: 'YouTube' | 'Movie' | 'Educational' | 'Event livestream' | 'Screen share';
  hostId: string;
  viewers: number;
  live: boolean;
  startsAt: string;
  seed: string;
  description: string;
  chatId?: string;
}

export interface Game {
  id: string;
  title: string;
  type: 'Quiz' | 'Multiplayer' | 'Casual' | 'Trivia' | 'Coding' | 'Tournament' | 'Game night';
  players: number;
  status: 'Live' | 'Upcoming' | 'Open';
  description: string;
  prize?: string;
  seed: string;
}

export interface Meme {
  id: string;
  authorId: string | 'anonymous';
  caption: string;
  tag: 'Campus' | 'Department' | 'Exam' | 'Lecture' | 'Hostel' | 'Anonymous';
  upvotes: number;
  seed: string;
  contest?: boolean;
}

export type ResourceKind =
  | 'Notes'
  | 'PDF'
  | 'Previous papers'
  | 'Syllabus'
  | 'Lab manual'
  | 'Book'
  | 'Tutorial'
  | 'YouTube'
  | 'Cheat sheet'
  | 'Code';

export interface Resource {
  id: string;
  title: string;
  kind: ResourceKind;
  subject: string;
  semester: number;
  uploaderId: string;
  downloads: number;
  rating: number;
  sizeLabel: string;
  tags: string[];
  approved: boolean;
}

export interface Lecture {
  id: string;
  title: string;
  subject: string;
  facultyId: string;
  semester: number;
  durationMin: number;
  views: number;
  uploadedAt: string;
  seed: string;
  description: string;
  chapters: { at: number; label: string }[];
  notes: string[];
  published: boolean;
}

export interface Club {
  id: string;
  name: string;
  category: string;
  members: number;
  seed: string;
  lead: string;
  description: string;
  tags: string[];
}

export interface LostFoundItem {
  id: string;
  kind: 'lost' | 'found';
  item: string;
  category: string;
  location: string;
  when: string;
  description: string;
  reporterId: string;
  seed: string;
  status: 'Open' | 'Claim pending' | 'Returned';
}

export interface Notification {
  id: string;
  kind:
    | 'message'
    | 'event'
    | 'deadline'
    | 'opportunity'
    | 'community'
    | 'roommate'
    | 'marketplace'
    | 'travel'
    | 'announcement'
    | 'system';
  title: string;
  body: string;
  at: string;
  href?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  at: string;
  audience: string;
  pinned: boolean;
  category: 'Notice' | 'College news' | 'Results' | 'Event' | 'Club' | 'Important';
}
