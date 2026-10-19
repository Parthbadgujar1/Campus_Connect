import type { Chat, Message } from '@/lib/types';
import { daysAgo, hoursAgo, istAt } from '@/lib/time';

// Chats cover every chat type from the product brief: 1-to-1, group, class,
// department, community, event (incl. temporary), anonymous and trip chats.
export const chats: Chat[] = [
  {
    id: 'chat-pooja',
    kind: 'direct',
    title: 'Pooja Kulkarni',
    subtitle: 'Computer Engineering',
    seed: 'p-pooja',
    memberIds: ['me', 'p-pooja'],
    unread: 2,
    online: true,
    lastAt: hoursAgo(0.2),
    pinned: true,
  },
  {
    id: 'chat-dsa',
    kind: 'group',
    title: 'DSA Interview Prep',
    subtitle: '14 members',
    seed: 'chat-dsa',
    memberIds: ['me', 'p-rohan', 'p-tanvi', 'p-harsh', 'p-omkar', 'p-diya'],
    unread: 5,
    lastAt: hoursAgo(1),
    pinned: true,
  },
  {
    id: 'chat-dbms-b',
    kind: 'class',
    title: 'DBMS · Division B',
    subtitle: 'Class group · Prof. Anita Kulkarni',
    seed: 'chat-dbms-b',
    memberIds: ['me', 'f-anita', 'p-vishwajeet', 'p-aditi'],
    unread: 12,
    lastAt: hoursAgo(3),
  },
  {
    id: 'chat-cs-dept',
    kind: 'department',
    title: 'Computer Engineering · Year 3',
    subtitle: 'Department chat',
    seed: 'chat-cs-dept',
    memberIds: ['me', 'p-tanvi', 'p-harsh', 'p-vishwajeet'],
    unread: 0,
    muted: true,
    lastAt: hoursAgo(9),
  },
  {
    id: 'chat-event-hackathon',
    kind: 'event',
    title: '24H Hackathon · Team chat',
    subtitle: 'Event chat · Starts in 2 days',
    seed: 'ev-hackathon',
    memberIds: ['me', 'p-pooja', 'p-rohan', 'p-tanvi'],
    unread: 1,
    lastAt: hoursAgo(4),
  },
  {
    id: 'chat-gdsc',
    kind: 'community',
    title: 'GDSC Campus Chapter',
    subtitle: 'Community · 612 members',
    seed: 'gdsc',
    memberIds: ['me', 'p-pooja', 'p-harsh'],
    unread: 0,
    lastAt: hoursAgo(6),
  },
  {
    id: 'chat-flatmates',
    kind: 'group',
    title: 'Hostel B3 · Flatmates',
    subtitle: '3 members',
    seed: 'chat-flat',
    memberIds: ['me', 'p-sneha', 'p-kunal'],
    unread: 0,
    lastAt: daysAgo(1),
  },
  {
    id: 'chat-anon-lounge',
    kind: 'anonymous',
    title: 'Anonymous lounge',
    subtitle: 'Names hidden · be kind',
    seed: 'chat-anon',
    memberIds: ['me'],
    unread: 7,
    lastAt: hoursAgo(0.5),
  },
  {
    id: 'chat-trip-shirdi',
    kind: 'temporary',
    title: 'Shirdi trip · Oct 24',
    subtitle: 'Trip group · 5 of 6 seats',
    seed: 'chat-trip',
    memberIds: ['me', 'p-kunal', 'p-sneha', 'p-neha', 'p-shruti'],
    unread: 0,
    lastAt: daysAgo(2),
  },
  {
    id: 'chat-seller-cycle',
    kind: 'direct',
    title: 'Hybrid cycle · Seller',
    subtitle: 'Marketplace · Kunal Sawant',
    seed: 'chat-seller',
    memberIds: ['me', 'p-kunal'],
    unread: 0,
    lastAt: daysAgo(3),
  },
  {
    id: 'chat-print',
    kind: 'direct',
    title: 'Shree Print Hub',
    subtitle: 'Business · Printing',
    seed: 'b-print',
    memberIds: ['me', 'b-print'],
    unread: 0,
    lastAt: daysAgo(4),
  },
];

