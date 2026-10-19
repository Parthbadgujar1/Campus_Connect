import type { Opportunity } from '@/lib/types';
import { istAt } from '@/lib/time';

export const opportunities: Opportunity[] = [
  {
    id: 'op-frontend-intern',
    title: 'Frontend Engineering Intern',
    org: 'Thoughtworks Pune',
    kind: 'Internship',
    mode: 'Hybrid',
    location: 'Pune',
    pay: '₹35,000 / month',
    deadline: istAt(2, 23, 59),
    eligibleBranches: ['Computer Engineering', 'Information Technology'],
    minYear: 3,
    skills: ['React', 'TypeScript', 'Testing'],
    description:
      'Work with product teams on accessible, well-tested web apps. Mentored by senior engineers, with a conversion option after 6 months.',
    seed: 'op-frontend-intern',
    reviewsRating: 4.4,
    reviewsCount: 38,
    applicants: 412,
  },
  {
    id: 'op-data-analyst',
    title: 'Junior Data Analyst',
    org: 'Kiran Analytics',
    kind: 'Job',
    mode: 'On-site',
    location: 'Mumbai',
    pay: '₹6.5 LPA',
    deadline: istAt(9, 23, 59),
    eligibleBranches: ['Computer Engineering', 'Information Technology', 'Electronics & Telecom'],
    minYear: 4,
    skills: ['SQL', 'Python', 'Excel'],
    description: 'Build dashboards and reports for retail clients. Strong SQL and storytelling are the core of the role.',
    seed: 'op-data-analyst',
    reviewsRating: 3.9,
    reviewsCount: 12,
    applicants: 186,
  },
  {
    id: 'op-hack-kit',
    title: 'Smart Campus Hackathon',
    org: 'Mumbai Hacks Collective',
    kind: 'Hackathon',
    mode: 'Hybrid',
    location: 'Online + Pune Lab',
    pay: '₹1,00,000 prize pool',
    deadline: istAt(5, 23, 59),
    eligibleBranches: [],
    minYear: 1,
    skills: ['Any stack', 'IoT', 'AI'],
    description: 'A 36-hour build on smart-campus problems. Teams of up to four, with sponsor APIs and mentor hours.',
    seed: 'op-hack-kit',
    reviewsRating: 4.7,
    reviewsCount: 61,
    applicants: 540,
  },
  {
    id: 'op-research',
    title: 'Undergraduate Research Assistant',
    org: 'Dr. Neha Pawar · ML Lab',
    kind: 'Research',
    mode: 'On-site',
    location: 'IT Block, Room 304',
    pay: '₹8,000 / month stipend',
    deadline: istAt(12, 23, 59),
    eligibleBranches: ['Computer Engineering', 'Information Technology'],
    minYear: 2,
    skills: ['Python', 'Machine learning', 'Pandas'],
    description: 'Help benchmark sequence models on Indian-language datasets. Co-authorship possible for strong contributors.',
    seed: 'op-research',
    reviewsRating: 4.8,
    reviewsCount: 9,
    applicants: 27,
  },
  {
    id: 'op-scholarship',
    title: 'Merit Scholarship for Engineering Students',
    org: 'Maharashtra Education Trust',
    kind: 'Scholarship',
    mode: 'Remote',
    location: 'Apply online',
    pay: 'Up to ₹50,000 / year',
    deadline: istAt(20, 23, 59),
    eligibleBranches: [],
    minYear: 1,
    skills: [],
    description: 'Awarded to students with 8.0+ CGPA and family income under ₹6 LPA. Documents: marksheet and income certificate.',
    seed: 'op-scholarship',
    reviewsRating: 4.2,
    reviewsCount: 5,
    applicants: 820,
  },
  {
    id: 'op-freelance-design',
    title: 'Freelance: Club Poster Designs',
    org: 'Design Club',
    kind: 'Freelance',
    mode: 'Remote',
    location: 'Remote',
    pay: '₹1,500 per poster',
    deadline: istAt(4, 23, 59),
    eligibleBranches: [],
    minYear: 1,
    skills: ['Figma', 'Illustrator'],
    description: 'Create posters for 4 fest events. Deliver in 3 days with source files.',
    seed: 'op-freelance-design',
    reviewsRating: 4.5,
    reviewsCount: 14,
    applicants: 22,
  },
  {
    id: 'op-oss',
    title: 'Open-source Mentorship: Docs Sprint',
    org: 'GDSC × OpenDocs',
    kind: 'Open Source',
    mode: 'Remote',
    location: 'Remote',
    pay: 'Certificate + swag',
    deadline: istAt(7, 23, 59),
    eligibleBranches: [],
    minYear: 1,
    skills: ['Git', 'Writing', 'Markdown'],
    description: 'Two-week sprint improving docs for a real library. Mentors review every pull request.',
    seed: 'op-oss',
    reviewsRating: 4.6,
    reviewsCount: 19,
    applicants: 98,
  },
  {
    id: 'op-ambassador',
    title: 'Campus Ambassador — Cloud Platform',
    org: 'CloudSpring',
    kind: 'Ambassador',
    mode: 'Remote',
    location: 'Your campus',
    pay: 'Credits + goodies',
    deadline: istAt(14, 23, 59),
    eligibleBranches: [],
    minYear: 2,
    skills: ['Public speaking', 'Community'],
    description: 'Run two workshops this semester and grow the local developer community.',
    seed: 'op-ambassador',
    reviewsRating: 4.1,
    reviewsCount: 7,
    applicants: 64,
  },
  {
    id: 'op-parttime-lab',
    title: 'Part-time Lab Assistant (Electronics)',
    org: 'EXTC Department',
    kind: 'Part-time',
    mode: 'On-site',
    location: 'EXTC Lab',
    pay: '₹300 / hour (max 12 hrs/wk)',
    deadline: istAt(3, 23, 59),
    eligibleBranches: ['Electronics & Telecom'],
    minYear: 2,
    skills: ['Soldering', 'Oscilloscope'],
    description: 'Set up lab practicals and help with equipment. Timings fit around your timetable.',
    seed: 'op-parttime-lab',
    reviewsRating: 4.0,
    reviewsCount: 3,
    applicants: 11,
  },
  {
    id: 'op-cert',
    title: 'Google Cloud Digital Leader Voucher',
    org: 'GDSC Campus Chapter',
    kind: 'Certification',
    mode: 'Remote',
    location: 'Online exam',
    pay: '50% exam voucher',
    deadline: istAt(11, 23, 59),
    eligibleBranches: [],
    minYear: 1,
    skills: ['Cloud'],
    description: 'Vouchers for the first 30 students who finish the cloud basics course.',
    seed: 'op-cert',
    reviewsRating: 4.3,
    reviewsCount: 11,
    applicants: 88,
  },
];

