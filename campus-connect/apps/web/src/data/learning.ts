import type { Lecture, Resource, StudyRoom, Tutor } from '@/lib/types';
import { daysAgo, istAt } from '@/lib/time';

// ── Academic management (module 34) ─────────────────────────────────────────

export const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export type WeekDay = (typeof weekDays)[number];

export interface TimetableSlot {
  day: WeekDay;
  start: string;
  end: string;
  subject: string;
  type: 'Lecture' | 'Lab' | 'Tutorial';
  room: string;
  facultyId: string;
}

export const timetable: TimetableSlot[] = [
  { day: 'Mon', start: '09:00', end: '10:00', subject: 'Database Management Systems', type: 'Lecture', room: 'Hall 2', facultyId: 'f-anita' },
  { day: 'Mon', start: '11:00', end: '13:00', subject: 'Operating Systems Lab', type: 'Lab', room: 'Lab 3', facultyId: 'f-anita' },
  { day: 'Mon', start: '14:00', end: '15:00', subject: 'Machine Learning', type: 'Lecture', room: 'Hall 5', facultyId: 'f-neha' },
  { day: 'Tue', start: '09:00', end: '10:00', subject: 'Compiler Design', type: 'Lecture', room: 'Hall 1', facultyId: 'f-anita' },
  { day: 'Tue', start: '10:00', end: '11:00', subject: 'Software Engineering', type: 'Lecture', room: 'Hall 1', facultyId: 'f-neha' },
  { day: 'Tue', start: '12:00', end: '14:00', subject: 'Machine Learning Lab', type: 'Lab', room: 'IT Lab 304', facultyId: 'f-neha' },
  { day: 'Wed', start: '09:00', end: '10:00', subject: 'Database Management Systems', type: 'Lecture', room: 'Hall 3', facultyId: 'f-anita' },
  { day: 'Wed', start: '11:00', end: '13:00', subject: 'Operating Systems Lab', type: 'Lab', room: 'Lab 3', facultyId: 'f-anita' },
  { day: 'Wed', start: '14:00', end: '15:00', subject: 'Compiler Design Tutorial', type: 'Tutorial', room: 'Tutorial 2', facultyId: 'f-manoj' },
  { day: 'Wed', start: '15:30', end: '16:30', subject: 'Machine Learning', type: 'Lecture', room: 'Hall 5', facultyId: 'f-neha' },
  { day: 'Thu', start: '10:00', end: '11:00', subject: 'Mathematics-III', type: 'Lecture', room: 'Hall 4', facultyId: 'f-manoj' },
  { day: 'Thu', start: '11:00', end: '12:00', subject: 'Software Engineering', type: 'Lecture', room: 'Hall 4', facultyId: 'f-neha' },
  { day: 'Fri', start: '09:00', end: '11:00', subject: 'DBMS Lab', type: 'Lab', room: 'Lab 4', facultyId: 'f-anita' },
  { day: 'Fri', start: '14:00', end: '15:00', subject: 'Mathematics-III', type: 'Tutorial', room: 'Tutorial 1', facultyId: 'f-manoj' },
  { day: 'Sat', start: '09:00', end: '10:00', subject: 'Compiler Design', type: 'Lecture', room: 'Hall 1', facultyId: 'f-anita' },
];

export interface Attendance {
  subject: string;
  attended: number;
  total: number;
}

export const attendance: Attendance[] = [
  { subject: 'Database Management Systems', attended: 42, total: 48 },
  { subject: 'Operating Systems', attended: 30, total: 44 },
  { subject: 'Compiler Design', attended: 28, total: 36 },
  { subject: 'Machine Learning', attended: 20, total: 28 },
  { subject: 'Mathematics-III', attended: 33, total: 40 },
  { subject: 'Software Engineering', attended: 18, total: 24 },
];

export interface ExamItem {
  id: string;
  subject: string;
  kind: 'Viva' | 'Mid-sem' | 'End-sem' | 'Practical' | 'Quiz';
  date: string;
  venue: string;
  syllabus: string;
}

