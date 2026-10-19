// Spaces = communities with rooms (text channels, voice lounges) and a board of
// threads with votes and nested replies. Built on top of the community list.

import { communities } from './communities';
import type { Community, Message } from '@/lib/types';
import { daysAgo, hoursAgo } from '@/lib/time';

export interface Channel {
  id: string;
  name: string;
  topic: string;
  unread: number;
  kind: 'text' | 'announcements';
}

export interface VoiceRoom {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Space extends Community {
  channels: Channel[];
  voice: VoiceRoom[];
  online: number;
}

export interface Thread {
  id: string;
  spaceSlug: string;
  title: string;
  body: string;
  authorId: string;
  flair: string;
  score: number;
  comments: number;
  createdAt: string;
  pinned?: boolean;
}

export interface ThreadComment {
  id: string;
  threadId: string;
  parentId: string | null;
  authorId: string;
  body: string;
  score: number;
  createdAt: string;
}

const DEFAULT_CHANNELS: Channel[] = [
  { id: 'announcements', name: 'announcements', topic: 'Updates from moderators', unread: 0, kind: 'announcements' },
  { id: 'general', name: 'general', topic: 'Say hi and talk about anything', unread: 3, kind: 'text' },
  { id: 'resources', name: 'resources', topic: 'Links, notes and guides', unread: 0, kind: 'text' },
];

const EXTRAS: Record<string, Partial<Pick<Space, 'channels' | 'voice' | 'online'>>> = {
  gdsc: {
    online: 48,
    channels: [
      { id: 'announcements', name: 'announcements', topic: 'Hackathon updates and workshop schedules', unread: 1, kind: 'announcements' },
      { id: 'general', name: 'general', topic: 'Anything tech', unread: 6, kind: 'text' },
      { id: 'hackathon', name: 'hackathon-2026', topic: 'Teams, ideas and mentor slots', unread: 12, kind: 'text' },
      { id: 'cloud', name: 'cloud-study-jam', topic: 'Weekly cloud labs', unread: 0, kind: 'text' },
    ],
    voice: [
      { id: 'lounge', name: 'Lounge', memberIds: ['p-pooja', 'p-harsh', 'p-tanvi'] },
      { id: 'mentor', name: 'Mentor desk', memberIds: [] },
    ],
  },
  'dsa-club': {
    online: 31,
    channels: [
      { id: 'general', name: 'general', topic: 'Patterns, problems, progress', unread: 4, kind: 'text' },
      { id: 'daily', name: 'daily-problem', topic: 'One problem a day, discuss after 9 PM', unread: 2, kind: 'text' },
      { id: 'interviews', name: 'mock-interviews', topic: 'Sign-ups and feedback', unread: 0, kind: 'text' },
    ],
    voice: [{ id: 'pair', name: 'Pair programming', memberIds: ['p-rohan', 'p-omkar'] }],
  },
  'gaming-guild': {
    online: 62,
    channels: [
      { id: 'general', name: 'general', topic: 'GG only', unread: 9, kind: 'text' },
      { id: 'lfg', name: 'looking-for-group', topic: 'Find a squad for tonight', unread: 5, kind: 'text' },
      { id: 'clips', name: 'clips', topic: 'Your best plays', unread: 0, kind: 'text' },
    ],
    voice: [
      { id: 'squad-1', name: 'Squad 1', memberIds: ['p-harsh', 'p-kunal', 'p-aryan', 'p-sanket'] },
      { id: 'chill', name: 'Chill lobby', memberIds: ['p-shruti'] },
    ],
  },
};

export const spaces: Space[] = communities.map((community) => {
  const extra = EXTRAS[community.slug] ?? {};
  return {
    ...community,
    channels: extra.channels ?? DEFAULT_CHANNELS,
    voice: extra.voice ?? [{ id: 'lounge', name: 'Lounge', memberIds: [] }],
    online: extra.online ?? Math.max(3, Math.round(community.members * 0.06)),
  };
});

export function getSpace(slug: string): Space | undefined {
  return spaces.find((space) => space.slug === slug);
}

export const threads: Thread[] = [
  { id: 't-hack-teams', spaceSlug: 'gdsc', title: 'Team formation thread — post your skills and what you want to build', body: 'Reply with your stack, what you want to build and how many teammates you need. Mods will pin complete teams by Thursday night.', authorId: 'p-pooja', flair: 'Pinned', score: 214, comments: 6, createdAt: hoursAgo(5), pinned: true },
  { id: 't-hack-gpu', spaceSlug: 'gdsc', title: 'Is the GPU track allowed to use hosted APIs?', body: 'Trying to understand whether calling a hosted model counts as “building” for the AI track, or if we need to fine-tune something ourselves.', authorId: 'p-tanvi', flair: 'Question', score: 87, comments: 4, createdAt: hoursAgo(3) },
  { id: 't-cloud-lab', spaceSlug: 'gdsc', title: 'Cloud study jam: lab 3 solutions walkthrough (no spoilers in titles)', body: 'Posting the approach for lab 3. Open only after you have tried it yourself!', authorId: 'p-harsh', flair: 'Resource', score: 56, comments: 2, createdAt: daysAgo(1) },
  { id: 't-dsa-patterns', spaceSlug: 'dsa-club', title: 'The 40 patterns sheet — what would you add?', body: 'The sheet covers sliding window, two pointers, monotonic stack, BFS/DFS, DP on subsequences… What is missing for product-company interviews?', authorId: 'p-rohan', flair: 'Discussion', score: 341, comments: 5, createdAt: daysAgo(1) },
  { id: 't-dsa-dp', spaceSlug: 'dsa-club', title: 'DP finally clicked for me after drawing the state table by hand', body: 'Sharing in case it helps: write the state, the choice and the base case before any code. My accuracy went from 30% to 70% in two weeks.', authorId: 'p-omkar', flair: 'Win', score: 198, comments: 1, createdAt: daysAgo(2) },
  { id: 't-gaming-bracket', spaceSlug: 'gaming-guild', title: 'Friday Smash bracket is up — check your seed', body: 'Eight players, single elimination. Seeds are based on last month’s results. Bring your own controller if you have one.', authorId: 'p-harsh', flair: 'Event', score: 122, comments: 3, createdAt: hoursAgo(8) },
  { id: 't-gaming-lfg', spaceSlug: 'gaming-guild', title: 'Need two for ranked tonight (10 PM)', body: 'Gold/Plat. Mics on, chill vibes, no tilt.', authorId: 'p-kunal', flair: 'LFG', score: 34, comments: 2, createdAt: hoursAgo(2) },
  { id: 't-cs-viva', spaceSlug: 'computer-engineering', title: 'DBMS viva list — official version is in the portal', body: 'Please stop sharing the old list. The portal has the final one, and normalisation plus transactions are the focus.', authorId: 'f-anita', flair: 'Official', score: 276, comments: 2, createdAt: hoursAgo(6), pinned: true },
  { id: 't-pune-meetup', spaceSlug: 'students-pune', title: 'Sunday cricket at Balewadi — who is in?', body: 'Open to every college. We have two teams so far. Bring water.', authorId: 'p-diya', flair: 'Meetup', score: 64, comments: 1, createdAt: daysAgo(1) },
  { id: 't-design-crit', spaceSlug: 'design-club', title: 'Crit night: share one screen you are stuck on', body: 'Drop a screenshot description and what feels off. Kind, specific feedback only.', authorId: 'p-aditi', flair: 'Feedback', score: 73, comments: 2, createdAt: daysAgo(2) },
];

export const threadComments: ThreadComment[] = [
  { id: 'c1', threadId: 't-hack-teams', parentId: null, authorId: 'p-tanvi', body: 'ML + Python. Want to build a campus energy predictor. Need a frontend person and a designer.', score: 41, createdAt: hoursAgo(4.5) },
  { id: 'c2', threadId: 't-hack-teams', parentId: 'c1', authorId: 'me', body: 'I can do the frontend in React! DMing you.', score: 18, createdAt: hoursAgo(4.2) },
  { id: 'c3', threadId: 't-hack-teams', parentId: 'c2', authorId: 'p-aditi', body: 'Designer here, if you still need one 👋', score: 12, createdAt: hoursAgo(4) },
  { id: 'c4', threadId: 't-hack-teams', parentId: null, authorId: 'p-harsh', body: 'Go + Docker. Looking for a team doing anything infra-heavy.', score: 22, createdAt: hoursAgo(3.8) },
  { id: 'c5', threadId: 't-hack-teams', parentId: 'c4', authorId: 'p-pooja', body: 'Pinged you about the IoT team, they need a backend person.', score: 9, createdAt: hoursAgo(3.5) },
  { id: 'c6', threadId: 't-hack-teams', parentId: null, authorId: 'p-neha', body: 'First year, Python basics. Is it okay to join as a learner?', score: 37, createdAt: hoursAgo(3) },
  { id: 'c7', threadId: 't-hack-gpu', parentId: null, authorId: 'p-pooja', body: 'Hosted APIs are allowed, but judges weigh what you built around them.', score: 30, createdAt: hoursAgo(2.6) },
  { id: 'c8', threadId: 't-hack-gpu', parentId: 'c7', authorId: 'p-tanvi', body: 'Perfect, that is what I hoped. Thanks!', score: 6, createdAt: hoursAgo(2.4) },
  { id: 'c9', threadId: 't-dsa-patterns', parentId: null, authorId: 'p-tanvi', body: 'Union-find! Shows up a lot in graph questions.', score: 52, createdAt: daysAgo(1) },
  { id: 'c10', threadId: 't-dsa-patterns', parentId: 'c9', authorId: 'p-rohan', body: 'Good call, adding it with three practice problems.', score: 19, createdAt: daysAgo(1) },
  { id: 'c11', threadId: 't-dsa-patterns', parentId: null, authorId: 'p-harsh', body: 'Bit manipulation tricks too.', score: 14, createdAt: daysAgo(1) },
  { id: 'c12', threadId: 't-gaming-bracket', parentId: null, authorId: 'p-kunal', body: 'Seed 3 lets gooo 🔥', score: 11, createdAt: hoursAgo(6) },
];

export function getThread(id: string): Thread | undefined {
  return threads.find((thread) => thread.id === id);
}

// Seed lines for text rooms. Any room without its own script gets the general one.
const ROOM_SCRIPTS: Record<string, [string, string][]> = {
  announcements: [
    ['mod', 'Welcome! Read the pinned guidelines on the board before posting.'],
    ['mod', 'Next meetup is on the events tab. RSVP so we can plan seats.'],
  ],
  general: [
    ['a', 'Morning all ☀️ anyone at the library already?'],
    ['b', 'Second floor, window side. Plenty of seats.'],
    ['c', 'Heading there after the 11 o’clock lecture'],
    ['a', 'Bring chai 🙏'],
  ],
  resources: [
    ['b', 'Dropped the cheat sheet from last week’s session in the hub.'],
    ['c', 'Thank you!! The diagrams are 🔥'],
  ],
  hackathon: [
    ['a', 'Mentor slots for Saturday are open, 15 minutes each'],
    ['b', 'Booked 4:15 for team Byte Me'],
    ['c', 'Is there a theme list yet?'],
    ['mod', 'Themes go live tomorrow at 9 AM. Stay tuned.'],
  ],
  daily: [
    ['mod', 'Today: longest substring without repeating characters. Discuss after 9 PM, no spoilers.'],
    ['a', 'Sliding window gang 🙌'],
  ],
  lfg: [
    ['a', 'Need 2 for ranked at 10, mics on'],
    ['b', 'I’m in'],
    ['c', 'Same, ping me'],
  ],
};

/** Messages for a space's text room, voiced by people from the space. */
export function roomMessages(space: Space, channelId: string): Message[] {
  const script = ROOM_SCRIPTS[channelId] ?? ROOM_SCRIPTS.general;
  const voices = [...new Set([...space.voice.flatMap((v) => v.memberIds), 'p-pooja', 'p-tanvi', 'p-harsh', 'p-aditi'])];
  const cast: Record<string, string> = { a: voices[0], b: voices[1], c: voices[2], mod: voices[3] };
  return script.map(([who, text], i) => ({
    id: `${space.slug}-${channelId}-${i}`,
    chatId: `${space.slug}-${channelId}`,
    from: cast[who],
    type: 'text',
    text,
    createdAt: hoursAgo((script.length - i) * 0.4),
  }));
}
