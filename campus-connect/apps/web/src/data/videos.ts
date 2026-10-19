// Watch: channels and videos. Faculty lectures and student creator videos live in
// one library so the same player and cards serve both.

import { lectures } from './learning';
import { daysAgo, hoursAgo } from '@/lib/time';

export interface VideoChannel {
  id: string;
  name: string;
  personId: string;
  handle: string;
  subscribers: number;
  kind: 'Faculty' | 'Creator' | 'Club';
  blurb: string;
}

export interface Video {
  id: string;
  title: string;
  channelId: string;
  kind: 'Lecture' | 'Creator';
  durationMin: number;
  views: number;
  uploadedAt: string;
  seed: string;
  description: string;
  subject?: string;
  semester?: number;
  chapters: { at: number; label: string }[];
  notes: string[];
}

export const channels: VideoChannel[] = [
  { id: 'ch-anita', name: 'Prof. Anita Kulkarni', personId: 'f-anita', handle: '@dbms-with-anita', subscribers: 1840, kind: 'Faculty', blurb: 'DBMS and operating systems, one concept at a time.' },
  { id: 'ch-neha', name: 'Dr. Neha Pawar', personId: 'f-neha', handle: '@ml-lab', subscribers: 1320, kind: 'Faculty', blurb: 'Applied machine learning with notebooks you can run.' },
  { id: 'ch-manoj', name: 'Prof. Manoj Gore', personId: 'f-manoj', handle: '@maths-made-calm', subscribers: 960, kind: 'Faculty', blurb: 'Engineering maths without panic.' },
  { id: 'ch-sandeep', name: 'Dr. Sandeep Joshi', personId: 'f-sandeep', handle: '@signals', subscribers: 610, kind: 'Faculty', blurb: 'Signals, systems and communication.' },
  { id: 'ch-ritu', name: 'Prof. Ritu Mehta', personId: 'f-ritu', handle: '@thermo', subscribers: 420, kind: 'Faculty', blurb: 'Thermodynamics, experiments and design.' },
  { id: 'ch-vishwajeet', name: 'OS in 60 seconds', personId: 'p-vishwajeet', handle: '@os60', subscribers: 2210, kind: 'Creator', blurb: 'Operating systems explained in short, honest bites.' },
  { id: 'ch-harsh', name: 'Harsh builds', personId: 'p-harsh', handle: '@harshbuilds', subscribers: 1480, kind: 'Creator', blurb: 'Linux, Go and side projects, live-coded.' },
  { id: 'ch-aditi', name: 'Aditi designs', personId: 'p-aditi', handle: '@aditi.designs', subscribers: 3050, kind: 'Creator', blurb: 'Figma, type and colour for engineers.' },
  { id: 'ch-gdsc', name: 'GDSC Campus Chapter', personId: 'p-pooja', handle: '@gdsc-campus', subscribers: 2760, kind: 'Club', blurb: 'Workshops, talks and hackathon recaps.' },
];

const FACULTY_CHANNEL: Record<string, string> = {
  'f-anita': 'ch-anita',
  'f-neha': 'ch-neha',
  'f-manoj': 'ch-manoj',
  'f-sandeep': 'ch-sandeep',
  'f-ritu': 'ch-ritu',
};

const lectureVideos: Video[] = lectures
  .filter((lecture) => lecture.published)
  .map((lecture) => ({
    id: lecture.id,
    title: lecture.title,
    channelId: FACULTY_CHANNEL[lecture.facultyId] ?? 'ch-anita',
    kind: 'Lecture' as const,
    durationMin: lecture.durationMin,
    views: lecture.views,
    uploadedAt: lecture.uploadedAt,
    seed: lecture.seed,
    description: lecture.description,
    subject: lecture.subject,
    semester: lecture.semester,
    chapters: lecture.chapters,
    notes: lecture.notes,
  }));