export const exams: ExamItem[] = [
  { id: 'ex-dbms-viva', subject: 'DBMS', kind: 'Viva', date: istAt(5, 10), venue: 'Lab 3', syllabus: 'Normalisation, transactions, indexing' },
  { id: 'ex-os-mid', subject: 'Operating Systems', kind: 'Mid-sem', date: istAt(8, 10), venue: 'Hall 2', syllabus: 'Scheduling, deadlocks, memory management' },
  { id: 'ex-compiler-quiz', subject: 'Compiler Design', kind: 'Quiz', date: istAt(10, 14), venue: 'Online · LMS', syllabus: 'Lexical analysis & parsing' },
  { id: 'ex-ml-practical', subject: 'Machine Learning', kind: 'Practical', date: istAt(14, 9), venue: 'IT Lab 304', syllabus: 'Regression, SVM, a mini project demo' },
];

export interface Assignment {
  id: string;
  subject: string;
  title: string;
  due: string;
  status: 'Pending' | 'Submitted' | 'Late';
}

export const assignments: Assignment[] = [
  { id: 'as-1', subject: 'DBMS', title: 'ER diagram for hostel management', due: istAt(1, 23, 59), status: 'Pending' },
  { id: 'as-2', subject: 'Operating Systems', title: 'Simulate FCFS, SJF and Round Robin', due: istAt(-1, 23, 59), status: 'Submitted' },
  { id: 'as-3', subject: 'Machine Learning', title: 'Regression on housing dataset (report)', due: istAt(3, 23, 59), status: 'Pending' },
  { id: 'as-4', subject: 'Software Engineering', title: 'SRS for campus app (group)', due: istAt(6, 23, 59), status: 'Pending' },
  { id: 'as-5', subject: 'Mathematics-III', title: 'Assignment 4: Laplace transforms', due: istAt(-3, 23, 59), status: 'Late' },
];

export interface ResultRow {
  subject: string;
  credits: number;
  grade: string;
  gradePoint: number;
}

export const results: ResultRow[] = [
  { subject: 'Database Management Systems', credits: 4, grade: 'A', gradePoint: 9 },
  { subject: 'Operating Systems', credits: 4, grade: 'A+', gradePoint: 10 },
  { subject: 'Computer Networks', credits: 3, grade: 'B+', gradePoint: 8 },
  { subject: 'Theory of Computation', credits: 3, grade: 'A', gradePoint: 9 },
  { subject: 'Web Technology', credits: 2, grade: 'O', gradePoint: 10 },
  { subject: 'Mathematics-III', credits: 4, grade: 'B', gradePoint: 7 },
];

export const gradeScale: { grade: string; point: number }[] = [
  { grade: 'O', point: 10 },
  { grade: 'A+', point: 9 },
  { grade: 'A', point: 8 },
  { grade: 'B+', point: 7 },
  { grade: 'B', point: 6 },
  { grade: 'C', point: 5 },
  { grade: 'P', point: 4 },
];

export const academicCalendar: { id: string; title: string; date: string; kind: 'Exam' | 'Holiday' | 'Event' | 'Deadline' }[] = [
  { id: 'cal-1', title: 'Internal marks published', date: istAt(-2, 9), kind: 'Event' },
  { id: 'cal-2', title: 'Fee payment deadline', date: istAt(18, 23, 59), kind: 'Deadline' },
  { id: 'cal-3', title: 'Diwali break', date: istAt(7, 9), kind: 'Holiday' },
  { id: 'cal-4', title: 'Mid-semester examinations begin', date: istAt(8, 10), kind: 'Exam' },
  { id: 'cal-5', title: 'Project report submission', date: istAt(30, 17), kind: 'Deadline' },
  { id: 'cal-6', title: 'End-semester examinations', date: istAt(52, 10), kind: 'Exam' },
];

// ── Resource hub (module 27) ────────────────────────────────────────────────

