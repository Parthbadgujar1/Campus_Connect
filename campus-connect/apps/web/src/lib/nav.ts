import type { LucideIcon } from 'lucide-react';
import { Compass, House, Landmark, MessagesSquare, UserRound } from 'lucide-react';

export type Section = 'home' | 'campus' | 'discover' | 'chats' | 'you';

export interface TabItem {
  section: Section;
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Tab order: Discover sits in the centre where a thumb lands most easily. */
export const TABS: TabItem[] = [
  { section: 'home', label: 'Home', href: '/', icon: House },
  { section: 'campus', label: 'Campus', href: '/campus', icon: Landmark },
  { section: 'discover', label: 'Discover', href: '/discover', icon: Compass },
  { section: 'chats', label: 'Chats', href: '/chats', icon: MessagesSquare },
  { section: 'you', label: 'You', href: '/you', icon: UserRound },
];

// Every screen belongs to one tab, so the right tab stays highlighted.
const SECTION_PREFIXES: Record<Exclude<Section, 'home'>, string[]> = {
  campus: [
    '/campus', '/study', '/resources', '/contributions', '/lectures', '/events', '/news', '/lost-found', '/help',
    '/feedback', '/safety', '/opportunities', '/jobs', '/teams', '/placements', '/achievements', '/mentorship',
    '/housing', '/marketplace', '/services', '/offers', '/travel', '/finance', '/business', '/academics', '/id',
    '/opportunities',
  ],
  discover: [
    '/discover', '/spaces', '/loops', '/hush', '/games', '/trending', '/creators', '/network', '/memes', '/connect',
    '/search', '/watch',
  ],
  chats: ['/chats'],
  you: ['/you', '/settings', '/profile', '/verify', '/admin', '/login'],
};

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function sectionFor(pathname: string): Section {
  for (const section of ['chats', 'you', 'discover', 'campus'] as const) {
    if (SECTION_PREFIXES[section].some((prefix) => matches(pathname, prefix))) return section;
  }
  return 'home';
}

/** Routes that take over the whole screen on a phone (no tab bar). */
export const FULLSCREEN_PATTERN = /^\/(chats\/[^/]+|watch\/(v|party)\/[^/]+|loops|spaces\/[^/]+\/c\/[^/]+)$/;
