import type { Game, Meme, WatchParty } from '@/lib/types';
import { hoursAgo, istAt } from '@/lib/time';

// ── Watch together (module 8) ───────────────────────────────────────────────

export const watchParties: WatchParty[] = [
  { id: 'wp-live-event', title: 'Techfest keynote livestream', source: 'Event livestream', hostId: 'a-priya', viewers: 412, live: true, startsAt: hoursAgo(0.5), seed: 'wp-live-event', description: 'Live from the main auditorium screen. Chat is open to all students.', chatId: 'chat-event-fest' },
  { id: 'wp-edu-dbms', title: 'Watch: B-tree indexing explained', source: 'Educational', hostId: 'p-vishwajeet', viewers: 18, live: false, startsAt: istAt(1, 18), seed: 'wp-edu-dbms', description: 'Pause together, take notes and ask questions in the side chat.' },
  { id: 'wp-movie', title: 'Movie night: Interstellar (Friday)', source: 'Movie', hostId: 'p-harsh', viewers: 0, live: false, startsAt: istAt(3, 20), seed: 'wp-movie', description: 'Synchronised playback for everyone in the room. Popcorn is on you.' },
  { id: 'wp-yt-study', title: 'YouTube study session: Lo-fi & Linux', source: 'YouTube', hostId: 'p-harsh', viewers: 9, live: true, startsAt: hoursAgo(1), seed: 'wp-yt-study', description: 'Linux command-line basics while the playlist runs. Share your own screen when you want help.' },
  { id: 'wp-screen', title: 'Screen share: Live debugging of a Flask app', source: 'Screen share', hostId: 'p-tanvi', viewers: 5, live: true, startsAt: hoursAgo(0.2), seed: 'wp-screen', description: 'Debugging a production-style bug step by step. Voice on, chat for questions.' },
];

// ── Games & entertainment (module 9) ────────────────────────────────────────

export const games: Game[] = [
  { id: 'gm-quiz', title: 'Campus trivia: Tech edition', type: 'Quiz', players: 128, status: 'Live', description: 'Five questions, 15 seconds each. Top scorer this week wins a café voucher.', prize: '₹300 café voucher', seed: 'gm-quiz' },
  { id: 'gm-coding', title: 'Bug hunt: Find the off-by-one', type: 'Coding', players: 54, status: 'Open', description: 'Race your friends to spot bugs in a snippet. Points for speed and accuracy.', seed: 'gm-coding' },
  { id: 'gm-smash', title: 'Smash tournament (8 players)', type: 'Tournament', players: 8, status: 'Upcoming', description: 'Single-elimination bracket. Winners are on the Gaming Guild board.', prize: 'Trophy + bragging rights', seed: 'gm-smash' },
  { id: 'gm-game-night', title: 'Board game night', type: 'Game night', players: 22, status: 'Upcoming', description: 'Codenames, Catan and a lot of snacks in the lounge.', seed: 'gm-night' },
  { id: 'gm-multi', title: 'Among-us style deduction (multiplayer)', type: 'Multiplayer', players: 31, status: 'Open', description: 'Casual rounds between hostels. Roles are random.', seed: 'gm-multi' },
  { id: 'gm-trivia-inter', title: 'Inter-college trivia league', type: 'Trivia', players: 340, status: 'Upcoming', description: 'Four colleges, six rounds. Qualifiers in week 2.', prize: 'Inter-college trophy', seed: 'gm-trivia-inter' },
];

export const quizQuestions = [
  { q: 'Which normal form removes transitive dependencies?', options: ['1NF', '2NF', '3NF', 'BCNF'], answer: 2 },
  { q: 'What does the “P” in the banker’s algorithm check?', options: ['Pages', 'Safety', 'Priority', 'Process cost'], answer: 1 },
  { q: 'Which data structure powers the BFS traversal?', options: ['Stack', 'Queue', 'Heap', 'Trie'], answer: 1 },
  { q: 'In React, which hook memoises an expensive value?', options: ['useEffect', 'useRef', 'useMemo', 'useId'], answer: 2 },
  { q: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], answer: 1 },
];

// ── Memes (module 10) ───────────────────────────────────────────────────────