const messageLog: Record<string, Message[]> = {
  'chat-pooja': [
    { id: 'p1', chatId: 'chat-pooja', from: 'p-pooja', type: 'text', text: 'Did you see the hackathon poster outside the library?', createdAt: istAt(-1, 14, 5) },
    { id: 'p2', chatId: 'chat-pooja', from: 'me', type: 'text', text: 'Yes! The theme is campus sustainability 🌱', createdAt: istAt(-1, 14, 20) },
    { id: 'p3', chatId: 'chat-pooja', from: 'p-pooja', type: 'text', text: 'Dinner at the canteen? It’s paneer day 😋', createdAt: istAt(-1, 19, 40) },
    { id: 'p4', chatId: 'chat-pooja', from: 'me', type: 'text', text: 'Coming in 10', createdAt: istAt(-1, 19, 45) },
    { id: 'p5', chatId: 'chat-pooja', from: 'me', type: 'text', text: 'Goodnight, see you tomorrow ✨', createdAt: istAt(-1, 23, 10) },
    { id: 'm1', chatId: 'chat-pooja', from: 'p-pooja', type: 'text', text: 'Are you signing up for the hackathon? We need one more person with backend skills.', createdAt: hoursAgo(5) },
    { id: 'm2', chatId: 'chat-pooja', from: 'me', type: 'text', text: 'Yes! I can take the API and the data layer. Is Tanvi on the ML side?', createdAt: hoursAgo(4.8) },
    { id: 'm3', chatId: 'chat-pooja', from: 'p-pooja', type: 'text', text: 'Yes, she is. Let’s create the team chat today.', createdAt: hoursAgo(4.5), reactions: { '👍': 2 } },
    { id: 'm3s', chatId: 'chat-pooja', from: 'p-pooja', type: 'snap', snap: { seed: 'snap-hall', caption: 'The hall right now 😅' }, createdAt: hoursAgo(1) },
    { id: 'm4', chatId: 'chat-pooja', from: 'p-pooja', type: 'voice', voiceSeconds: 42, createdAt: hoursAgo(0.4) },
    { id: 'm5', chatId: 'chat-pooja', from: 'p-pooja', type: 'text', text: 'Also, the registration sheet closes Thursday night. Don’t forget.', createdAt: hoursAgo(0.2) },
  ],
  'chat-dsa': [
    { id: 'd1', chatId: 'chat-dsa', from: 'p-rohan', type: 'text', text: 'Mock interviews this week: Tue 7pm (graphs), Thu 7pm (DP). First come first served.', createdAt: hoursAgo(6) },
    { id: 'd2', chatId: 'chat-dsa', from: 'p-tanvi', type: 'ask', text: 'Can we add a sliding-window pattern session? @Rohan', createdAt: hoursAgo(3) },
    { id: 'd3', chatId: 'chat-dsa', from: 'p-rohan', type: 'text', text: 'Yes, Saturday. I will share the sheet before.', createdAt: hoursAgo(2.5), replyTo: 'd2' },
    { id: 'd4', chatId: 'chat-dsa', from: 'p-diya', type: 'file', file: { name: 'DSA-40-patterns.pdf', size: '2.4 MB' }, createdAt: hoursAgo(1.2) },
    { id: 'd5', chatId: 'chat-dsa', from: 'me', type: 'text', text: 'Saving this. Thank you!', createdAt: hoursAgo(1), reactions: { '🙏': 3 } },
    { id: 'd6', chatId: 'chat-dsa', from: 'p-rohan', type: 'sticker', sticker: '🔥', createdAt: hoursAgo(0.9) },
  ],
  'chat-dbms-b': [
    { id: 'b1', chatId: 'chat-dbms-b', from: 'f-anita', type: 'text', text: 'Viva list for Monday is updated in the portal. Normalisation and transactions are the focus.', createdAt: hoursAgo(5) },
    { id: 'b2', chatId: 'chat-dbms-b', from: 'system', type: 'system', text: 'Event reminder: DBMS viva · Monday 10:00 · Lab 4', createdAt: hoursAgo(4) },
    {
      id: 'b3',
      chatId: 'chat-dbms-b',
      from: 'p-vishwajeet',
      type: 'poll',
      poll: {
        question: 'Revision session before the viva?',
        options: [
          { label: 'Saturday morning', votes: 9 },
          { label: 'Sunday evening', votes: 14 },
        ],
      },
      createdAt: hoursAgo(3.5),
    },
    { id: 'b4', chatId: 'chat-dbms-b', from: 'p-aditi', type: 'text', text: 'Sunday works for me. Will bring the ER-diagram notes.', createdAt: hoursAgo(3) },
  ],
  'chat-event-hackathon': [
    { id: 'h1', chatId: 'chat-event-hackathon', from: 'p-pooja', type: 'text', text: 'Welcome team! Check-in opens at 8:30 AM on Friday. Please bring your student ID.', createdAt: hoursAgo(4) },
    { id: 'h3', chatId: 'chat-event-hackathon', from: 'p-rohan', type: 'plan', plan: { title: 'Team sync before check-in', when: 'Thu · 6:00 pm', where: 'Innovation Lab', going: ['p-pooja', 'p-rohan'] }, createdAt: hoursAgo(3.8) },
    { id: 'h2', chatId: 'chat-event-hackathon', from: 'p-tanvi', type: 'ask', text: 'Do we need to bring our own laptops for the GPU track?', createdAt: hoursAgo(3.5) },
  ],
  'chat-anon-lounge': [
    { id: 'a1', chatId: 'chat-anon-lounge', from: 'anon-1', type: 'text', text: 'Does anyone have the old notes for Compiler Design? Trying to avoid the library.', createdAt: hoursAgo(1) },
    { id: 'a2', chatId: 'chat-anon-lounge', from: 'anon-2', type: 'text', text: 'Check the Resource Hub → previous papers. Someone uploaded them last week.', createdAt: hoursAgo(0.8) },
  ],
  'chat-flatmates': [
    { id: 'f1', chatId: 'chat-flatmates', from: 'p-sneha', type: 'text', text: 'Rent for October is due on the 5th. I have pinned the UPI QR in the group.', createdAt: daysAgo(1) },
    { id: 'f2', chatId: 'chat-flatmates', from: 'me', type: 'text', text: 'Paid! Screenshot shared in the rent tracker.', createdAt: daysAgo(1) },
  ],
  'chat-trip-shirdi': [
    { id: 't1', chatId: 'chat-trip-shirdi', from: 'p-kunal', type: 'text', text: 'Train tickets are booked for Oct 24. Sleeper class, 5 of us so far.', createdAt: daysAgo(2) },
    { id: 't2', chatId: 'chat-trip-shirdi', from: 'me', type: 'text', text: 'Add my share to the expense tracker, I covered the cab.', createdAt: daysAgo(2) },
  ],
};