export const resources: Resource[] = [
  { id: 'rs-os-notes', title: 'OS Unit 3 & 4 handwritten notes', kind: 'Notes', subject: 'Operating Systems', semester: 6, uploaderId: 'p-vishwajeet', downloads: 812, rating: 4.8, sizeLabel: '4.2 MB · PDF', tags: ['deadlock', 'scheduling'], approved: true },
  { id: 'rs-dbms-pyq', title: 'DBMS previous 5 years question papers', kind: 'Previous papers', subject: 'DBMS', semester: 6, uploaderId: 'p-aditi', downloads: 1204, rating: 4.9, sizeLabel: '2.1 MB · PDF', tags: ['pyq', 'viva'], approved: true },
  { id: 'rs-cd-syllabus', title: 'Compiler Design — official syllabus (Sem 6)', kind: 'Syllabus', subject: 'Compiler Design', semester: 6, uploaderId: 'a-priya', downloads: 430, rating: 4.4, sizeLabel: '240 KB · PDF', tags: ['syllabus'], approved: true },
  { id: 'rs-ml-lab', title: 'ML lab manual (Experiments 1–10)', kind: 'Lab manual', subject: 'Machine Learning', semester: 6, uploaderId: 'f-neha', downloads: 520, rating: 4.6, sizeLabel: '3.4 MB · PDF', tags: ['lab', 'python'], approved: true },
  { id: 'rs-web-cheat', title: 'React + TypeScript cheat sheet', kind: 'Cheat sheet', subject: 'Web Technology', semester: 6, uploaderId: 'me', downloads: 288, rating: 4.7, sizeLabel: '380 KB · PDF', tags: ['react', 'typescript'], approved: true },
  { id: 'rs-maths-book', title: 'Engineering Mathematics III — reference book', kind: 'Book', subject: 'Mathematics-III', semester: 6, uploaderId: 'f-manoj', downloads: 604, rating: 4.5, sizeLabel: '18 MB · PDF', tags: ['textbook'], approved: true },
  { id: 'rs-sql-tutorial', title: 'SQL window functions in 30 minutes', kind: 'YouTube', subject: 'DBMS', semester: 6, uploaderId: 'p-omkar', downloads: 318, rating: 4.9, sizeLabel: 'Video · 32 min', tags: ['sql'], approved: true },
  { id: 'rs-cp-code', title: 'DSA patterns — C++ implementations', kind: 'Code', subject: 'Data Structures', semester: 4, uploaderId: 'p-rohan', downloads: 980, rating: 4.9, sizeLabel: 'GitHub repo', tags: ['dsa', 'cpp'], approved: true },
  { id: 'rs-network-tut', title: 'Computer Networks tutorial sheet (Unit 2)', kind: 'Tutorial', subject: 'Computer Networks', semester: 6, uploaderId: 'p-tanvi', downloads: 151, rating: 4.1, sizeLabel: '1.1 MB · PDF', tags: ['tcp', 'routing'], approved: false },
  { id: 'rs-ele-pdf', title: 'Signals & Systems — formula sheet', kind: 'PDF', subject: 'Signals & Systems', semester: 4, uploaderId: 'f-ritu', downloads: 236, rating: 4.3, sizeLabel: '210 KB · PDF', tags: ['formulas'], approved: true },
];

