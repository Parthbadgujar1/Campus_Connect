import type { ApiRole, Me } from './api/types';

// What each role sees after signing in. The API checks every action again on the server; this
// only decides which tabs, tiles and buttons are shown, so nobody is offered something they
// cannot use.
//
//   student    the full student app
//   faculty    the student app plus teaching tools (notices, lectures, Shelf reviews)
//   expert     industry mentors: careers, people, chats, spaces (no hostel or market tools)
//   moderator  the student app plus moderation (reports, people, content queue)
//   admin      everything, including surveys, feedback, feature switches and the system page

export type Capability =
  | 'feed'
  | 'chats'
  | 'spaces'
  | 'events'
  | 'events.create'
  | 'news'
  | 'news.publish'
  | 'shelf'
  | 'shelf.review'
  | 'lectures'
  | 'lectures.publish'
  | 'opportunities'
  | 'opportunities.post'
  | 'hush'
  | 'lostFound'
  | 'market'
  | 'games'
  | 'study'
  | 'loops'
  | 'surveys'
  | 'feedback'
  | 'admin'
  | 'admin.moderation'
  | 'admin.people'
  | 'admin.queue'
  | 'admin.surveys'
  | 'admin.feedback'
  | 'admin.system';

const STUDENT: Capability[] = ['feed', 'chats', 'spaces', 'events', 'events.create', 'news', 'shelf', 'lectures', 'opportunities', 'opportunities.post', 'hush', 'lostFound', 'market', 'games', 'study', 'loops', 'surveys', 'feedback'];

const ROLE_CAPABILITIES: Record<ApiRole, Capability[]> = {
  student: STUDENT,
  faculty: [...STUDENT, 'news.publish', 'shelf.review', 'lectures.publish', 'admin', 'admin.queue'],
  expert: ['feed', 'chats', 'spaces', 'events', 'news', 'shelf', 'lectures', 'opportunities', 'opportunities.post', 'hush', 'loops', 'surveys', 'feedback'],
  moderator: [...STUDENT, 'news.publish', 'shelf.review', 'admin', 'admin.moderation', 'admin.people', 'admin.queue', 'admin.feedback'],
  admin: [...STUDENT, 'news.publish', 'shelf.review', 'lectures.publish', 'admin', 'admin.moderation', 'admin.people', 'admin.queue', 'admin.surveys', 'admin.feedback', 'admin.system'],
};

export function can(user: Pick<Me, 'role'> | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  return ROLE_CAPABILITIES[user.role]?.includes(capability) ?? false;
}

export const ROLE_LABEL: Record<ApiRole, string> = {
  student: 'Student',
  faculty: 'Faculty',
  expert: 'Industry expert',
  moderator: 'Moderator',
  admin: 'Admin',
};

/** Which capability a page needs, by path prefix. Pages not listed are open to every role. */
const PAGE_CAPABILITY: Array<[RegExp, Capability]> = [
  [/^\/admin\/surveys/, 'admin.surveys'],
  [/^\/admin\/feedback/, 'admin.feedback'],
  [/^\/admin\/(system|inbox|colleges)/, 'admin.system'],
  [/^\/admin\/content/, 'admin.queue'],
  [/^\/admin\/(people|students|roles)/, 'admin.people'],
  [/^\/admin\/moderation/, 'admin.moderation'],
  [/^\/admin/, 'admin'],
  [/^\/lost-found/, 'lostFound'],
  [/^\/marketplace/, 'market'],
  [/^\/games/, 'games'],
  [/^\/study/, 'study'],
];

export function capabilityFor(pathname: string): Capability | null {
  for (const [pattern, capability] of PAGE_CAPABILITY) if (pattern.test(pathname)) return capability;
  return null;
}