export interface TeamPost {
  id: string;
  title: string;
  type: 'Hackathon' | 'Project' | 'Research' | 'Startup' | 'Coding';
  ownerId: string;
  lookingFor: string[];
  spots: number;
  filled: number;
  timeline: string;
  description: string;
  seed: string;
  members: string[];
  requests: number;
}

export const teamPosts: TeamPost[] = [
  {
    id: 'team-web3',
    title: 'Web3 Hackathon team — 2 spots',
    type: 'Hackathon',
    ownerId: 'p-pooja',
    lookingFor: ['Solidity', 'UI design'],
    spots: 2,
    filled: 2,
    timeline: '24 hours · Oct 16–17',
    description: 'We have a backend and ML person. Need a Solidity developer and a designer for the demo.',
    seed: 'team-web3',
    members: ['p-pooja', 'p-tanvi'],
    requests: 4,
  },
  {
    id: 'team-iot',
    title: 'Smart-hostel IoT project',
    type: 'Project',
    ownerId: 'p-sneha',
    lookingFor: ['ESP32', 'Mobile dev'],
    spots: 3,
    filled: 1,
    timeline: 'One semester',
    description: 'Sensors for hostel water tanks and room occupancy. Working prototype for the year-end expo.',
    seed: 'team-iot',
    members: ['p-sneha'],
    requests: 2,
  },
  {
    id: 'team-ml-research',
    title: 'Indic speech dataset — research team',
    type: 'Research',
    ownerId: 'f-neha',
    lookingFor: ['Python', 'Data labelling'],
    spots: 4,
    filled: 2,
    timeline: 'Two months',
    description: 'Create a labelled dataset and benchmark baseline models. Publication likely if results hold.',
    seed: 'team-ml-research',
    members: ['f-neha', 'p-tanvi'],
    requests: 6,
  },
  {
    id: 'team-startup',
    title: 'Campus thrift app — co-founder search',
    type: 'Startup',
    ownerId: 'p-diya',
    lookingFor: ['Full-stack dev', 'Growth'],
    spots: 2,
    filled: 0,
    timeline: 'Ongoing',
    description: 'Peer-to-peer resale for textbooks and hostel stuff. Pre-seed budget from the E-Cell grant.',
    seed: 'team-startup',
    members: ['p-diya'],
    requests: 9,
  },
  {
    id: 'team-cp',
    title: 'ICPC practice squad',
    type: 'Coding',
    ownerId: 'p-rohan',
    lookingFor: ['C++', 'Graphs & DP'],
    spots: 3,
    filled: 2,
    timeline: 'Weekly contests',
    description: 'Practice together on Saturdays and join the regional ICPC qualifier as a three-person team.',
    seed: 'team-cp',
    members: ['p-rohan', 'p-harsh'],
    requests: 3,
  },
];

