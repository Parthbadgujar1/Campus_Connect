// Study together: people studying right now, and study circles you can join from any device.
import { hoursAgo } from '@/lib/time';

export type MeetProvider = 'Google Meet' | 'Jitsi' | 'In app voice' | 'In person';

export interface StudyingNow {
  id: string;
  personId: string;
  topic: string;
  since: string;
  focus: 'Focused' | 'On a break';
  open: boolean;
}

export interface StudyCircle {
  id: string;
  name: string;
  subject: string;
  schedule: string;
  hostId: string;
  members: number;
  capacity: number;
  provider: MeetProvider;
  /** Where the session happens: a meeting URL, or a place for in-person sessions. */
  where: string;
  live: boolean;
  description: string;
}

export const studyingNow: StudyingNow[] = [
  { id: 'sn-1', personId: 'p-tanvi', topic: 'Deadlock and scheduling', since: hoursAgo(0.5), focus: 'Focused', open: true },
  { id: 'sn-2', personId: 'p-aditi', topic: 'ER diagrams for viva', since: hoursAgo(1), focus: 'Focused', open: true },
  { id: 'sn-3', personId: 'p-harsh', topic: 'Go concurrency', since: hoursAgo(0.2), focus: 'On a break', open: false },
  { id: 'sn-4', personId: 'p-rohan', topic: 'Graph problems', since: hoursAgo(1.5), focus: 'Focused', open: true },
];

export const studyCircles: StudyCircle[] = [
  {
    id: 'circle-dbms',
    name: 'DBMS viva sprint',
    subject: 'DBMS',
    schedule: 'Today · 7:30 pm',
    hostId: 'p-aditi',
    members: 6,
    capacity: 8,
    provider: 'Google Meet',
    where: 'https://meet.google.com/new',
    live: true,
    description: 'Normalisation, transactions and the past viva questions, one topic each evening.',
  },
  {
    id: 'circle-os',
    name: 'OS night owls',
    subject: 'Operating Systems',
    schedule: 'Tue, Thu · 10:00 pm',
    hostId: 'p-vishwajeet',
    members: 4,
    capacity: 6,
    provider: 'Jitsi',
    where: 'https://meet.jit.si/campusconnect-os-night-owls',
    live: false,
    description: 'Camera optional. We work through the lab sheet and quiz each other at the end.',
  },
  {
    id: 'circle-ml',
    name: 'ML lab partners',
    subject: 'Machine Learning',
    schedule: 'Saturday · 10:00 am',
    hostId: 'p-neha',
    members: 3,
    capacity: 5,
    provider: 'In person',
    where: 'Library, 2nd floor, reading room B',
    live: false,
    description: 'Bring your laptop. We finish one experiment together and review the output.',
  },
  {
    id: 'circle-hack',
    name: 'Hackathon study room',
    subject: 'Hackathons',
    schedule: 'Open now',
    hostId: 'p-pooja',
    members: 9,
    capacity: 12,
    provider: 'In app voice',
    where: 'In app',
    live: true,
    description: 'Quiet voice room while you code. Mute by default, speak when you need help.',
  },
];