const creatorVideos: Video[] = [
  { id: 'v-os-scheduling', title: 'CPU scheduling, explained with a canteen queue', channelId: 'ch-vishwajeet', kind: 'Creator', durationMin: 9, views: 5420, uploadedAt: daysAgo(3), seed: 'v-os-scheduling', description: 'FCFS, SJF and Round Robin with the Monday canteen line as the example.', chapters: [{ at: 0, label: 'The queue' }, { at: 180, label: 'Round Robin' }], notes: [] },
  { id: 'v-linux-30', title: '30 Linux commands I use every day', channelId: 'ch-harsh', kind: 'Creator', durationMin: 14, views: 3810, uploadedAt: daysAgo(5), seed: 'v-linux-30', description: 'From grep to tmux, a calm tour with real examples.', chapters: [{ at: 0, label: 'Navigation' }, { at: 360, label: 'Text tools' }, { at: 660, label: 'tmux' }], notes: [] },
  { id: 'v-figma-autolayout', title: 'Auto layout in Figma, the gentle way', channelId: 'ch-aditi', kind: 'Creator', durationMin: 11, views: 8920, uploadedAt: daysAgo(2), seed: 'v-figma-autolayout', description: 'Build a card, a list and a responsive nav with auto layout.', chapters: [{ at: 0, label: 'Basics' }, { at: 300, label: 'Nesting' }], notes: [] },
  { id: 'v-hack-recap', title: 'Hackathon 2025 recap — what the winners did differently', channelId: 'ch-gdsc', kind: 'Creator', durationMin: 7, views: 4310, uploadedAt: hoursAgo(20), seed: 'v-hack-recap', description: 'Five teams, five lessons. Watch before this year’s hackathon.', chapters: [], notes: [] },
  { id: 'v-colour-dark', title: 'Designing dark mode that does not hurt your eyes', channelId: 'ch-aditi', kind: 'Creator', durationMin: 8, views: 6120, uploadedAt: daysAgo(6), seed: 'v-colour-dark', description: 'Contrast, elevation and why pure black is a trap.', chapters: [], notes: [] },
  { id: 'v-go-api', title: 'A tiny Go API in 20 minutes', channelId: 'ch-harsh', kind: 'Creator', durationMin: 21, views: 2140, uploadedAt: daysAgo(9), seed: 'v-go-api', description: 'Routes, JSON and tests with nothing but the standard library.', chapters: [{ at: 0, label: 'Setup' }, { at: 600, label: 'Handlers' }], notes: [] },
];

export const videos: Video[] = [...lectureVideos, ...creatorVideos];

export function getVideo(id: string): Video | undefined {
  return videos.find((video) => video.id === id);
}

export function getChannel(id: string): VideoChannel | undefined {
  return channels.find((channel) => channel.id === id);
}

/** Per-viewer watch progress (0–100) for the "Continue watching" row. */
export const watchProgress: Record<string, number> = {
  'lec-dbms-normal': 45,
  'v-figma-autolayout': 70,
  'lec-maths-laplace': 20,
};

export const loops = [
  { id: 'loop-1', authorId: 'p-tanvi', caption: 'Gradient descent in 30 seconds', audio: 'Original audio · Tanvi', likes: 1820, replies: 143, seed: 'loop-1' },
  { id: 'loop-2', authorId: 'p-vishwajeet', caption: 'Deadlocks, but make it a traffic jam', audio: 'OS notes · Vishwajeet', likes: 2640, replies: 221, seed: 'loop-2' },
  { id: 'loop-3', authorId: 'p-aryan', caption: 'Chassis weld test. Goggles stay on.', audio: 'Workshop ambience', likes: 911, replies: 58, seed: 'loop-3' },
  { id: 'loop-4', authorId: 'p-harsh', caption: 'Friday bracket reveal', audio: 'Gaming Guild', likes: 1302, replies: 96, seed: 'loop-4' },
  { id: 'loop-5', authorId: 'p-aditi', caption: 'Auto layout in one minute', audio: 'Original audio · Aditi', likes: 3015, replies: 302, seed: 'loop-5' },
  { id: 'loop-6', authorId: 'p-kunal', caption: 'Sunrise from the survey block', audio: 'Lo-fi campus', likes: 4120, replies: 188, seed: 'loop-6' },
];