export interface PlacementDrive {
  id: string;
  company: string;
  role: string;
  date: string;
  package: string;
  eligibility: string;
  minCgpa: number;
  maxBacklogs: number;
  status: 'Upcoming' | 'Open' | 'Closed';
  rounds: string[];
  seed: string;
}

export const placementDrives: PlacementDrive[] = [
  {
    id: 'drive-thoughtworks',
    company: 'Thoughtworks',
    role: 'Software Engineer (Graduate)',
    date: istAt(6, 10),
    package: '₹12 LPA',
    eligibility: 'CE, IT · CGPA 6.5+ · no active backlogs',
    minCgpa: 6.5,
    maxBacklogs: 0,
    status: 'Upcoming',
    rounds: ['Online aptitude', 'Coding round', 'Technical interview', 'HR'],
    seed: 'drive-thoughtworks',
  },
  {
    id: 'drive-kiran',
    company: 'Kiran Analytics',
    role: 'Junior Data Analyst',
    date: istAt(9, 10),
    package: '₹6.5 LPA',
    eligibility: 'Any branch · CGPA 6.0+ · up to 1 backlog',
    minCgpa: 6,
    maxBacklogs: 1,
    status: 'Open',
    rounds: ['SQL test', 'Case study', 'Interview'],
    seed: 'drive-kiran',
  },
  {
    id: 'drive-acme',
    company: 'Acme Robotics',
    role: 'Embedded Systems Trainee',
    date: istAt(-4, 10),
    package: '₹5 LPA',
    eligibility: 'EE, ENTC · CGPA 7.0+',
    minCgpa: 7,
    maxBacklogs: 0,
    status: 'Closed',
    rounds: ['Written', 'Practical test', 'Interview'],
    seed: 'drive-acme',
  },
];

export interface InterviewExperience {
  id: string;
  company: string;
  role: string;
  authorId: string;
  verdict: 'Selected' | 'Not selected';
  rounds: string[];
  tips: string;
  seed: string;
}

export const interviewExperiences: InterviewExperience[] = [
  {
    id: 'ie-1',
    company: 'Thoughtworks',
    role: 'Graduate Engineer',
    authorId: 'p-rohan',
    verdict: 'Selected',
    rounds: ['Aptitude (40 min)', 'Two DSA problems (graphs, DP)', 'Pair-programming on a small API', 'Culture-fit HR'],
    tips: 'Explain your trade-offs out loud. They care more about reasoning than the final code.',
    seed: 'ie-1',
  },
  {
    id: 'ie-2',
    company: 'Kiran Analytics',
    role: 'Junior Analyst',
    authorId: 'p-omkar',
    verdict: 'Selected',
    rounds: ['SQL test (joins & window functions)', 'Excel case study', 'Interview'],
    tips: 'Practise window functions. Bring one dashboard you built to talk through.',
    seed: 'ie-2',
  },
  {
    id: 'ie-3',
    company: 'Acme Robotics',
    role: 'Embedded Trainee',
    authorId: 'p-sanket',
    verdict: 'Not selected',
    rounds: ['Written on microcontrollers', 'Practical: GPIO and timers', 'Interview'],
    tips: 'Revise interrupts and timers. The practical was harder than the written test.',
    seed: 'ie-3',
  },
];