export const memes: Meme[] = [
  { id: 'mm-1', authorId: 'p-harsh', caption: 'When the viva list changes for the third time', tag: 'Exam', upvotes: 412, seed: 'mm-1' },
  { id: 'mm-2', authorId: 'anonymous', caption: 'Me pretending I understood the lecture on Monday', tag: 'Lecture', upvotes: 690, seed: 'mm-2' },
  { id: 'mm-3', authorId: 'p-kunal', caption: 'Canteen opens at 7:30. My stomach opened at 6:45.', tag: 'Campus', upvotes: 233, seed: 'mm-3' },
  { id: 'mm-4', authorId: 'anonymous', caption: 'Hostel WiFi during the hackathon, as a lifestyle', tag: 'Hostel', upvotes: 301, seed: 'mm-4', contest: true },
  { id: 'mm-5', authorId: 'p-tanvi', caption: 'ML model: 99% accuracy. Also ML model: predicts “yes” for everything.', tag: 'Department', upvotes: 524, seed: 'mm-5', contest: true },
  { id: 'mm-6', authorId: 'p-rohan', caption: 'Interviewer: “Any questions?” Me: “Is there a bench?”', tag: 'Campus', upvotes: 186, seed: 'mm-6' },
  { id: 'mm-7', authorId: 'anonymous', caption: 'Submit at 11:58 PM, panic at 11:59 PM', tag: 'Anonymous', upvotes: 377, seed: 'mm-7' },
  { id: 'mm-8', authorId: 'p-aditi', caption: 'Designers at 2 AM choosing between #2a2a2a and #2b2b2b', tag: 'Department', upvotes: 142, seed: 'mm-8' },
];

export const memeContest = { title: 'Best exam meme · Oct', ends: istAt(12, 23, 59), entries: 38, prize: '₹500 voucher' };

// ── Campus memories (module 49) ─────────────────────────────────────────────

export interface MemoryAlbum {
  id: string;
  title: string;
  kind: 'Fest' | 'Batch' | 'Yearbook' | 'Class' | 'Graduation' | 'Club';
  year: number;
  photos: number;
  seed: string;
  contributors: number;
  description: string;
}

export const memoryAlbums: MemoryAlbum[] = [
  { id: 'al-srujan-2025', title: 'Srujan Fest 2025', kind: 'Fest', year: 2025, photos: 146, seed: 'al-srujan-2025', contributors: 22, description: 'Band battle, dance rounds and the rooftop after-party.' },
  { id: 'al-batch-2023', title: 'Batch of 2023 — farewell', kind: 'Batch', year: 2023, photos: 88, seed: 'al-batch-2023', contributors: 41, description: 'Last-day photos from the Batch of 2023.' },
  { id: 'al-yearbook', title: 'Yearbook 2025–26', kind: 'Yearbook', year: 2026, photos: 240, seed: 'al-yearbook', contributors: 60, description: 'Class photos, clubs and the moments that made the year.' },
  { id: 'al-class-cs3', title: 'Computer Eng · Year 3 class', kind: 'Class', year: 2026, photos: 34, seed: 'al-class-cs3', contributors: 9, description: 'Lab days, late-night projects and the first hackathon win.' },
  { id: 'al-robotics', title: 'Robotics Club — build days', kind: 'Club', year: 2026, photos: 61, seed: 'al-robotics', contributors: 12, description: 'Soldering, crashes and the line-follower trophy.' },
];

// ── Creator platform (module 36) ────────────────────────────────────────────

export interface CreatorProject {
  id: string;
  title: string;
  kind: 'Music' | 'Coding' | 'Videos' | 'Startups' | 'Design';
  authorId: string;
  likes: number;
  seed: string;
  blurb: string;
}

export const creatorProjects: CreatorProject[] = [
  { id: 'cr-1', title: 'Campus lo-fi album (6 tracks)', kind: 'Music', authorId: 'p-harsh', likes: 412, seed: 'cr-1', blurb: 'Recorded in the hostel corridor. Yes, really.' },
  { id: 'cr-2', title: 'Open-source timetable parser', kind: 'Coding', authorId: 'p-rohan', likes: 286, seed: 'cr-2', blurb: 'Turns the PDF timetable into a calendar feed.' },
  { id: 'cr-3', title: 'Explaining the OS in 60 seconds', kind: 'Videos', authorId: 'p-vishwajeet', likes: 530, seed: 'cr-3', blurb: 'Short-form series for the OS subject.' },
  { id: 'cr-4', title: 'Thrift marketplace for hostels', kind: 'Startups', authorId: 'p-diya', likes: 198, seed: 'cr-4', blurb: 'Pre-seed prototype with 120 signups.' },
  { id: 'cr-5', title: 'Fest identity — brand kit', kind: 'Design', authorId: 'p-aditi', likes: 341, seed: 'cr-5', blurb: 'Logos, typography and posters for Srujan 2026.' },
  { id: 'cr-6', title: 'Soil-moisture IoT dashboard', kind: 'Coding', authorId: 'p-sneha', likes: 167, seed: 'cr-6', blurb: 'ESP32 sensors streaming to a live chart.' },
];