export const lectures: Lecture[] = [
  {
    id: 'lec-dbms-normal',
    title: 'Normalisation: 1NF to BCNF with worked examples',
    subject: 'Database Management Systems',
    facultyId: 'f-anita',
    semester: 6,
    durationMin: 48,
    views: 642,
    uploadedAt: daysAgo(2),
    seed: 'lec-dbms-normal',
    description: 'Walk through functional dependencies, decomposition and why BCNF is stricter than 3NF. Includes the viva questions from last year.',
    chapters: [
      { at: 0, label: 'Functional dependencies' },
      { at: 720, label: '2NF and 3NF' },
      { at: 1500, label: 'BCNF with an example' },
      { at: 2400, label: 'Viva questions' },
    ],
    notes: ['Normalisation cheat sheet.pdf', 'Worked examples.pdf'],
    published: true,
  },
  {
    id: 'lec-os-deadlock',
    title: 'Deadlocks: detection, avoidance and the banker’s algorithm',
    subject: 'Operating Systems',
    facultyId: 'f-anita',
    semester: 6,
    durationMin: 56,
    views: 388,
    uploadedAt: daysAgo(5),
    seed: 'lec-os-deadlock',
    description: 'Resource allocation graphs, safe states, and the step-by-step banker’s algorithm.',
    chapters: [
      { at: 0, label: 'Necessary conditions' },
      { at: 900, label: 'Resource allocation graph' },
      { at: 2100, label: 'Banker’s algorithm' },
    ],
    notes: ['Banker’s algorithm steps.pdf'],
    published: true,
  },
  {
    id: 'lec-ml-regress',
    title: 'Linear regression and regularisation (Ridge, Lasso)',
    subject: 'Machine Learning',
    facultyId: 'f-neha',
    semester: 6,
    durationMin: 62,
    views: 515,
    uploadedAt: daysAgo(4),
    seed: 'lec-ml-regress',
    description: 'From the normal equation to gradient descent, with live notebooks and a discussion of overfitting.',
    chapters: [
      { at: 0, label: 'Least squares' },
      { at: 1200, label: 'Gradient descent' },
      { at: 2640, label: 'Ridge & Lasso' },
    ],
    notes: ['Regression notebook.ipynb'],
    published: true,
  },
  {
    id: 'lec-maths-laplace',
    title: 'Laplace transforms — solving ODEs step by step',
    subject: 'Mathematics-III',
    facultyId: 'f-manoj',
    semester: 6,
    durationMin: 44,
    views: 276,
    uploadedAt: daysAgo(7),
    seed: 'lec-maths-laplace',
    description: 'Standard transforms, shifting theorems and inverse transforms by partial fractions.',
    chapters: [
      { at: 0, label: 'Standard transforms' },
      { at: 780, label: 'First shifting theorem' },
      { at: 1620, label: 'Partial fractions' },
    ],
    notes: ['Laplace table.pdf'],
    published: true,
  },
  {
    id: 'lec-sigs-fourier',
    title: 'Fourier series for periodic signals',
    subject: 'Signals & Systems',
    facultyId: 'f-sandeep',
    semester: 4,
    durationMin: 51,
    views: 198,
    uploadedAt: daysAgo(9),
    seed: 'lec-sigs-fourier',
    description: 'Trigonometric and exponential Fourier series with spectrum plots.',
    chapters: [
      { at: 0, label: 'Periodic signals' },
      { at: 1000, label: 'Exponential form' },
    ],
    notes: [],
    published: true,
  },
  {
    id: 'lec-draft-thermo',
    title: 'Thermodynamics — entropy (draft)',
    subject: 'Thermodynamics',
    facultyId: 'f-ritu',
    semester: 4,
    durationMin: 40,
    views: 0,
    uploadedAt: daysAgo(0),
    seed: 'lec-draft-thermo',
    description: 'Upload in progress. Not visible to students until published.',
    chapters: [],
    notes: [],
    published: false,
  },
];

// ── Study together (module 7) and peer tutoring (module 35) ─────────────────

export const studyRooms: StudyRoom[] = [
  { id: 'sr-pomodoro-1', title: 'Deep-work Pomodoro (50/10)', subject: 'Any subject', type: 'Pomodoro', hostId: 'p-tanvi', members: 9, live: true, schedule: 'Every day · 6 PM', focusMinutes: 50, breakMinutes: 10, tags: ['quiet', 'pomodoro'], seed: 'sr-pomodoro-1', sharedNotes: ['Today: finish 2 DBMS questions', 'Break: stretch and water'] },
  { id: 'sr-dbms-exam', title: 'DBMS viva group', subject: 'DBMS', type: 'Exam group', hostId: 'p-vishwajeet', members: 14, live: false, schedule: 'Sat 10:00 AM', focusMinutes: 45, breakMinutes: 10, tags: ['viva', 'dbms'], seed: 'sr-dbms-exam', sharedNotes: ['Normalisation questions', 'Transaction isolation levels'] },
  { id: 'sr-ml-virtual', title: 'ML project virtual room', subject: 'Machine Learning', type: 'Virtual room', hostId: 'p-tanvi', members: 4, live: true, schedule: 'Open · Tue–Thu', focusMinutes: 60, breakMinutes: 5, tags: ['python', 'project'], seed: 'sr-ml-virtual', sharedNotes: ['Dataset cleaning notebook'] },
  { id: 'sr-group-os', title: 'OS deadlock session', subject: 'Operating Systems', type: 'Group session', hostId: 'p-aditi', members: 6, live: false, schedule: 'Mon 7:00 PM', focusMinutes: 50, breakMinutes: 10, tags: ['os'], seed: 'sr-group-os', sharedNotes: ['Banker’s algorithm worksheet'] },
  { id: 'sr-peer-math', title: 'Maths-III peer tutoring', subject: 'Mathematics-III', type: 'Peer tutoring', hostId: 'p-omkar', members: 3, live: false, schedule: 'Thu 5:30 PM', focusMinutes: 60, breakMinutes: 10, tags: ['tutoring'], seed: 'sr-peer-math', sharedNotes: ['Laplace practice set'] },
];