export const interviewQuestions: { id: string; question: string; topic: string; company: string }[] = [
  { id: 'q1', question: 'Reverse a linked list in groups of k.', topic: 'DSA', company: 'Thoughtworks' },
  { id: 'q2', question: 'Explain database normalisation up to BCNF with an example.', topic: 'DBMS', company: 'Kiran Analytics' },
  { id: 'q3', question: 'What happens when you type a URL into a browser?', topic: 'Web', company: 'Thoughtworks' },
  { id: 'q4', question: 'Difference between process and thread, and context switching cost.', topic: 'OS', company: 'Acme Robotics' },
  { id: 'q5', question: 'Write a SQL query for the second highest salary per department.', topic: 'SQL', company: 'Kiran Analytics' },
  { id: 'q6', question: 'How would you design a URL shortener for 10M users?', topic: 'System design', company: 'Thoughtworks' },
];

export interface Mentor {
  id: string;
  personId: string;
  kind: 'Senior' | 'Alumni' | 'Industry' | 'Hackathon' | 'Career' | 'Technical';
  expertise: string[];
  rating: number;
  slotsOpen: number;
  bio: string;
}

export const mentors: Mentor[] = [
  { id: 'mt-1', personId: 'p-rohan', kind: 'Senior', expertise: ['DSA', 'Interviews'], rating: 4.9, slotsOpen: 2, bio: 'Placed in two product companies. Mock interviews every week.' },
  { id: 'mt-2', personId: 'p-pooja', kind: 'Hackathon', expertise: ['Hackathons', 'Team building'], rating: 4.8, slotsOpen: 1, bio: 'Has mentored 14 hackathon teams. Good at scoping demos.' },
  { id: 'mt-3', personId: 'f-neha', kind: 'Technical', expertise: ['Machine learning', 'Research'], rating: 4.7, slotsOpen: 3, bio: 'Research supervision and ML project reviews.' },
  { id: 'mt-4', personId: 'p-diya', kind: 'Career', expertise: ['Product', 'Startups'], rating: 4.6, slotsOpen: 2, bio: 'Product career advice and pitch reviews.' },
];

export interface AlumniProfile {
  id: string;
  name: string;
  batch: number;
  company: string;
  role: string;
  city: string;
  openToMentoring: boolean;
  openToReferrals: boolean;
  seed: string;
}

export const alumni: AlumniProfile[] = [
  { id: 'al-1', name: 'Snehal Phadke', batch: 2019, company: 'Google', role: 'Software Engineer', city: 'Bengaluru', openToMentoring: true, openToReferrals: true, seed: 'al-1' },
  { id: 'al-2', name: 'Akash Lohar', batch: 2020, company: 'Razorpay', role: 'Backend Engineer', city: 'Pune', openToMentoring: true, openToReferrals: true, seed: 'al-2' },
  { id: 'al-3', name: 'Mrunal Dixit', batch: 2018, company: 'Infosys', role: 'Senior Analyst', city: 'Pune', openToMentoring: false, openToReferrals: true, seed: 'al-3' },
  { id: 'al-4', name: 'Yash Thakur', batch: 2021, company: 'Early-stage startup', role: 'Co-founder', city: 'Mumbai', openToMentoring: true, openToReferrals: false, seed: 'al-4' },
  { id: 'al-5', name: 'Kriti Naik', batch: 2017, company: 'Siemens', role: 'Embedded Lead', city: 'Aurangabad', openToMentoring: true, openToReferrals: false, seed: 'al-5' },
];

export const referralRequests: { id: string; role: string; company: string; askerId: string; status: 'Open' | 'Referred' | 'Closed' }[] = [
  { id: 'rf-1', role: 'Backend Engineer', company: 'Razorpay', askerId: 'p-tanvi', status: 'Open' },
  { id: 'rf-2', role: 'Data Analyst', company: 'Infosys', askerId: 'p-omkar', status: 'Referred' },
  { id: 'rf-3', role: 'Embedded Engineer', company: 'Siemens', askerId: 'p-sanket', status: 'Open' },
];

export const alumniEvents = [
  { id: 'ae-1', title: 'Alumni AMA: Life after the first job', date: istAt(8, 18), venue: 'Online', seed: 'ae-1' },
  { id: 'ae-2', title: 'Homecoming & Batch Reunion 2016–2019', date: istAt(40, 10), venue: 'Main Auditorium', seed: 'ae-2' },
];

export const placementStats = [
  { label: 'Students placed (last batch)', value: '312' },
  { label: 'Companies visited', value: '64' },
  { label: 'Median package', value: '₹6.0 LPA' },
  { label: 'Highest package', value: '₹18 LPA' },
];