export function getChat(id: string): Chat | undefined {
  return chats.find((chat) => chat.id === id);
}

export function getMessages(chatId: string): Message[] {
  return messageLog[chatId] ?? [];
}

/** People you talk to most, with daily streaks, shown as orbs above the chat list. */
export const closeCircle: { personId: string; chatId?: string; streak: number; activity: string }[] = [
  { personId: 'p-pooja', chatId: 'chat-pooja', streak: 23, activity: 'In Innovation Lab' },
  { personId: 'p-tanvi', streak: 12, activity: 'Studying · Library' },
  { personId: 'p-rohan', streak: 8, activity: 'Mock interview at 7' },
  { personId: 'p-aditi', streak: 5, activity: 'Designing' },
  { personId: 'p-kunal', chatId: 'chat-seller-cycle', streak: 3, activity: 'At the ground' },
  { personId: 'p-harsh', streak: 0, activity: 'Gaming tonight' },
];

/** Big emoji stickers for the sticker tray. */
export const stickers = ['🔥', '😂', '🥹', '🙏', '💯', '🎉', '😴', '☕', '📚', '🤝', '👀', '💜', '🫶', '🤯', '🙌', '✨'];

/** Per-chat ambience: a soft wallpaper wash behind the conversation. */
export const chatAmbiences: { id: string; name: string; wash: string }[] = [
  { id: 'none', name: 'Clear', wash: 'transparent' },
  { id: 'meadow', name: 'Meadow', wash: 'radial-gradient(120% 80% at 0% 0%, rgb(127 184 167 / 0.22), transparent 60%), radial-gradient(90% 70% at 100% 100%, rgb(214 228 207 / 0.35), transparent 60%)' },
  { id: 'ocean', name: 'Ocean', wash: 'radial-gradient(120% 80% at 100% 0%, rgb(120 160 214 / 0.22), transparent 60%), radial-gradient(90% 70% at 0% 100%, rgb(160 206 220 / 0.3), transparent 60%)' },
  { id: 'blossom', name: 'Blossom', wash: 'radial-gradient(120% 80% at 0% 100%, rgb(232 160 180 / 0.22), transparent 60%), radial-gradient(90% 70% at 100% 0%, rgb(196 179 236 / 0.3), transparent 60%)' },
  { id: 'ember', name: 'Ember', wash: 'radial-gradient(120% 80% at 50% 0%, rgb(232 168 110 / 0.25), transparent 60%), radial-gradient(90% 70% at 50% 100%, rgb(214 140 120 / 0.2), transparent 60%)' },
];
