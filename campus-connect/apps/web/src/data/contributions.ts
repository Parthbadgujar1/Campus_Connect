// Your ink: what you have shared, answered and helped with. The points and levels are a
// prototype; the backend will calculate them from approvals and thanks.
import { daysAgo, hoursAgo } from '@/lib/time';

export type InkKind = 'Note' | 'Answer' | 'Help' | 'Question';

export interface Ink {
  id: string;
  kind: InkKind;
  title: string;
  subject: string;
  at: string;
  thanks: number;
  status: 'Approved' | 'Pending' | 'Answered' | 'Open';
  href: string;
}

export const myInk: Ink[] = [
  { id: 'ink-1', kind: 'Note', title: 'Normalisation worked examples (1NF to BCNF)', subject: 'DBMS', at: daysAgo(2), thanks: 46, status: 'Approved', href: '/resources' },
  { id: 'ink-2', kind: 'Answer', title: 'Why is the semaphore wait before the critical section?', subject: 'Operating Systems', at: daysAgo(3), thanks: 22, status: 'Answered', href: '/hush' },
  { id: 'ink-3', kind: 'Help', title: 'Helped with a Flask login bug in a hackathon team', subject: 'Hackathons', at: daysAgo(6), thanks: 9, status: 'Answered', href: '/help' },
  { id: 'ink-4', kind: 'Note', title: 'Viva cheat sheet for Computer Networks', subject: 'Computer Networks', at: hoursAgo(20), thanks: 0, status: 'Pending', href: '/resources' },
  { id: 'ink-5', kind: 'Question', title: 'How do I start with Go modules?', subject: 'Go', at: daysAgo(9), thanks: 4, status: 'Answered', href: '/help' },
];

export const inkSummary = {
  points: 1280,
  level: 4,
  nextLevelPoints: 1500,
  notesApproved: 5,
  answersAccepted: 3,
  thanks: myInk.reduce((sum, item) => sum + item.thanks, 0),
};
