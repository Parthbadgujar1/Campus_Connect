// Moments: short-lived updates (24 hours) shown as orbs on Home and in Chats.

import { hoursAgo } from '@/lib/time';

export interface MomentFrame {
  id: string;
  seed: string;
  caption: string;
  at: string;
}

export interface MomentSet {
  personId: string;
  frames: MomentFrame[];
}

export const momentSets: MomentSet[] = [
  {
    personId: 'p-pooja',
    frames: [
      { id: 'mo-pooja-1', seed: 'mo-pooja-1', caption: 'Setting up the hackathon hall ✨', at: hoursAgo(1) },
      { id: 'mo-pooja-2', seed: 'mo-pooja-2', caption: '120 chairs. 40 extension boards. 1 very tired organiser.', at: hoursAgo(0.6) },
    ],
  },
  {
    personId: 'p-aditi',
    frames: [{ id: 'mo-aditi-1', seed: 'mo-aditi-1', caption: 'Workshop slides are live — come Saturday', at: hoursAgo(3) }],
  },
  {
    personId: 'p-tanvi',
    frames: [
      { id: 'mo-tanvi-1', seed: 'mo-tanvi-1', caption: 'Kaggle leaderboard moved 40 spots!', at: hoursAgo(4) },
      { id: 'mo-tanvi-2', seed: 'mo-tanvi-2', caption: 'Celebrating with canteen chai ☕', at: hoursAgo(3.5) },
      { id: 'mo-tanvi-3', seed: 'mo-tanvi-3', caption: 'Back to work. Next target: top 100.', at: hoursAgo(3) },
    ],
  },
  {
    personId: 'p-aryan',
    frames: [{ id: 'mo-aryan-1', seed: 'mo-aryan-1', caption: 'Chassis weld test: passed.', at: hoursAgo(6) }],
  },
  {
    personId: 'p-shruti',
    frames: [{ id: 'mo-shruti-1', seed: 'mo-shruti-1', caption: 'Fresh issue of the campus paper is out 📰', at: hoursAgo(8) }],
  },
  {
    personId: 'p-harsh',
    frames: [
      { id: 'mo-harsh-1', seed: 'mo-harsh-1', caption: 'Gaming night brackets drop Thursday', at: hoursAgo(10) },
      { id: 'mo-harsh-2', seed: 'mo-harsh-2', caption: 'Controllers: charged. Snacks: pending.', at: hoursAgo(9) },
    ],
  },
];