// ── Achievements & gamification (module 37) ─────────────────────────────────

export const xpSummary = { level: 4, xp: 1280, nextLevelXp: 1500, rankInCollege: 37 };

export const badges: { id: string; name: string; description: string; icon: 'hack' | 'help' | 'book' | 'volunteer' | 'chat' | 'trophy' | 'code' | 'star'; earned: boolean; progress: number; target: number }[] = [
  { id: 'bd-hack', name: 'Hackathon regular', description: 'Join 3 hackathons', icon: 'hack', earned: false, progress: 2, target: 3 },
  { id: 'bd-help', name: 'Helper', description: 'Get 10 answers marked helpful', icon: 'help', earned: true, progress: 10, target: 10 },
  { id: 'bd-notes', name: 'Note-maker', description: 'Share 5 approved resources', icon: 'book', earned: true, progress: 5, target: 5 },
  { id: 'bd-volunteer', name: 'Volunteer', description: 'Complete 20 volunteer hours', icon: 'volunteer', earned: false, progress: 12, target: 20 },
  { id: 'bd-chat', name: 'Community builder', description: 'Lead a community with 100+ members', icon: 'chat', earned: true, progress: 1, target: 1 },
  { id: 'bd-trophy', name: 'Inter-college champion', description: 'Win an inter-college competition', icon: 'trophy', earned: false, progress: 0, target: 1 },
  { id: 'bd-code', name: 'Problem solver', description: 'Solve 100 coding problems', icon: 'code', earned: false, progress: 64, target: 100 },
  { id: 'bd-star', name: 'Top rated', description: 'Maintain 4.8+ rating on services', icon: 'star', earned: false, progress: 4.6, target: 4.8 },
];

export const leaderboard: { personId: string; xp: number }[] = [
  { personId: 'p-tanvi', xp: 3140 },
  { personId: 'p-rohan', xp: 2980 },
  { personId: 'p-pooja', xp: 2710 },
  { personId: 'p-vishwajeet', xp: 2440 },
  { personId: 'p-diya', xp: 2190 },
  { personId: 'me', xp: 1280 },
  { personId: 'p-harsh', xp: 1190 },
  { personId: 'p-shruti', xp: 1060 },
];

// ── Connect: dating & friendship (module 61) ────────────────────────────────

export interface ConnectProfile {
  id: string;
  name: string;
  age: number;
  branch: string;
  year: number;
  bio: string;
  interests: string[];
  modes: ('Dating' | 'Friendship' | 'Activity partner' | 'Gaming partner' | 'Study partner' | 'Travel partner')[];
  verified18: boolean;
  seed: string;
  distanceLabel: string;
}

export const connectProfiles: ConnectProfile[] = [
  { id: 'cn-1', name: 'Ananya', age: 20, branch: 'Information Technology', year: 2, bio: 'Coffee first, then gym. Looking for someone to explore the Pune trail with.', interests: ['Hiking', 'Coffee', 'Films'], modes: ['Dating', 'Activity partner'], verified18: true, seed: 'cn-1', distanceLabel: 'Same campus' },
  { id: 'cn-2', name: 'Kabir', age: 21, branch: 'Computer Engineering', year: 3, bio: 'Playing Valorant most nights. Will carry you through the ranked grind.', interests: ['Gaming', 'Tech'], modes: ['Gaming partner', 'Friendship'], verified18: true, seed: 'cn-2', distanceLabel: 'Same campus' },
  { id: 'cn-3', name: 'Meera', age: 19, branch: 'Electronics & Telecom', year: 1, bio: 'New to the city. Want a study buddy for signals and a friend for weekend chai.', interests: ['Study', 'Chai', 'Music'], modes: ['Study partner', 'Friendship'], verified18: true, seed: 'cn-3', distanceLabel: '3 km' },
  { id: 'cn-4', name: 'Arjun', age: 22, branch: 'Mechanical Engineering', year: 4, bio: 'Planning a Goa trip in December. Need two more people who like long drives.', interests: ['Travel', 'Road trips'], modes: ['Travel partner', 'Friendship'], verified18: true, seed: 'cn-4', distanceLabel: 'Same campus' },
  { id: 'cn-5', name: 'Sara', age: 20, branch: 'Civil Engineering', year: 2, bio: 'Photographer. Sunrise walks and bad puns.', interests: ['Photography', 'Walks'], modes: ['Dating', 'Activity partner'], verified18: true, seed: 'cn-5', distanceLabel: '5 km' },
];