export const studyPartners: { personId: string; subject: string; availability: string; level: string }[] = [
  { personId: 'p-vishwajeet', subject: 'Operating Systems', availability: 'Weekday evenings', level: 'Advanced' },
  { personId: 'p-aditi', subject: 'DBMS', availability: 'Weekend mornings', level: 'Intermediate' },
  { personId: 'p-sneha', subject: 'Signals & Systems', availability: 'Weekdays after 6 PM', level: 'Intermediate' },
  { personId: 'p-neha', subject: 'Machine Learning', availability: 'Flexible', level: 'Beginner' },
];

export const tutors: Tutor[] = [
  { id: 'tu-1', personId: 'p-vishwajeet', subjects: ['DBMS', 'OS'], rate: 150, rating: 4.9, sessions: 64, availability: ['Mon 7–8 PM', 'Sat 10–12'], bio: 'Explains the hard parts with diagrams. Ten sessions free for first-years.', verified: true },
  { id: 'tu-2', personId: 'p-rohan', subjects: ['DSA', 'C++'], rate: 200, rating: 4.8, sessions: 88, availability: ['Tue 6–8 PM', 'Thu 6–8 PM'], bio: 'Pattern-first DSA sessions with mock interview practice.', verified: true },
  { id: 'tu-3', personId: 'p-omkar', subjects: ['Mathematics-III', 'MATLAB'], rate: 120, rating: 4.6, sessions: 31, availability: ['Thu 5–7 PM', 'Sun 10–11 AM'], bio: 'Calm, step-by-step problem solving. Good for backlog clearing.', verified: true },
  { id: 'tu-4', personId: 'p-tanvi', subjects: ['Machine Learning', 'Python'], rate: 180, rating: 4.7, sessions: 45, availability: ['Wed 7–9 PM'], bio: 'Notebook-first ML: build, break and understand the model.', verified: true },
  { id: 'tu-5', personId: 'p-sneha', subjects: ['Signals & Systems', 'Electronics'], rate: 100, rating: 4.5, sessions: 19, availability: ['Fri 4–6 PM'], bio: 'Circuit and signal intuition with real hardware on the table.', verified: false },
];

// ── Coding hub (module 44) ──────────────────────────────────────────────────

export interface CodingProblem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  solvedBy: number;
  solved: boolean;
}

export const codingProblems: CodingProblem[] = [
  { id: 'cp-1', title: 'Two Sum', difficulty: 'Easy', topic: 'Hashing', solvedBy: 4120, solved: true },
  { id: 'cp-2', title: 'Sliding Window Maximum', difficulty: 'Hard', topic: 'Deque', solvedBy: 730, solved: false },
  { id: 'cp-3', title: 'Course Schedule', difficulty: 'Medium', topic: 'Graphs', solvedBy: 1960, solved: true },
  { id: 'cp-4', title: 'Coin Change II', difficulty: 'Medium', topic: 'DP', solvedBy: 1320, solved: false },
  { id: 'cp-5', title: 'Valid Parentheses', difficulty: 'Easy', topic: 'Stack', solvedBy: 5300, solved: true },
  { id: 'cp-6', title: 'Merge K Sorted Lists', difficulty: 'Hard', topic: 'Heaps', solvedBy: 890, solved: false },
];

export const dsaGroups = [
  { id: 'dg-1', name: 'DSA 40-day sprint', members: 128, cadence: 'Daily problem', seed: 'dg-1' },
  { id: 'dg-2', name: 'Graph & DP study circle', members: 46, cadence: 'Tue & Thu', seed: 'dg-2' },
  { id: 'dg-3', name: 'Placement mock interviews', members: 212, cadence: 'Weekly', seed: 'dg-3' },
];

export const contests = [
  { id: 'ct-1', title: 'Weekly Contest 412', platform: 'LeetCode', at: istAt(2, 20), length: '90 min' },
  { id: 'ct-2', title: 'College Code Sprint', platform: 'Campus', at: istAt(6, 10), length: '2 hours' },
  { id: 'ct-3', title: 'ICPC Regional Qualifier', platform: 'Codeforces', at: istAt(21, 9), length: '5 hours' },
];
