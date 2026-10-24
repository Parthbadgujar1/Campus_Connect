// Starting data for local development and testing: one college (CSMSS), its departments,
// fifteen accounts covering every role, and real content in every module, written the way the
// app itself writes it (so every counter, index and validation rule holds).
//
// Accounts (ordinary email + password, like any app; all use DEMO_PASSWORD below unless
// SEED_PASSWORD is set). The addresses use example.com, a domain reserved for examples, so no
// real person's inbox ever receives mail from a test setup:
//   prashant.joshi@example.com       admin      Dean of Student Affairs
//   neha.kulkarni@example.com        admin      IT Cell coordinator (second admin for identity reveals)
//   swati.gaikwad@example.com        moderator  Student council, community moderator
//   anjali.deshpande@example.com     faculty    Professor, Computer Engineering
//   rohan.shinde@example.com         faculty    Assistant Professor, Electronics & Telecom
//   karan.mehta@example.com          expert     Alumni mentor (industry)
//   riya.deshmukh@example.com        student    TE Computer B
//   pooja.kale@example.com           student    BE Computer A, GDSC lead
//   vishwajeet.patil@example.com     student    TE Computer A
//   sanket.jadhav@example.com        student    TE IT B
//   aditi.shinde@example.com         student    SE ENTC A
//   omkar.bhosale@example.com        student    BE Mechanical C
//   sneha.pawar@example.com          student    FE Computer B
//   meenal.rao@example.com           student    signed up as faculty; waiting for an admin to approve
//   tejas.more@example.com           student    SE Civil A
//
// Photos: put JPEG/PNG files in apps/api/seed-assets/photos/ named as in PHOTOS below and they are
// uploaded through the normal upload pipeline (EXIF removed, thumbnails made). Missing photos are
// simply skipped; the app shows initials and colour covers instead.
//
// These are local test credentials. The seed refuses to run in production.
// Usage: npm run db:seed --workspace=api   (or as part of npm run db:reset)

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { loadEnvFile, parseConfig, type Config } from '../src/config/env.js';
import { renderReport } from '../src/core/exports/report.js';
import { closeDeps, createDeps, type Deps } from '../src/deps.js';
import { uuidv7 } from '../src/infra/db/ids.js';
import type { Message, Role, SurveyQuestion, User } from '../src/infra/db/models.js';
import { TERMS_VERSION } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { storeUpload } from '../src/modules/files/files.service.js';
import type { Purpose } from '../src/modules/files/file-policy.js';
import { FLAG_DEFAULTS } from '../src/modules/flags/flags.service.js';
import { defaultNotificationPrefs, defaultProfile, defaultSettings } from '../src/modules/users/defaults.js';

export const DEMO_PASSWORD = 'Vishu@123';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);
const here = dirname(fileURLToPath(import.meta.url));
const PHOTO_DIR = join(here, '..', 'seed-assets', 'photos');

/** Photo files the seed uses when present (name -> what it shows). */
export const PHOTOS = {
  'event-hackathon': 'Students coding together at a hackathon',
  'event-workshop': 'A hands-on electronics workshop',
  'event-fest': 'An evening college fest stage',
  'event-placement': 'A seminar hall during a talk',
  'event-sports': 'An outdoor sports ground',
  'post-portfolio': 'A laptop showing code on a desk',
  'post-robot': 'A small line-follower robot',
  'post-library': 'Students studying in a library',
  'listing-drawing-kit': 'An engineering drawing kit',
  'listing-book': 'A stack of textbooks',
  'listing-arduino': 'An Arduino starter kit',
  'listing-cycle': 'A bicycle parked on campus',
  'lost-earbuds': 'Earbuds in a charging case',
  'lost-calculator': 'A scientific calculator',
  'avatar-riya': 'Profile photo',
  'avatar-pooja': 'Profile photo',
  'avatar-karan': 'Profile photo',
  'avatar-anjali': 'Profile photo',
} as const;

export async function seed(config: Config): Promise<void> {
  if (config.isProd) throw new Error('Refusing to seed a production database.');
  const logger = pino({ level: 'warn' });
  const deps = createDeps(config, logger);
  try {
    await deps.db.connect();
    await run(deps);
  } finally {
    await closeDeps(deps);
  }
}

async function run(deps: Deps): Promise<void> {
  const db = deps.db;
  if (await db.col('colleges').countDocuments({}, { limit: 1 })) {
    console.log('seed: data already present, skipping (run db:reset for a fresh copy)');
    return;
  }
  const password = await hashPassword(process.env.SEED_PASSWORD || DEMO_PASSWORD);
  const created = at(-75 * DAY);

  // ---------------------------------------------------------------- college & departments
  const college = uuidv7();
  await db.col('colleges').insertOne({
    _id: college,
    slug: 'csmss',
    name: 'CSMSS Chh. Shahu College of Engineering',
    shortName: 'CSMSS',
    city: 'Chhatrapati Sambhajinagar',
    state: 'Maharashtra',
    timezone: 'Asia/Kolkata',
    shard: 'default',
    status: 'active',
    domains: [
      // Optional: people who sign up with a college address are matched to the college without
      // choosing it. Anyone can join with any email address and pick the college instead.
      { domain: 'csmss.edu', allowsRoles: ['student', 'faculty'] },
    ],
    settings: { academicYear: '2026-27', currentSemester: 'odd', divisions: ['A', 'B', 'C'] },
    createdAt: created,
    updatedAt: created,
  });
  const dept: Record<string, string> = {};
  for (const [code, name] of [
    ['COMP', 'Computer Engineering'],
    ['IT', 'Information Technology'],
    ['ENTC', 'Electronics & Telecommunication'],
    ['ELEC', 'Electrical Engineering'],
    ['MECH', 'Mechanical Engineering'],
    ['CIVIL', 'Civil Engineering'],
  ] as const) {
    dept[code] = uuidv7();
    await db.col('departments').insertOne({ _id: dept[code]!, collegeId: college, code, name, createdAt: created });
  }

  // ---------------------------------------------------------------- people
  interface PersonSeed {
    email: string;
    name: string;
    username: string;
    role: Role;
    pendingRole?: 'faculty' | 'expert';
    dept?: keyof typeof dept | string;
    year?: number;
    semester?: number;
    division?: string;
    headline?: string;
    bio?: string;
    skills?: string[];
    interests?: string[];
    links?: Record<string, string>;
    verified?: boolean;
    roleInfo: User['roleInfo'];
    theme?: User['settings']['theme'];
    font?: User['settings']['font'];
    joined: number; // days ago
    lastSeen: number; // hours ago
  }
  const people: PersonSeed[] = [
    { email: 'prashant.joshi@example.com', name: 'Dr. Prashant Joshi', username: 'prashant.joshi', role: 'admin', headline: 'Dean, Student Affairs', bio: 'Looks after student life, clubs and the CampusConnect rollout. My door (Admin block, room 12) is open 10-1 on weekdays.', verified: true, roleInfo: { employeeId: 'CSMSS-F-0107', designation: 'Dean, Student Affairs' }, joined: 75, lastSeen: 3 },
    { email: 'neha.kulkarni@example.com', name: 'Neha Kulkarni', username: 'neha.kulkarni', role: 'admin', headline: 'IT Cell coordinator', bio: 'Accounts, access and anything that breaks. Email the IT cell for urgent issues.', verified: true, roleInfo: { employeeId: 'CSMSS-S-0218', designation: 'IT Cell coordinator' }, theme: 'night', joined: 75, lastSeen: 6 },
    { email: 'swati.gaikwad@example.com', name: 'Swati Gaikwad', username: 'swati.g', role: 'moderator', dept: 'IT', year: 4, semester: 7, division: 'A', headline: 'Student council · community moderator', bio: 'Keeping the boards friendly. Report anything that feels off and I will look at it the same day.', verified: true, roleInfo: { enrollmentNumber: 'CSMSS23IT011', admissionYear: 2023 }, joined: 70, lastSeen: 2 },
    { email: 'anjali.deshpande@example.com', name: 'Dr. Anjali Deshpande', username: 'dr.deshpande', role: 'faculty', dept: 'COMP', headline: 'Professor, Operating Systems & DBMS', bio: 'Teaching OS and DBMS for 14 years. Office hours Tue/Thu 3-5 pm, Room 304.', skills: ['Operating Systems', 'DBMS', 'Distributed systems'], verified: true, roleInfo: { employeeId: 'CSMSS-F-0342', designation: 'Professor' }, font: 'readable', joined: 72, lastSeen: 5 },
    { email: 'rohan.shinde@example.com', name: 'Prof. Rohan Shinde', username: 'prof.rohan', role: 'faculty', dept: 'ENTC', headline: 'Assistant Professor, Embedded Systems', bio: 'Faculty advisor of the Robotics Club. Microcontrollers, IoT and PCB design.', skills: ['Embedded C', 'IoT', 'PCB design'], verified: true, roleInfo: { employeeId: 'CSMSS-F-0415', designation: 'Assistant Professor' }, joined: 70, lastSeen: 30 },
    { email: 'karan.mehta@example.com', name: 'Karan Mehta', username: 'karan.mehta', role: 'expert', headline: 'Senior Software Engineer · alumni mentor', bio: 'CSMSS class of 2016. Payments and distributed systems. Happy to review resumes and talk system design.', skills: ['System design', 'Go', 'Kubernetes', 'Interviews'], links: { linkedin: 'https://www.linkedin.com/in/karan-mehta' }, verified: true, roleInfo: { organization: 'Razorpay', designation: 'Senior Software Engineer', linkedinUrl: 'https://www.linkedin.com/in/karan-mehta' }, joined: 60, lastSeen: 20 },
    { email: 'riya.deshmukh@example.com', name: 'Riya Deshmukh', username: 'riya.d', role: 'student', dept: 'COMP', year: 3, semester: 5, division: 'B', headline: 'Full-stack learner · hackathon regular', bio: 'React, TypeScript and too many side projects. The one who always has the notes.', skills: ['React', 'TypeScript', 'Python', 'SQL', 'Figma'], interests: ['Hackathons', 'Photography', 'Badminton', 'Open source'], links: { github: 'https://github.com/riya-deshmukh' }, verified: true, roleInfo: { enrollmentNumber: 'CSMSS24CO045', admissionYear: 2024 }, joined: 68, lastSeen: 1 },
    { email: 'pooja.kale@example.com', name: 'Pooja Kale', username: 'pooja.kale', role: 'student', dept: 'COMP', year: 4, semester: 7, division: 'A', headline: 'GDSC lead', bio: 'Building developer communities one workshop at a time. Flutter and cloud.', skills: ['Flutter', 'Firebase', 'Google Cloud', 'Public speaking'], interests: ['Community building', 'Design'], verified: true, roleInfo: { enrollmentNumber: 'CSMSS23CO012', admissionYear: 2023 }, theme: 'day', joined: 66, lastSeen: 2 },
    { email: 'vishwajeet.patil@example.com', name: 'Vishwajeet Patil', username: 'vishwajeet.p', role: 'student', dept: 'COMP', year: 3, semester: 5, division: 'A', headline: 'Writes the notes so you do not have to', bio: 'OS, DBMS and compilers. GATE 2027 aspirant. Chess on weekends.', skills: ['C++', 'Operating systems', 'LaTeX'], interests: ['Academics', 'Chess'], verified: true, roleInfo: { enrollmentNumber: 'CSMSS24CO051', admissionYear: 2024 }, font: 'readable', joined: 65, lastSeen: 8 },
    { email: 'sanket.jadhav@example.com', name: 'Sanket Jadhav', username: 'sanket.j', role: 'student', dept: 'IT', year: 3, semester: 5, division: 'B', headline: 'Backend & cloud', bio: 'Node, Docker and AWS. Ask me about deployments.', skills: ['Node.js', 'Docker', 'AWS', 'PostgreSQL'], interests: ['Cricket', 'DevOps'], verified: true, roleInfo: { enrollmentNumber: 'CSMSS24IT033', admissionYear: 2024 }, joined: 64, lastSeen: 4 },
    { email: 'aditi.shinde@example.com', name: 'Aditi Shinde', username: 'aditi.s', role: 'student', dept: 'ENTC', year: 2, semester: 3, division: 'A', headline: 'Robotics club', bio: 'Arduino, PCB design and too much coffee.', skills: ['Embedded C', 'Arduino', 'KiCad'], interests: ['Robotics', 'Music'], verified: true, roleInfo: { enrollmentNumber: 'CSMSS25EC019', admissionYear: 2025 }, joined: 60, lastSeen: 12 },
    { email: 'omkar.bhosale@example.com', name: 'Omkar Bhosale', username: 'omkar.b', role: 'student', dept: 'MECH', year: 4, semester: 7, division: 'C', headline: 'SAE Baja team', bio: 'CAD all day, welding on weekends.', skills: ['SolidWorks', 'ANSYS'], interests: ['Motorsport', 'Football'], roleInfo: { enrollmentNumber: 'CSMSS23ME027', admissionYear: 2023 }, joined: 58, lastSeen: 26 },
    { email: 'sneha.pawar@example.com', name: 'Sneha Pawar', username: 'sneha.p', role: 'student', dept: 'COMP', year: 1, semester: 1, division: 'B', headline: 'First year', bio: 'Figuring it all out. Dance and design.', skills: ['Python'], interests: ['Dance', 'Design'], roleInfo: { enrollmentNumber: 'CSMSS26CO088', admissionYear: 2026 }, joined: 40, lastSeen: 9 },
    { email: 'meenal.rao@example.com', name: 'Dr. Meenal Rao', username: 'meenal.rao', role: 'student', pendingRole: 'faculty', dept: 'CIVIL', headline: 'Associate Professor, Structural Engineering', roleInfo: { employeeId: 'CSMSS-F-0466', designation: 'Associate Professor' }, joined: 2, lastSeen: 30 },
    { email: 'tejas.more@example.com', name: 'Tejas More', username: 'tejas.more', role: 'student', dept: 'CIVIL', year: 2, semester: 3, division: 'A', headline: 'Civil · surveying nerd', bio: 'Total stations, AutoCAD and long walks around campus measuring things.', skills: ['AutoCAD', 'Surveying'], interests: ['Cricket', 'Trekking'], roleInfo: { enrollmentNumber: 'CSMSS25CE007', admissionYear: 2025 }, joined: 45, lastSeen: 50 },
  ];

  const id: Record<string, string> = {};
  for (const p of people) {
    const userId = uuidv7();
    id[p.username] = userId;
    const joined = at(-p.joined * DAY);
    const profile = {
      ...defaultProfile({ username: p.username, displayName: p.name }),
      headline: p.headline ?? null,
      bio: p.bio ?? null,
      departmentId: p.dept ? (dept[p.dept] ?? null) : null,
      year: p.year ?? null,
      semester: p.semester ?? null,
      division: p.division ?? null,
      skills: p.skills ?? [],
      interests: p.interests ?? [],
      links: p.links ?? {},
      isVerified: p.verified ?? false,
    };
    const settings = { ...defaultSettings(), theme: p.theme ?? 'system', font: p.font ?? 'handwritten', onboardingCompletedAt: p.joined > 3 ? joined : null, tourCompletedAt: p.joined > 3 ? joined : null, tourVersion: p.joined > 3 ? 1 : 0 };
    await db.col('users').insertOne({
      _id: userId,
      collegeId: college,
      email: p.email,
      emailVerifiedAt: joined,
      passwordHash: password,
      role: p.role,
      pendingRole: p.pendingRole ?? null,
      status: 'active',
      roleInfo: p.roleInfo,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: at(-p.lastSeen * HOUR),
      passwordChangedAt: joined,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: joined,
      adultConfirmedAt: joined,
      deletionScheduledFor: null,
      deletionReason: null,
      profile,
      settings,
      notificationPrefs: { ...defaultNotificationPrefs(false), emailDigest: p.role === 'student' ? 'weekly' : 'off' },
      createdAt: joined,
      updatedAt: joined,
    });
    await db.col('consents').insertMany(
      (['terms', 'privacy', 'marketing_email'] as const).map((purpose) => ({ _id: uuidv7(), userId, anonymousId: null, purpose, granted: purpose !== 'marketing_email', policyVersion: TERMS_VERSION, source: 'signup' as const, ipHash: null, createdAt: joined })),
    );
    if (p.pendingRole) {
      await db.col('verification_requests').insertOne({ _id: uuidv7(), collegeId: college, userId, kind: p.pendingRole === 'faculty' ? 'faculty_role' : 'expert_role', status: 'pending', fileId: null, note: [p.roleInfo.designation, p.roleInfo.employeeId].filter(Boolean).join(' · '), reviewerId: null, reviewerNote: null, reviewedAt: null, createdAt: joined, updatedAt: joined });
    }
  }
  const u = (username: string) => {
    const v = id[username];
    if (!v) throw new Error(`seed: unknown user ${username}`);
    return v;
  };

  // ---------------------------------------------------------------- photos (optional)
  const photo = async (name: keyof typeof PHOTOS, purpose: Purpose, owner: string): Promise<string | null> => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const path = join(PHOTO_DIR, `${name}.${ext}`);
      if (!existsSync(path)) continue;
      const f = await storeUpload(deps, { auth: { userId: u(owner), collegeId: college }, purpose, filename: `${name}.${ext}`, buffer: readFileSync(path), requestId: 'seed', ipHash: null });
      return f.id;
    }
    return null;
  };
  for (const [name, owner] of [['avatar-riya', 'riya.d'], ['avatar-pooja', 'pooja.kale'], ['avatar-karan', 'karan.mehta'], ['avatar-anjali', 'dr.deshpande']] as const) {
    const fileId = await photo(name, 'avatar', owner);
    if (fileId) await db.col('users').updateOne({ _id: u(owner) }, { $set: { 'profile.avatarFileId': fileId } });
  }

  // ---------------------------------------------------------------- social graph
  const follows: Array<[string, string]> = [
    ['riya.d', 'pooja.kale'], ['riya.d', 'vishwajeet.p'], ['riya.d', 'sanket.j'], ['riya.d', 'dr.deshpande'], ['riya.d', 'karan.mehta'],
    ['pooja.kale', 'riya.d'], ['vishwajeet.p', 'riya.d'], ['sanket.j', 'riya.d'], ['aditi.s', 'riya.d'], ['sneha.p', 'riya.d'],
    ['pooja.kale', 'vishwajeet.p'], ['sanket.j', 'pooja.kale'], ['omkar.b', 'aditi.s'], ['sneha.p', 'pooja.kale'], ['aditi.s', 'prof.rohan'],
    ['tejas.more', 'omkar.b'], ['sanket.j', 'karan.mehta'], ['pooja.kale', 'karan.mehta'], ['vishwajeet.p', 'dr.deshpande'], ['swati.g', 'pooja.kale'],
  ];
  for (const [a, b] of follows) await db.col('follows').insertOne({ _id: `${u(a)}:${u(b)}`, followerId: u(a), followeeId: u(b), createdAt: at(-30 * DAY) });

  // ---------------------------------------------------------------- spaces & discussions
  const spaceSeeds = [
    { slug: 'gdsc', name: 'GDSC CSMSS', kind: 'club', description: 'Google Developer Student Club: workshops, study jams and hackathons. Everyone is welcome, no experience needed.', tags: ['android', 'web', 'cloud'], owner: 'pooja.kale', members: ['riya.d', 'sanket.j', 'sneha.p', 'vishwajeet.p', 'swati.g'] },
    { slug: 'robotics', name: 'Robotics Club', kind: 'club', description: 'Line followers to robo-wars. The lab is open 4-7 pm on weekdays; Prof. Rohan Shinde is the faculty advisor.', tags: ['robotics', 'embedded'], owner: 'aditi.s', members: ['omkar.b', 'riya.d', 'prof.rohan'] },
    { slug: 'gate-2027', name: 'GATE 2027 Prep', kind: 'exam', description: 'One problem a day, weekly mock tests and doubt solving for GATE CS.', tags: ['gate', 'dsa'], owner: 'vishwajeet.p', members: ['riya.d', 'sanket.j'] },
    { slug: 'te-comp-b', name: 'TE Computer B', kind: 'class', description: 'Third year Computer Engineering, division B. Timetable changes, assignments and lab batches.', tags: ['class'], owner: 'dr.deshpande', members: ['riya.d'], privacy: 'private' },
    { slug: 'lens-and-light', name: 'Lens & Light', kind: 'interest', description: 'Campus photography walks every other Sunday, plus editing tips.', tags: ['photography'], owner: 'riya.d', members: ['aditi.s', 'omkar.b', 'tejas.more'] },
    { slug: 'hostel-b', name: 'Hostel Block B', kind: 'hostel', description: 'Mess menu, laundry schedule and lost keys.', tags: ['hostel'], owner: 'sanket.j', members: ['omkar.b', 'tejas.more'] },
  ] as const;
  const space: Record<string, string> = {};
  for (const s of spaceSeeds) {
    const sid = uuidv7();
    space[s.slug] = sid;
    const when = at(-50 * DAY);
    await db.col('spaces').insertOne({ _id: sid, collegeId: college, slug: s.slug, name: s.name, kind: s.kind, privacy: 'privacy' in s ? s.privacy : 'public', description: s.description, tags: [...s.tags], avatarFileId: null, membersCount: 0, status: 'active', createdBy: u(s.owner), createdAt: when, updatedAt: when });
    await db.col('space_members').insertOne({ _id: `${sid}:${u(s.owner)}`, spaceId: sid, userId: u(s.owner), role: 'owner', status: 'active', joinedAt: when });
    for (const m of s.members) await db.col('space_members').insertOne({ _id: `${sid}:${u(m)}`, spaceId: sid, userId: u(m), role: 'member', status: 'active', joinedAt: at(-40 * DAY) });
  }
  // A space waiting for approval, and a join request waiting in a private space.
  const pendingSpace = uuidv7();
  await db.col('spaces').insertOne({ _id: pendingSpace, collegeId: college, slug: 'anime-club', name: 'Anime Club', kind: 'interest', privacy: 'public', description: 'Weekly screenings in the AV room and long discussions after.', tags: ['anime'], avatarFileId: null, membersCount: 0, status: 'pending', createdBy: u('sneha.p'), createdAt: at(-1 * DAY), updatedAt: at(-1 * DAY) });
  await db.col('space_members').insertOne({ _id: `${pendingSpace}:${u('sneha.p')}`, spaceId: pendingSpace, userId: u('sneha.p'), role: 'owner', status: 'active', joinedAt: at(-1 * DAY) });
  await db.col('space_members').insertOne({ _id: `${space['te-comp-b']}:${u('sneha.p')}`, spaceId: space['te-comp-b']!, userId: u('sneha.p'), role: 'member', status: 'pending', joinedAt: at(-2 * HOUR) });

  const discussion = async (spaceSlug: string, author: string, title: string, body: string, flair: string, ago: number, pinned = false) => {
    const tid = uuidv7();
    await db.col('discussions').insertOne({ _id: tid, collegeId: college, spaceId: space[spaceSlug]!, authorId: u(author), title, body, flair, isPinned: pinned, isLocked: false, score: 0, repliesCount: 0, status: 'published', lastActivityAt: at(-ago), createdAt: at(-ago), updatedAt: at(-ago), deletedAt: null });
    return tid;
  };
  const reply = async (discussionId: string, author: string, body: string, ago: number, parent?: { id: string; depth: number }) => {
    const rid = uuidv7();
    await db.col('discussion_replies').insertOne({ _id: rid, discussionId, parentId: parent?.id ?? null, authorId: u(author), body, depth: parent ? parent.depth + 1 : 0, score: 0, status: 'published', createdAt: at(-ago), updatedAt: at(-ago), deletedAt: null });
    return { id: rid, depth: parent ? parent.depth + 1 : 0 };
  };
  const t1 = await discussion('gdsc', 'pooja.kale', 'Study Jam: Cloud fundamentals starts Monday', 'Four sessions, two hours each, in Lab 2. Bring a laptop with a browser; we will set up free credits together in the first session. Reply here with questions!', 'Announcement', 6 * DAY, true);
  const t2 = await discussion('gate-2027', 'vishwajeet.p', 'Best resources for Theory of Computation?', 'I keep getting stuck on pumping lemma proofs. What helped you understand them, not just memorise the steps?', 'Question', 3 * DAY);
  const t3 = await discussion('robotics', 'aditi.s', 'Robo-race team formation', 'We need two more members for the inter-college robo race in December. Mechanical folks especially welcome for the chassis.', 'Team up', 2 * DAY);
  const t4 = await discussion('hostel-b', 'sanket.j', 'Mess menu feedback for this week', 'The committee meets on Friday. Post what you would like changed, one suggestion per reply so we can count votes.', 'Discussion', 1 * DAY);
  const t5 = await discussion('lens-and-light', 'riya.d', 'Sunday walk: golden hour near the old library', 'Meeting at 5:15 pm at the main gate. Phones are fine; the point is to practise composition.', 'Event', 4 * DAY);
  const r1 = await reply(t2, 'riya.d', 'Peter Linz plus the NPTEL lectures. Do the exercises at the end of each chapter, not just the solved examples.', 2 * DAY);
  await reply(t2, 'sanket.j', 'Seconding Linz. Also try drawing the automaton before writing the proof; it makes the split obvious.', 2 * DAY - 2 * HOUR, r1);
  await reply(t2, 'dr.deshpande', 'Think of the lemma as a game against an adversary who picks the split. You only need one string that breaks every split.', 1 * DAY);
  await reply(t1, 'sneha.p', 'Is this okay for first years?', 5 * DAY);
  await reply(t1, 'pooja.kale', 'Absolutely, session 1 starts from zero.', 5 * DAY - 3 * HOUR);
  await reply(t3, 'omkar.b', 'I am in. I can handle the chassis design and the motor mounts.', 1 * DAY);
  await reply(t4, 'omkar.b', 'Poha on Wednesdays instead of upma, please.', 20 * HOUR);
  await reply(t4, 'tejas.more', 'Dinner at 8:30 instead of 8 during exams.', 18 * HOUR);
  await reply(t5, 'aditi.s', 'Count me in. Bringing my old DSLR.', 3 * DAY);
  const vote = async (voter: string, type: 'discussion' | 'discussion_reply' | 'hush_question' | 'hush_answer', target: string, value: 1 | -1 = 1) =>
    db.col('votes').insertOne({ _id: `${u(voter)}:${type}:${target}`, userId: u(voter), targetType: type, targetId: target, value, createdAt: at(-1 * DAY) });
  for (const [voter, target] of [['riya.d', t1], ['sanket.j', t1], ['sneha.p', t1], ['swati.g', t1], ['riya.d', t2], ['sanket.j', t2], ['omkar.b', t3], ['riya.d', t3], ['tejas.more', t4], ['omkar.b', t4], ['aditi.s', t5]] as const) await vote(voter, 'discussion', target);
  await vote('vishwajeet.p', 'discussion_reply', r1.id);

  // ---------------------------------------------------------------- feed
  interface PostSeed { author: string; anonymous?: boolean; body: string; kind?: 'post' | 'question' | 'poll' | 'announcement'; tags?: string[]; ago: number; pinned?: boolean; photo?: keyof typeof PHOTOS; audience?: 'college' | 'department' | 'year'; poll?: string[] }
  const postSeeds: PostSeed[] = [
    { author: 'dr.deshpande', body: 'Reminder for TE Computer: the DBMS mini-project synopsis is due this Friday. Submit one per group on the class space. Include the problem statement, an ER diagram and the tables you plan.', kind: 'announcement', tags: ['dbms'], ago: 2 * HOUR, pinned: true, audience: 'department' },
    { author: 'pooja.kale', body: 'GDSC Cloud Study Jam registrations are open! Four sessions, certificates for everyone who finishes all labs. Details and the sign-up are in the Events tab.', tags: ['gdsc', 'cloud'], ago: 5 * HOUR },
    { author: 'riya.d', body: 'Finally finished rebuilding my portfolio with Next.js and a little motion. Feedback welcome, be honest!', tags: ['webdev', 'portfolio'], ago: 9 * HOUR, photo: 'post-portfolio' },
    { author: 'vishwajeet.p', body: 'Put my OS notes for Units 1-3 on the Shelf (Computer Engineering → Semester 5 → Operating Systems). Deadlocks and CPU scheduling are covered with solved examples.', tags: ['os', 'notes'], ago: 22 * HOUR },
    { author: 'sanket.j', body: 'For the TE mini project, is Firebase or a small Node + PostgreSQL backend better? Thinking about what is easier to explain in interviews.', kind: 'question', tags: ['backend'], ago: 30 * HOUR },
    { author: 'aditi.s', body: 'Our line follower finally stopped drifting after three weeks of PID tuning. Demo at the robotics lab tomorrow at 5 pm, come see it!', tags: ['robotics'], ago: 2 * DAY, photo: 'post-robot' },
    { author: 'sneha.p', anonymous: true, body: 'Does anyone else feel lost in the first year? Everyone seems to already know how to code.', kind: 'question', ago: 3 * DAY },
    { author: 'omkar.b', body: 'SAE Baja team is recruiting second years for the design and finance sub-teams. Message me with what you would like to work on.', tags: ['sae', 'mechanical'], ago: 4 * DAY },
    { author: 'karan.mehta', body: 'Open office hour this Saturday 11 am on Google Meet: bring your resume and I will review five live. Message me to book a slot.', tags: ['careers', 'resume'], ago: 5 * DAY },
    { author: 'swati.g', body: 'Library is open till 10 pm from Monday until the end of exams. The second floor is a silent zone; group study rooms can be booked at the desk.', tags: ['library'], ago: 6 * DAY, photo: 'post-library' },
    { author: 'pooja.kale', body: 'When should the next GDSC workshop be?', kind: 'poll', tags: ['gdsc'], ago: 1 * DAY, poll: ['Saturday morning', 'Weekday evening', 'Sunday afternoon'] },
  ];
  const post: string[] = [];
  for (const p of postSeeds) {
    const pid = uuidv7();
    post.push(pid);
    const author = u(p.author);
    const when = at(-p.ago);
    const attachment = p.photo ? await photo(p.photo, 'post', p.author) : null;
    const audienceType = p.audience ?? 'college';
    const authorDoc = people.find((x) => x.username === p.author)!;
    if (p.anonymous) await db.col('anonymous_authors').insertOne({ _id: `post:${pid}`, contentType: 'post', contentId: pid, userId: author, createdAt: when });
    await db.col('posts').insertOne({
      _id: pid,
      collegeId: college,
      authorId: p.anonymous ? null : author,
      isAnonymous: Boolean(p.anonymous),
      kind: p.kind ?? 'post',
      body: p.body,
      audience: { type: audienceType, departmentId: audienceType === 'department' ? (dept[authorDoc.dept ?? ''] ?? null) : null, year: null, division: null, spaceId: null },
      tags: p.tags ?? [],
      attachmentIds: attachment ? [attachment] : [],
      mediaKinds: attachment ? ['image'] : [],
      poll: p.poll ? { options: p.poll.map((label) => ({ id: uuidv7(), label, votes: 0 })), totalVotes: 0 } : null,
      isPinned: p.pinned ?? false,
      likesCount: 0,
      commentsCount: 0,
      savesCount: 0,
      status: 'published',
      createdAt: when,
      updatedAt: when,
      deletedAt: null,
    });
  }
  // Poll votes
  const pollPost = await db.col('posts').findOne({ _id: post[10]! });
  for (const [voter, opt] of [['riya.d', 0], ['sanket.j', 0], ['sneha.p', 2], ['vishwajeet.p', 1], ['swati.g', 0]] as const) {
    await db.col('poll_votes').insertOne({ _id: `${post[10]}:${u(voter)}`, postId: post[10]!, optionId: pollPost!.poll!.options[opt]!.id, userId: u(voter), createdAt: at(-20 * HOUR) });
  }
  // Likes, comments, saves
  for (const [i, likers] of [[0, ['riya.d', 'sanket.j', 'sneha.p']], [1, ['riya.d', 'sneha.p', 'vishwajeet.p', 'aditi.s']], [2, ['pooja.kale', 'vishwajeet.p', 'sanket.j', 'aditi.s', 'sneha.p']], [3, ['riya.d', 'sanket.j', 'sneha.p']], [5, ['riya.d', 'omkar.b', 'prof.rohan']], [6, ['riya.d', 'pooja.kale', 'swati.g']], [8, ['riya.d', 'sanket.j', 'pooja.kale']], [9, ['vishwajeet.p']]] as const) {
    for (const l of likers) await db.col('post_likes').insertOne({ _id: `${post[i]}:${u(l)}`, postId: post[i]!, userId: u(l), createdAt: at(-HOUR) });
  }
  const comment = async (i: number, author: string, body: string, ago: number, anonymous = false) => {
    const cid = uuidv7();
    if (anonymous) await db.col('anonymous_authors').insertOne({ _id: `comment:${cid}`, contentType: 'comment', contentId: cid, userId: u(author), createdAt: at(-ago) });
    await db.col('comments').insertOne({ _id: cid, postId: post[i]!, authorId: anonymous ? null : u(author), isAnonymous: anonymous, parentId: null, body, status: 'published', createdAt: at(-ago), updatedAt: at(-ago), deletedAt: null });
  };
  await comment(2, 'pooja.kale', 'The hero animation is lovely. Maybe reduce motion on mobile?', 8 * HOUR);
  await comment(2, 'vishwajeet.p', 'Clean! Put the projects section higher up.', 7 * HOUR);
  await comment(4, 'riya.d', 'Node + PostgreSQL. You learn SQL, sign-in and deployment, and it is easy to explain in interviews.', 28 * HOUR);
  await comment(4, 'karan.mehta', 'Either works. What matters is that you can explain the trade-offs you made. Keep a short design doc in the repo.', 26 * HOUR);
  await comment(6, 'pooja.kale', 'Completely normal. Join the GDSC beginner track; we start from zero.', 3 * DAY - 2 * HOUR);
  await comment(6, 'riya.d', 'I felt the same in my first year. It gets better, promise. Message me anytime.', 3 * DAY - 3 * HOUR);
  await comment(6, 'sneha.p', 'Thank you both, this helps a lot.', 2 * DAY, true);
  for (const [who, i] of [['riya.d', 3], ['sneha.p', 3], ['sanket.j', 8]] as const) {
    await db.col('saved_items').insertOne({ _id: `${u(who)}:post:${post[i]}`, userId: u(who), itemType: 'post', itemId: post[i]!, createdAt: at(-HOUR) });
  }

  // ---------------------------------------------------------------- chats
  const chat = async (kind: 'direct' | 'group' | 'class', members: Array<[string, 'owner' | 'admin' | 'member']>, extra: { title?: string; description?: string; createdBy: string; ago: number }) => {
    const cid = uuidv7();
    const when = at(-extra.ago);
    await db.col('chats').insertOne({ _id: cid, collegeId: college, kind, title: extra.title ?? null, description: extra.description ?? null, createdBy: u(extra.createdBy), directKey: kind === 'direct' ? members.map(([m]) => u(m)).sort().join(':') : null, spaceId: null, eventId: null, onlyAdminsPost: false, disappearingSeconds: null, lastMessageAt: null, createdAt: when, updatedAt: when });
    for (const [m, role] of members) {
      await db.col('chat_members').insertOne({ _id: `${cid}:${u(m)}`, chatId: cid, userId: u(m), role, joinedAt: when, lastReadAt: at(-3 * HOUR), mutedUntil: null, archivedAt: null, pinnedAt: null, colorWash: 'none', anonymousAlias: null });
    }
    return cid;
  };
  const dm = await chat('direct', [['riya.d', 'member'], ['pooja.kale', 'member']], { createdBy: 'riya.d', ago: 20 * DAY });
  const dm2 = await chat('direct', [['riya.d', 'member'], ['vishwajeet.p', 'member']], { createdBy: 'vishwajeet.p', ago: 10 * DAY });
  const dm3 = await chat('direct', [['sanket.j', 'member'], ['karan.mehta', 'member']], { createdBy: 'sanket.j', ago: 5 * DAY });
  const group = await chat('group', [['riya.d', 'owner'], ['sanket.j', 'member'], ['pooja.kale', 'member'], ['vishwajeet.p', 'member']], { title: 'Hackathon squad', description: 'Smart India Hackathon 2026 team', createdBy: 'riya.d', ago: 15 * DAY });
  const cls = await chat('class', [['dr.deshpande', 'owner'], ['riya.d', 'member'], ['sanket.j', 'member']], { title: 'TE Comp B', description: 'Official class chat', createdBy: 'dr.deshpande', ago: 40 * DAY });
  const msg = async (chatId: string, sender: string, body: string, ago: number, kind: Message['kind'] = 'text', payload: Record<string, unknown> = {}) => {
    await db.col('messages').insertOne({ _id: uuidv7(), chatId, senderId: u(sender), kind, body, replyToId: null, fileId: null, payload, clientId: null, editedAt: null, deletedAt: null, createdAt: at(-ago) });
  };
  await msg(dm, 'pooja.kale', 'Hey! Are you coming to the study jam on Monday?', 26 * HOUR);
  await msg(dm, 'riya.d', 'Yes! Can I bring Sneha? She is in first year.', 25 * HOUR);
  await msg(dm, 'pooja.kale', 'Of course, the more the merrier.', 2 * HOUR);
  await msg(dm, 'pooja.kale', 'Also, could you help at the registration desk for 30 minutes?', 1 * HOUR);
  await msg(dm2, 'vishwajeet.p', 'The OS notes are on the Shelf now.', 22 * HOUR);
  await msg(dm2, 'riya.d', 'Lifesaver. Thank you!', 21 * HOUR);
  await msg(dm3, 'sanket.j', 'Hi Karan, could you look at my resume before the TechNova drive?', 2 * DAY);
  await msg(dm3, 'karan.mehta', 'Sure. Send it as a PDF and tell me which role you are applying for.', 2 * DAY - 3 * HOUR);
  await msg(group, 'riya.d', 'Problem statements are out. I like the campus energy dashboard one.', 30 * HOUR);
  await msg(group, 'sanket.j', 'I can take the backend and the sensor data ingestion.', 29 * HOUR);
  await msg(group, 'pooja.kale', 'Planning meeting', 4 * HOUR, 'plan', { title: 'Hackathon planning', when: at(20 * HOUR).toISOString(), place: 'Central library' });
  await msg(group, 'vishwajeet.p', 'Works for me.', 30 * MIN);
  await msg(cls, 'dr.deshpande', 'DBMS lab moves to Lab 3 tomorrow.', 5 * HOUR);
  await msg(cls, 'sanket.j', 'Noted, thank you ma’am.', 4 * HOUR);

  // ---------------------------------------------------------------- events
  const event = async (row: { by: string; space?: string; organizer: string; title: string; description: string; category: string; start: number; hours: number; venue: string; capacity: number; deadline?: number; fee?: string; certificate?: boolean; tags: string[]; cover?: keyof typeof PHOTOS; status?: 'published' | 'pending' }) => {
    const eid = uuidv7();
    const cover = row.cover ? await photo(row.cover, 'event', row.by) : null;
    const startsAt = at(row.start);
    await db.col('events').insertOne({
      _id: eid,
      collegeId: college,
      spaceId: row.space ? space[row.space]! : null,
      createdBy: u(row.by),
      organizerName: row.organizer,
      title: row.title,
      description: row.description,
      category: row.category,
      startsAt,
      endsAt: new Date(startsAt.getTime() + row.hours * HOUR),
      venue: row.venue,
      isOnline: false,
      onlineUrl: null,
      capacity: row.capacity,
      goingCount: 0,
      interestedCount: 0,
      registrationDeadline: row.deadline !== undefined ? at(row.deadline) : null,
      feeText: row.fee ?? null,
      hasCertificate: row.certificate ?? false,
      coverFileId: cover,
      tags: row.tags,
      checkInSecret: Buffer.from(uuidv7().replace(/-/g, '') + uuidv7().replace(/-/g, ''), 'hex').toString('base64url'),
      status: row.status ?? 'published',
      createdAt: at(-10 * DAY),
      updatedAt: at(-10 * DAY),
    });
    return eid;
  };
  const e1 = await event({ by: 'pooja.kale', space: 'gdsc', organizer: 'GDSC CSMSS', title: 'Cloud Study Jam: Session 1', description: 'Hands-on introduction to cloud computing: virtual machines, storage buckets and your first deployed web page. Laptops required.', category: 'workshop', start: 3 * DAY, hours: 2, venue: 'Computer Lab 2', capacity: 60, certificate: true, tags: ['cloud', 'gdsc'], cover: 'event-hackathon' });
  const e2 = await event({ by: 'prashant.joshi', organizer: 'Training & Placement Cell', title: 'Campus Placement Drive: TechNova Labs', description: 'Eligibility: BE Computer/IT, 60% aggregate, no active backlogs. Aptitude test at 10 am, interviews from 2 pm. Bring three printed copies of your resume.', category: 'placement', start: 7 * DAY, hours: 6, venue: 'Seminar Hall', capacity: 200, deadline: 5 * DAY, tags: ['placement'], cover: 'event-placement' });
  const e3 = await event({ by: 'aditi.s', space: 'robotics', organizer: 'Robotics Club', title: 'Line Follower Workshop', description: 'Build and tune your first line follower. Kits are provided for registered participants only.', category: 'workshop', start: 5 * DAY, hours: 3, venue: 'Robotics Lab', capacity: 3, fee: '₹100 for the kit', tags: ['robotics'], cover: 'event-workshop' });
  const e4 = await event({ by: 'prashant.joshi', organizer: 'Cultural Committee', title: 'Tarang 2026: Annual Fest', description: 'Three days of music, dance, drama and food stalls. Club registrations for stalls close a week before.', category: 'fest', start: 20 * DAY, hours: 72, venue: 'Main ground', capacity: 3000, tags: ['fest', 'cultural'], cover: 'event-fest' });
  await event({ by: 'dr.deshpande', organizer: 'Department of Computer Engineering', title: 'Guest Lecture: Databases at Scale', description: 'Sharding, replication and what really happens in production, with Karan Mehta (class of 2016).', category: 'seminar', start: -10 * DAY, hours: 2, venue: 'Seminar Hall', capacity: 150, tags: ['dbms'] });
  await event({ by: 'omkar.b', organizer: 'SAE Baja CSMSS', title: 'Baja design review open house', description: 'See this year’s buggy, ask the design team anything, and sign up for sub-teams.', category: 'meetup', start: 9 * DAY, hours: 2, venue: 'Mechanical workshop', capacity: 40, tags: ['sae'], status: 'pending', cover: 'event-sports' });
  const rsvp = async (eventId: string, who: string, status: 'going' | 'interested', checkedIn = false) =>
    db.col('event_rsvps').insertOne({ _id: `${eventId}:${u(who)}`, eventId, userId: u(who), status, checkedInAt: checkedIn ? at(-9 * DAY) : null, createdAt: at(-2 * DAY), updatedAt: at(-2 * DAY) });
  for (const [ev, who, status] of [[e1, 'riya.d', 'going'], [e1, 'sneha.p', 'going'], [e1, 'sanket.j', 'interested'], [e2, 'riya.d', 'going'], [e2, 'sanket.j', 'going'], [e3, 'aditi.s', 'going'], [e3, 'omkar.b', 'going'], [e4, 'riya.d', 'interested'], [e4, 'tejas.more', 'going']] as const) await rsvp(ev, who, status);

  // ---------------------------------------------------------------- announcements
  for (const a of [
    { author: 'prashant.joshi', label: 'Principal’s Office', title: 'Mid-semester examination schedule', body: 'Mid-semester exams for all years begin on the 4th of next month. The detailed timetable is on the notice board and attached in the Academics section. Reach the hall 15 minutes early with your ID card.', category: 'important', pinned: true, ago: 1 * DAY, audience: { scope: 'college' } },
    { author: 'dr.deshpande', label: 'Department of Computer Engineering', title: 'DBMS mini-project guidelines', body: 'Groups of 3-4. Synopsis by Friday, final demo in week 12. Any stack is fine, but include an ER diagram and show normalisation up to 3NF.', category: 'notice', ago: 2 * DAY, audience: { scope: 'department', departmentId: dept.COMP! } },
    { author: 'prashant.joshi', label: 'Training & Placement Cell', title: 'TechNova placement drive: register by Friday', body: 'Eligible final-year and third-year Computer/IT students must register in the Events tab before the deadline. Late registrations cannot be accepted by the company.', category: 'event', ago: 3 * DAY, audience: { scope: 'college' } },
    { author: 'neha.kulkarni', label: 'IT Cell', title: 'Campus Wi-Fi maintenance on Sunday', body: 'Wi-Fi in the hostel blocks will be down from 7 to 10 am on Sunday for an upgrade. CampusConnect works on mobile data as usual.', category: 'news', ago: 4 * DAY, audience: { scope: 'college' } },
    { author: 'prof.rohan', label: 'Department of E&TC', title: 'Second-year lab batches revised', body: 'Batch B2 moves to Thursday 2-4 pm from next week. Check the class space for the updated list.', category: 'notice', ago: 5 * DAY, audience: { scope: 'year', year: 2 } },
  ] as const) {
    const when = at(-a.ago);
    await db.col('announcements').insertOne({ _id: uuidv7(), collegeId: college, authorId: u(a.author), authorLabel: a.label, title: a.title, body: a.body, category: a.category, audience: a.audience as never, isPinned: 'pinned' in a ? Boolean(a.pinned) : false, status: 'published', publishedAt: when, expiresAt: null, createdAt: when, updatedAt: when });
  }

  // ---------------------------------------------------------------- opportunities
  const opp = async (row: { by?: string; org: string; title: string; kind: string; mode: 'remote' | 'onsite' | 'hybrid'; location: string; pay?: string; deadline: number; depts?: string[]; minYear?: number; skills?: string[]; description: string; url?: string; status?: 'published' | 'pending' }) => {
    const oid = uuidv7();
    await db.col('opportunities').insertOne({ _id: oid, collegeId: college, postedBy: u(row.by ?? 'prashant.joshi'), orgName: row.org, title: row.title, kind: row.kind, mode: row.mode, location: row.location, payText: row.pay ?? '', deadline: at(row.deadline), eligibleDepartmentIds: row.depts ?? [], minYear: row.minYear ?? 1, skills: row.skills ?? [], description: row.description, applyUrl: row.url ?? null, status: row.status ?? 'published', applicantsCount: 0, createdAt: at(-8 * DAY), updatedAt: at(-8 * DAY) });
    return oid;
  };
  const o1 = await opp({ org: 'TechNova Labs', title: 'Software Engineering Intern', kind: 'internship', mode: 'hybrid', location: 'Pune', pay: '₹25,000 / month', deadline: 12 * DAY, depts: [dept.COMP!, dept.IT!], minYear: 3, skills: ['React', 'Node.js', 'SQL'], description: 'Six-month internship on the payments team. Pre-placement offer for strong performers. Apply in the app; the T&P cell forwards shortlisted profiles.' });
  const o2 = await opp({ org: 'Smart India Hackathon', title: 'SIH 2026 internal selection round', kind: 'hackathon', mode: 'onsite', location: 'CSMSS campus', deadline: 6 * DAY, skills: ['Any'], description: 'Internal selection round for SIH 2026. Teams of six with at least one woman member. Register your team here.', url: 'https://www.sih.gov.in/' });
  await opp({ by: 'karan.mehta', org: 'Razorpay', title: 'Backend engineering mentorship (8 weeks)', kind: 'workshop', mode: 'remote', location: 'Online', deadline: 18 * DAY, minYear: 2, skills: ['Go', 'APIs'], description: 'Weekly one-hour sessions on building reliable APIs: idempotency, retries, queues and observability. Eight seats.' });
  await opp({ org: 'Government of India', title: 'National Scholarship Portal: merit scholarships', kind: 'scholarship', mode: 'remote', location: 'Online', pay: 'Up to ₹50,000 / year', deadline: 25 * DAY, description: 'Central and state scholarships for eligible students. Check eligibility and apply on the official portal before the deadline.', url: 'https://scholarships.gov.in/' });
  await opp({ by: 'sanket.j', org: 'CloudNative Pune meetup', title: 'Volunteers for the December meetup', kind: 'volunteering', mode: 'onsite', location: 'Pune', deadline: 15 * DAY, skills: ['Event management'], description: 'Help run registration and the speaker room. Free entry and a T-shirt.', status: 'pending' });
  const application = async (oppId: string, who: string, stage: 'applied' | 'shortlisted', note?: string) =>
    db.col('applications').insertOne({ _id: uuidv7(), opportunityId: oppId, userId: u(who), stage, note: note ?? null, resumeFileId: null, createdAt: at(-4 * DAY), updatedAt: at(-1 * DAY) });
  await application(o1, 'riya.d', 'shortlisted', 'Interview on Thursday.');
  await application(o2, 'riya.d', 'applied');
  await application(o1, 'sanket.j', 'applied');

  // ---------------------------------------------------------------- shelf: subjects and real notes
  const subject = async (name: string, deptCode: string | null, semester: number | null) => {
    const sid = uuidv7();
    await db.col('subjects').insertOne({ _id: sid, collegeId: college, name, nameLower: name.toLowerCase(), departmentId: deptCode ? dept[deptCode]! : null, semester, createdBy: u('dr.deshpande'), resourcesCount: 0, createdAt: at(-60 * DAY) });
    return { id: sid, name };
  };
  const sub = {
    os: await subject('Operating Systems', 'COMP', 5),
    dbms: await subject('Database Management Systems', 'COMP', 5),
    web: await subject('Web Technology', 'COMP', 5),
    toc: await subject('Theory of Computation', 'COMP', 5),
    m1: await subject('Engineering Mathematics I', null, 1),
    micro: await subject('Microcontrollers', 'ENTC', 3),
    survey: await subject('Surveying', 'CIVIL', 3),
  };
  // Notes are real documents, generated here as PDFs with genuine study content.
  const notesPdf = async (owner: string, title: string, sections: Array<{ heading: string; lines: string[] }>) => {
    const buffer = renderReport({ title, subtitle: 'CampusConnect Shelf · shared under the college’s fair-use policy for study', sections }, 'pdf');
    const f = await storeUpload(deps, { auth: { userId: u(owner), collegeId: college }, purpose: 'resource', filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`, buffer, requestId: 'seed', ipHash: null });
    return f.id;
  };
  const resource = async (row: { by: string; title: string; kind: string; subject: { id: string; name: string }; semester: number; deptCode: string; fileId?: string | null; url?: string; status: 'approved' | 'pending'; tags: string[]; ago: number }) => {
    const rid = uuidv7();
    await db.col('resources').insertOne({ _id: rid, collegeId: college, uploaderId: u(row.by), title: row.title, kind: row.kind, subjectId: row.subject.id, subject: row.subject.name, semester: row.semester, departmentId: dept[row.deptCode]!, fileId: row.fileId ?? null, externalUrl: row.url ?? null, tags: row.tags, status: row.status, reviewerId: row.status === 'approved' ? u('dr.deshpande') : null, reviewNote: null, reviewedAt: row.status === 'approved' ? at(-(row.ago - 1) * DAY) : null, downloadsCount: 0, ratingSum: 0, ratingCount: 0, createdAt: at(-row.ago * DAY), updatedAt: at(-row.ago * DAY), deletedAt: null });
    return rid;
  };
  const osNotes = await notesPdf('vishwajeet.p', 'Operating Systems: Units 1-3 notes', [
    { heading: 'Processes and threads', lines: ['A process is a program in execution: code, data, stack, heap and the CPU state saved in its PCB.', 'Threads of one process share its address space and open files but have their own stack and registers.', 'Context switch: save the running process state in its PCB, load the next one. Pure overhead, so schedulers try to limit it.'] },
    { heading: 'CPU scheduling', lines: ['FCFS: simple, but short jobs wait behind long ones (convoy effect).', 'SJF / SRTF: optimal average waiting time, needs burst-time estimates (exponential averaging).', 'Round Robin: time quantum q; small q means more context switches, large q behaves like FCFS.', 'Priority scheduling can starve low-priority jobs; ageing raises priority over time.', 'Worked example: bursts P1=5, P2=3, P3=8 with RR q=2 give average waiting time 6.0 ms.'] },
    { heading: 'Deadlocks', lines: ['Four necessary conditions: mutual exclusion, hold and wait, no preemption, circular wait.', 'Prevention breaks one condition; avoidance (Banker’s algorithm) keeps the system in a safe state.', 'Banker’s safety check: find a process whose Need <= Available, let it finish, add its Allocation back, repeat.', 'Detection: build a wait-for graph; a cycle means deadlock when every resource has one instance.'] },
  ]);
  const dbmsNotes = await notesPdf('dr.deshpande', 'DBMS: normalisation quick reference', [
    { heading: 'Functional dependencies', lines: ['X -> Y: rows that agree on X agree on Y. Closure X+ is every attribute X determines.', 'A candidate key is a minimal set whose closure is all attributes.'] },
    { heading: 'Normal forms', lines: ['1NF: atomic values, no repeating groups.', '2NF: 1NF and no partial dependency of a non-prime attribute on part of a candidate key.', '3NF: for every X -> A, X is a superkey or A is prime.', 'BCNF: for every non-trivial X -> A, X is a superkey. Lossless, but may not preserve dependencies.'] },
    { heading: 'Exam tips', lines: ['Always list candidate keys first; most mistakes come from missing one.', 'For decomposition questions, check lossless join with the common-attribute test.'] },
  ]);
  const tocNotes = await notesPdf('riya.d', 'Theory of Computation: pumping lemma, step by step', [
    { heading: 'Regular languages', lines: ['If L is regular, there is p such that every w in L with |w| >= p splits as xyz, |xy| <= p, |y| >= 1, and xy^iz is in L for all i >= 0.', 'To prove L is not regular, pick one w (depending on p) and show every allowed split fails for some i.'] },
    { heading: 'Worked example: a^n b^n', lines: ['Choose w = a^p b^p. Because |xy| <= p, y is made only of a’s.', 'Pumping with i = 2 adds a’s but not b’s, so the string leaves the language. Hence a^n b^n is not regular.'] },
  ]);
  const microNotes = await notesPdf('prof.rohan', 'Microcontrollers: 8051 timer and interrupt cheat sheet', [
    { heading: 'Timers', lines: ['TMOD selects the mode for Timer 0/1: mode 1 is 16-bit, mode 2 is 8-bit auto-reload (used for baud rates).', 'At 11.0592 MHz one machine cycle is 1.085 µs; a 50 ms delay in mode 1 needs TH/TL = 4BFDh.'] },
    { heading: 'Interrupts', lines: ['IE enables interrupts (EA must be 1); IP sets priority.', 'Vector addresses: INT0 0003h, T0 000Bh, INT1 0013h, T1 001Bh, serial 0023h.'] },
  ]);
  const surveyNotes = await notesPdf('tejas.more', 'Surveying: levelling field book format', [
    { heading: 'Rise and fall method', lines: ['Columns: station, BS, IS, FS, rise, fall, RL, remarks.', 'Arithmetic check: sum(BS) - sum(FS) = sum(rise) - sum(fall) = last RL - first RL.'] },
  ]);
  const shelf = [
    await resource({ by: 'vishwajeet.p', title: 'Operating Systems Units 1-3 notes', kind: 'notes', subject: sub.os, semester: 5, deptCode: 'COMP', fileId: osNotes, status: 'approved', tags: ['os', 'scheduling', 'deadlock'], ago: 20 }),
    await resource({ by: 'dr.deshpande', title: 'Normalisation quick reference (1NF to BCNF)', kind: 'notes', subject: sub.dbms, semester: 5, deptCode: 'COMP', fileId: dbmsNotes, status: 'approved', tags: ['dbms', 'normalisation'], ago: 18 }),
    await resource({ by: 'riya.d', title: 'Pumping lemma, step by step', kind: 'cheat_sheet', subject: sub.toc, semester: 5, deptCode: 'COMP', fileId: tocNotes, status: 'approved', tags: ['toc'], ago: 9 }),
    await resource({ by: 'prof.rohan', title: '8051 timers and interrupts cheat sheet', kind: 'cheat_sheet', subject: sub.micro, semester: 3, deptCode: 'ENTC', fileId: microNotes, status: 'approved', tags: ['8051'], ago: 12 }),
    await resource({ by: 'riya.d', title: 'MDN Web Docs: JavaScript guide', kind: 'tutorial', subject: sub.web, semester: 5, deptCode: 'COMP', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', status: 'approved', tags: ['javascript'], ago: 15 }),
    await resource({ by: 'tejas.more', title: 'Levelling field book format', kind: 'notes', subject: sub.survey, semester: 3, deptCode: 'CIVIL', fileId: surveyNotes, status: 'pending', tags: ['levelling'], ago: 1 }),
  ];
  for (const [who, i, rating] of [['riya.d', 0, 5], ['sanket.j', 0, 4], ['sneha.p', 1, 5], ['vishwajeet.p', 1, 5], ['sanket.j', 2, 4]] as const) {
    await db.col('resource_ratings').insertOne({ _id: `${shelf[i]}:${u(who)}`, resourceId: shelf[i]!, userId: u(who), rating, createdAt: at(-DAY), updatedAt: at(-DAY) });
  }
  await db.col('resources').updateOne({ _id: shelf[0]! }, { $set: { downloadsCount: 42 } });
  await db.col('resources').updateOne({ _id: shelf[1]! }, { $set: { downloadsCount: 37 } });
  await db.col('resources').updateOne({ _id: shelf[2]! }, { $set: { downloadsCount: 11 } });
  await db.col('saved_items').insertOne({ _id: `${u('riya.d')}:resource:${shelf[1]}`, userId: u('riya.d'), itemType: 'resource', itemId: shelf[1]!, createdAt: at(-DAY) });

  // ---------------------------------------------------------------- lectures (links to real public lectures)
  for (const l of LECTURES) {
    const when = at(-l.ago * DAY);
    await db.col('lectures').insertOne({ _id: uuidv7(), collegeId: college, teacherId: u(l.by), title: l.title, description: l.description, subject: l.subject, semester: l.semester, source: l.source, fileId: null, url: l.url, durationSeconds: l.duration, viewsCount: l.views, chapters: l.chapters, status: l.status, publishedAt: l.status === 'published' ? when : null, createdAt: when, updatedAt: when, deletedAt: null });
  }

  // ---------------------------------------------------------------- hush
  const hq = async (author: string, topic: string, body: string, ago: number) => {
    const qid = uuidv7();
    await db.col('anonymous_authors').insertOne({ _id: `hush_question:${qid}`, contentType: 'hush_question', contentId: qid, userId: u(author), createdAt: at(-ago) });
    await db.col('hush_questions').insertOne({ _id: qid, collegeId: college, authorId: null, isAnonymous: true, topic, body, votesCount: 0, answersCount: 0, acceptedAnswerId: null, status: 'published', createdAt: at(-ago), updatedAt: at(-ago), deletedAt: null });
    return qid;
  };
  const ha = async (questionId: string, author: string, body: string, ago: number) => {
    const aid = uuidv7();
    await db.col('anonymous_authors').insertOne({ _id: `hush_answer:${aid}`, contentType: 'hush_answer', contentId: aid, userId: u(author), createdAt: at(-ago) });
    await db.col('hush_answers').insertOne({ _id: aid, questionId, collegeId: college, authorId: null, isAnonymous: true, body, votesCount: 0, isAccepted: false, status: 'published', createdAt: at(-ago), updatedAt: at(-ago), deletedAt: null });
    return aid;
  };
  const h1 = await hq('sneha.p', 'academics', 'Is it normal to fail the first internal test? I studied but blanked out completely.', 2 * DAY);
  const h2 = await hq('sanket.j', 'placements', 'How many DSA problems did seniors solve before getting placed at product companies?', 4 * DAY);
  await hq('omkar.b', 'hostel', 'Does the hostel allow induction cooktops in rooms, or will I get fined?', 6 * DAY);
  await hq('tejas.more', 'mental_health', 'How do you deal with homesickness in the first few months? Weekends are the hardest.', 7 * DAY);
  const a1 = await ha(h1, 'pooja.kale', 'Very normal. Talk to the subject teacher; most give tips or a retest, and internals are a small part of the total.', 2 * DAY - 4 * HOUR);
  await ha(h2, 'riya.d', 'Around 300-400 good problems, but patterns matter more than the count. Revise the ones you got wrong.', 3 * DAY);
  await ha(h2, 'karan.mehta', 'Interviewers care how you think out loud. Practise explaining your approach before coding.', 3 * DAY - 6 * HOUR);
  await db.col('hush_answers').updateOne({ _id: a1 }, { $set: { isAccepted: true } });
  await db.col('hush_questions').updateOne({ _id: h1 }, { $set: { acceptedAnswerId: a1 } });
  for (const voter of ['riya.d', 'pooja.kale', 'aditi.s']) await vote(voter, 'hush_question', h1);
  for (const voter of ['sneha.p', 'riya.d']) await vote(voter, 'hush_answer', a1);

  // ---------------------------------------------------------------- lost & found, marketplace
  const lostItem = async (row: { by: string; kind: 'lost' | 'found'; title: string; category: 'electronics' | 'keys' | 'books' | 'id_card' | 'clothing' | 'bag' | 'other'; location: string; ago: number; description?: string; question?: string; photo?: keyof typeof PHOTOS; status?: 'open' | 'claim_pending' }) => {
    const lid = uuidv7();
    const image = row.photo ? await photo(row.photo, 'lost_found', row.by) : null;
    await db.col('lost_found_items').insertOne({ _id: lid, collegeId: college, reporterId: u(row.by), kind: row.kind, title: row.title, category: row.category, location: row.location, occurredAt: at(-row.ago), description: row.description ?? '', verificationQuestion: row.question ?? null, imageFileId: image, status: row.status ?? 'open', createdAt: at(-row.ago), updatedAt: at(-row.ago), deletedAt: null });
    return lid;
  };
  const lf1 = await lostItem({ by: 'sanket.j', kind: 'found', title: 'Black earbuds in a charging case', category: 'electronics', location: 'Canteen, near the window seats', ago: 1 * DAY, description: 'Found on the table after lunch. Handed nothing to the office yet.', question: 'What sticker is on the case?', photo: 'lost-earbuds', status: 'claim_pending' });
  await lostItem({ by: 'aditi.s', kind: 'lost', title: 'Casio fx-991ES calculator', category: 'electronics', location: 'Exam hall 2', ago: 2 * DAY, description: 'My name is scratched on the back.', photo: 'lost-calculator' });
  await lostItem({ by: 'omkar.b', kind: 'lost', title: 'Hostel room key with a red tag', category: 'keys', location: 'Between Block B and the gym', ago: 3 * DAY });
  await lostItem({ by: 'swati.g', kind: 'found', title: 'College ID card (second year, Civil)', category: 'id_card', location: 'Library issue desk', ago: 4 * HOUR, question: 'What is the name on the card?' });
  await db.col('lost_found_claims').insertOne({ _id: uuidv7(), itemId: lf1, claimantId: u('sneha.p'), answer: 'A small yellow smiley sticker near the hinge.', status: 'pending', decidedAt: null, createdAt: at(-10 * HOUR) });

  const listing = async (row: { by: string; title: string; mode: 'sell' | 'borrow' | 'exchange' | 'free'; category: string; price: number | null; condition: 'new' | 'like_new' | 'good' | 'fair'; location: string; description: string; returnBy?: number; photo?: keyof typeof PHOTOS; ago: number }) => {
    const image = row.photo ? await photo(row.photo, 'listing', row.by) : null;
    await db.col('listings').insertOne({ _id: uuidv7(), collegeId: college, sellerId: u(row.by), title: row.title, mode: row.mode, category: row.category, pricePaise: row.price, condition: row.condition, location: row.location, description: row.description, returnBy: row.returnBy ? at(row.returnBy).toISOString().slice(0, 10) : null, imageIds: image ? [image] : [], status: 'available', createdAt: at(-row.ago), updatedAt: at(-row.ago), deletedAt: null });
  };
  await listing({ by: 'omkar.b', title: 'Engineering drawing kit (complete)', mode: 'sell', category: 'equipment', price: 45_000, condition: 'good', location: 'Hostel Block B', description: 'Mini-drafter, set squares, compass and two sheet holders. Used for one semester.', photo: 'listing-drawing-kit', ago: 2 * DAY });
  await listing({ by: 'vishwajeet.p', title: 'Operating System Concepts (Galvin), 10th edition', mode: 'sell', category: 'books', price: 35_000, condition: 'like_new', location: 'Library entrance', description: 'No highlighting. Includes the online access card (unused).', photo: 'listing-book', ago: 3 * DAY });
  await listing({ by: 'sanket.j', title: 'Arduino Uno starter kit', mode: 'borrow', category: 'electronics', price: null, condition: 'good', location: 'IT department', description: 'Board, breadboard, jumper wires and sensors. Borrow for your mini project; return in two weeks.', returnBy: 14 * DAY, photo: 'listing-arduino', ago: 4 * DAY });
  await listing({ by: 'aditi.s', title: 'Lab coat (size M)', mode: 'free', category: 'clothing', price: null, condition: 'fair', location: 'ENTC department', description: 'Clean, a small ink mark on one sleeve. Free to whoever needs it.', ago: 5 * DAY });
  await listing({ by: 'tejas.more', title: 'Hero Sprint bicycle', mode: 'sell', category: 'cycles', price: 220_000, condition: 'good', location: 'Main gate parking', description: 'Single speed, new tyres last month. Great for the hostel-to-campus ride.', photo: 'listing-cycle', ago: 6 * DAY });

  // ---------------------------------------------------------------- notifications
  const note = async (who: string, n: { kind: string; title: string; body?: string; link: string | null; actor?: string | null; ago: number; read?: boolean }) =>
    db.col('notifications').insertOne({ _id: uuidv7(), userId: u(who), kind: n.kind, title: n.title, body: n.body ?? '', link: n.link, actorId: n.actor ? u(n.actor) : null, entityType: null, entityId: null, readAt: n.read ? at(-n.ago + HOUR) : null, createdAt: at(-n.ago) });
  await note('riya.d', { kind: 'message', title: 'Pooja Kale sent you a message', body: 'Also, could you help at the registration desk for 30 minutes?', link: `/chats/${dm}`, actor: 'pooja.kale', ago: 1 * HOUR });
  await note('riya.d', { kind: 'application', title: 'You were shortlisted: Software Engineering Intern', body: 'TechNova Labs shortlisted your application.', link: `/opportunities/${o1}`, ago: 6 * HOUR });
  await note('riya.d', { kind: 'like', title: 'Pooja Kale liked your post', body: 'Finally finished rebuilding my portfolio…', link: `/post/${post[2]}`, actor: 'pooja.kale', ago: 8 * HOUR });
  await note('riya.d', { kind: 'event', title: 'Cloud Study Jam starts in 3 days', body: 'Computer Lab 2', link: `/events/${e1}`, ago: 20 * HOUR });
  await note('riya.d', { kind: 'follow', title: 'Sneha Pawar started following you', link: '/profile/sneha.p', actor: 'sneha.p', ago: 2 * DAY, read: true });
  await note('sanket.j', { kind: 'message', title: 'Karan Mehta sent you a message', body: 'Sure. Send it as a PDF and tell me which role you are applying for.', link: `/chats/${dm3}`, actor: 'karan.mehta', ago: 2 * DAY - 3 * HOUR });
  await note('sneha.p', { kind: 'reply', title: 'Someone answered your Hush question', body: 'Is it normal to fail the first internal test?', link: `/hush/${h1}`, ago: 2 * DAY - 4 * HOUR });

  // ---------------------------------------------------------------- trust & safety, admin queues
  const report = async (who: string, targetType: string, targetId: string, reason: string, details: string, priority: number) =>
    db.col('reports').insertOne({ _id: uuidv7(), collegeId: college, reporterId: u(who), targetType, targetId, reason, details, status: 'open', isOpen: true, priority, resolutionNote: null, resolvedBy: null, resolvedAt: null, createdAt: at(-5 * HOUR), updatedAt: at(-5 * HOUR) });
  await report('riya.d', 'post', post[7]!, 'spam', 'The same recruitment post was shared in five spaces today.', 4);
  await report('aditi.s', 'hush_question', h2, 'other', 'Not sure this belongs in Hush.', 4);
  await db.col('verification_requests').insertOne({ _id: uuidv7(), collegeId: college, userId: u('sneha.p'), kind: 'student_id', status: 'pending', fileId: null, note: 'I will show my ID card at the office if needed.', reviewerId: null, reviewerNote: null, reviewedAt: null, createdAt: at(-1 * DAY), updatedAt: at(-1 * DAY) });
  await db.col('contact_messages').insertOne({ _id: uuidv7(), userId: null, name: 'Sunita Pawar', email: 'sunita.pawar@gmail.com', topic: 'support', subject: 'Cannot find the exam timetable', message: 'Where can parents see the mid-semester timetable for first year students?', consentProcessing: true, utm: null, ipHash: null, status: 'new', createdAt: at(-1 * DAY), updatedAt: at(-1 * DAY) });

  // ---------------------------------------------------------------- surveys & feedback
  const surveyId = uuidv7();
  const appQuestions: SurveyQuestion[] = [
    { id: 'q1', type: 'rating', prompt: 'How would you rate CampusConnect overall?', options: [], required: true },
    { id: 'q2', type: 'multiple', prompt: 'Which sections do you use most?', options: ['Home feed', 'Chats', 'Shelf', 'Events', 'Opportunities', 'Hush'], required: true },
    { id: 'q3', type: 'scale', prompt: 'How likely are you to recommend it to a friend? (0-10)', options: [], required: true },
    { id: 'q4', type: 'text', prompt: 'What one thing should we improve next?', options: [], required: false },
  ];
  await db.col('surveys').insertOne({ _id: surveyId, collegeId: college, title: 'CampusConnect first-month check-in', description: 'Four quick questions about the app. Takes under a minute and it shapes what we build next.', category: 'app', compulsory: false, anonymous: true, audienceRoles: [], questions: appQuestions, status: 'published', publishedAt: at(-6 * DAY), closesAt: at(20 * DAY), createdBy: u('neha.kulkarni'), responsesCount: 0, createdAt: at(-6 * DAY), updatedAt: at(-6 * DAY) });
  for (const [who, answers] of [
    ['riya.d', [{ questionId: 'q1', value: 5 }, { questionId: 'q2', value: ['Home feed', 'Chats', 'Shelf'] }, { questionId: 'q3', value: 9 }, { questionId: 'q4', value: 'Offline mode for the Shelf would be great.' }]],
    ['sanket.j', [{ questionId: 'q1', value: 4 }, { questionId: 'q2', value: ['Chats', 'Opportunities'] }, { questionId: 'q3', value: 8 }]],
    ['aditi.s', [{ questionId: 'q1', value: 4 }, { questionId: 'q2', value: ['Events', 'Home feed'] }, { questionId: 'q3', value: 7 }, { questionId: 'q4', value: 'Let clubs post event photos after the event.' }]],
  ] as const) {
    await db.col('survey_responses').insertOne({ _id: `${surveyId}:${u(who)}`, surveyId, collegeId: college, userId: u(who), answers: answers.map((a) => ({ questionId: a.questionId, value: Array.isArray(a.value) ? [...a.value] : a.value })) as never, submittedAt: at(-3 * DAY) });
  }
  await db.col('surveys').insertOne({
    _id: uuidv7(), collegeId: college, title: 'Mess and canteen feedback (hostel residents)', description: 'The mess committee uses this to decide next month’s menu changes.', category: 'campus', compulsory: false, anonymous: true, audienceRoles: ['student'],
    questions: [
      { id: 'food', type: 'rating', prompt: 'Rate the food quality this month', options: [], required: true },
      { id: 'meal', type: 'single', prompt: 'Which meal needs the most improvement?', options: ['Breakfast', 'Lunch', 'Snacks', 'Dinner'], required: true },
      { id: 'idea', type: 'text', prompt: 'Any dish you would like added?', options: [], required: false },
    ],
    status: 'draft', publishedAt: null, closesAt: null, createdBy: u('prashant.joshi'), responsesCount: 0, createdAt: at(-1 * DAY), updatedAt: at(-1 * DAY),
  });
  for (const f of [
    { who: 'riya.d', category: 'idea', rating: 5, message: 'Please add a dark mode schedule that follows sunset.', page: '/settings', ago: 3 * DAY, status: 'planned' },
    { who: 'sanket.j', category: 'bug', rating: 3, message: 'Chat list sometimes shows the old last message after I come back from another tab.', page: '/chats', ago: 2 * DAY, status: 'reviewed' },
    { who: 'sneha.p', category: 'praise', rating: 5, message: 'Hush helped me a lot in my first week. Thank you!', page: '/hush', ago: 1 * DAY, status: 'new' },
    { who: 'tejas.more', category: 'question', rating: null, message: 'Can civil subjects be added to the Shelf by students?', page: '/resources', ago: 10 * HOUR, status: 'new' },
  ] as const) {
    await db.col('feedback').insertOne({ _id: uuidv7(), collegeId: college, userId: u(f.who), category: f.category, rating: f.rating, message: f.message, page: f.page, appVersion: 'web', status: f.status, createdAt: at(-f.ago), updatedAt: at(-f.ago) });
  }

  // ---------------------------------------------------------------- platform settings
  for (const [key, def] of Object.entries(FLAG_DEFAULTS)) {
    await db.col('feature_flags').insertOne({ _id: key, description: def.description, enabled: def.enabled, rolloutPercent: 100, allowedRoles: [], allowedCollegeIds: [], updatedBy: null, createdAt: created, updatedAt: created });
  }
  await db.col('app_settings').insertOne({ _id: 'legal.versions', value: { terms: TERMS_VERSION, privacy: TERMS_VERSION, cookies: TERMS_VERSION }, updatedBy: null, updatedAt: created });

  await recount(deps);
  const photos = await db.col('files').countDocuments({ purpose: { $in: ['avatar', 'post', 'event', 'listing', 'lost_found'] } });
  console.log(`seed: ${people.length} accounts, content in every module, ${photos} photo${photos === 1 ? '' : 's'}${photos ? '' : ' (add photos to apps/api/seed-assets/photos to include them)'}`);
  console.log('seed: sign-in details are documented at the top of scripts/seed.ts');
}

/** Lectures: links to real, public lectures (checked to exist when this seed was written). */
const LECTURES: Array<{ by: string; title: string; description: string; subject: string; semester: number; source: 'youtube' | 'link'; url: string; duration: number | null; views: number; chapters: Array<{ at: number; title: string }>; status: 'published' | 'pending'; ago: number }> = [
  { by: 'dr.deshpande', title: 'Algorithmic thinking and peak finding (MIT 6.006)', description: 'A classic first lecture on analysing algorithms. Watch before our complexity unit.', subject: 'Design and Analysis of Algorithms', semester: 5, source: 'youtube', url: 'https://www.youtube.com/watch?v=HtSuA80QTyo', duration: null, views: 58, chapters: [], status: 'published', ago: 14 },
  { by: 'dr.deshpande', title: 'SQL from scratch: full beginner course', description: 'Covers SELECT, joins, grouping and constraints. Do the exercises alongside the DBMS lab.', subject: 'Database Management Systems', semester: 5, source: 'youtube', url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY', duration: null, views: 41, chapters: [], status: 'published', ago: 10 },
  { by: 'dr.deshpande', title: 'Operating Systems (Crash Course Computer Science #18)', description: 'A short visual overview of what an operating system does, good for revision.', subject: 'Operating Systems', semester: 5, source: 'youtube', url: 'https://www.youtube.com/watch?v=26QPDBe-NB8', duration: null, views: 73, chapters: [], status: 'published', ago: 7 },
  { by: 'prof.rohan', title: 'MIT OpenCourseWare: Introduction to Algorithms', description: 'Full course page with lecture notes and problem sets.', subject: 'Design and Analysis of Algorithms', semester: 5, source: 'link', url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/', duration: null, views: 12, chapters: [], status: 'pending', ago: 1 },
];

/** Recomputes every stored counter from the data, so seeded numbers match what the app counts. */
export async function recount(deps: Deps): Promise<void> {
  const db = deps.db;
  const countBy = async (col: string, field: string, match: Record<string, unknown> = {}) =>
    new Map((await db.raw(col).aggregate<{ _id: string; n: number }>([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]).toArray()).map((r) => [r._id, r.n]));

  const [followers, following, posts] = await Promise.all([countBy('follows', 'followeeId'), countBy('follows', 'followerId'), countBy('posts', 'authorId', { deletedAt: null, isAnonymous: false })]);
  for (const u of await db.col('users').find({}, { projection: { _id: 1 } }).toArray()) {
    await db.col('users').updateOne({ _id: u._id }, { $set: { 'profile.followersCount': followers.get(u._id) ?? 0, 'profile.followingCount': following.get(u._id) ?? 0, 'profile.postsCount': posts.get(u._id) ?? 0 } });
  }
  const members = await countBy('space_members', 'spaceId', { status: 'active' });
  for (const s of await db.col('spaces').find({}, { projection: { _id: 1 } }).toArray()) await db.col('spaces').updateOne({ _id: s._id }, { $set: { membersCount: members.get(s._id) ?? 0 } });

  const [likes, comments, saves] = await Promise.all([countBy('post_likes', 'postId'), countBy('comments', 'postId', { deletedAt: null }), countBy('saved_items', 'itemId', { itemType: 'post' })]);
  const pollVotes = await db.col('poll_votes').aggregate<{ _id: { p: string; o: string }; n: number }>([{ $group: { _id: { p: '$postId', o: '$optionId' }, n: { $sum: 1 } } }]).toArray();
  for (const p of await db.col('posts').find({}).toArray()) {
    const poll = p.poll ? { options: p.poll.options.map((o) => ({ ...o, votes: pollVotes.find((v) => v._id.p === p._id && v._id.o === o.id)?.n ?? 0 })), totalVotes: pollVotes.filter((v) => v._id.p === p._id).reduce((a, v) => a + v.n, 0) } : null;
    await db.col('posts').updateOne({ _id: p._id }, { $set: { likesCount: likes.get(p._id) ?? 0, commentsCount: comments.get(p._id) ?? 0, savesCount: saves.get(p._id) ?? 0, poll } });
  }

  const scores = new Map((await db.col('votes').aggregate<{ _id: string; n: number }>([{ $group: { _id: '$targetId', n: { $sum: '$value' } } }]).toArray()).map((r) => [r._id, r.n]));
  const replies = await countBy('discussion_replies', 'discussionId', { deletedAt: null });
  for (const d of await db.col('discussions').find({}, { projection: { _id: 1 } }).toArray()) {
    const last = await db.col('discussion_replies').find({ discussionId: d._id }).sort({ createdAt: -1 }).limit(1).next();
    await db.col('discussions').updateOne({ _id: d._id }, { $set: { score: scores.get(d._id) ?? 0, repliesCount: replies.get(d._id) ?? 0, ...(last ? { lastActivityAt: last.createdAt } : {}) } });
  }
  for (const r of await db.col('discussion_replies').find({}, { projection: { _id: 1 } }).toArray()) await db.col('discussion_replies').updateOne({ _id: r._id }, { $set: { score: scores.get(r._id) ?? 0 } });
  const answers = await countBy('hush_answers', 'questionId', { deletedAt: null });
  for (const q of await db.col('hush_questions').find({}, { projection: { _id: 1 } }).toArray()) await db.col('hush_questions').updateOne({ _id: q._id }, { $set: { votesCount: scores.get(q._id) ?? 0, answersCount: answers.get(q._id) ?? 0 } });
  for (const a of await db.col('hush_answers').find({}, { projection: { _id: 1 } }).toArray()) await db.col('hush_answers').updateOne({ _id: a._id }, { $set: { votesCount: scores.get(a._id) ?? 0 } });

  const [going, interested] = await Promise.all([countBy('event_rsvps', 'eventId', { status: 'going' }), countBy('event_rsvps', 'eventId', { status: 'interested' })]);
  for (const e of await db.col('events').find({}, { projection: { _id: 1 } }).toArray()) await db.col('events').updateOne({ _id: e._id }, { $set: { goingCount: going.get(e._id) ?? 0, interestedCount: interested.get(e._id) ?? 0 } });
  const applicants = await countBy('applications', 'opportunityId', { stage: { $ne: 'withdrawn' } });
  for (const o of await db.col('opportunities').find({}, { projection: { _id: 1 } }).toArray()) await db.col('opportunities').updateOne({ _id: o._id }, { $set: { applicantsCount: applicants.get(o._id) ?? 0 } });

  const ratings = new Map((await db.col('resource_ratings').aggregate<{ _id: string; sum: number; n: number }>([{ $group: { _id: '$resourceId', sum: { $sum: '$rating' }, n: { $sum: 1 } } }]).toArray()).map((r) => [r._id, r]));
  for (const r of await db.col('resources').find({}, { projection: { _id: 1 } }).toArray()) await db.col('resources').updateOne({ _id: r._id }, { $set: { ratingSum: ratings.get(r._id)?.sum ?? 0, ratingCount: ratings.get(r._id)?.n ?? 0 } });
  const perSubject = await countBy('resources', 'subjectId', { status: 'approved', deletedAt: null });
  for (const s of await db.col('subjects').find({}, { projection: { _id: 1 } }).toArray()) await db.col('subjects').updateOne({ _id: s._id }, { $set: { resourcesCount: perSubject.get(s._id) ?? 0 } });

  const lastMessages = await db.col('messages').aggregate<{ _id: string; at: Date }>([{ $group: { _id: '$chatId', at: { $max: '$createdAt' } } }]).toArray();
  for (const m of lastMessages) await db.col('chats').updateOne({ _id: m._id }, { $set: { lastMessageAt: m.at } });
  const responses = await countBy('survey_responses', 'surveyId');
  for (const s of await db.col('surveys').find({}, { projection: { _id: 1 } }).toArray()) await db.col('surveys').updateOne({ _id: s._id }, { $set: { responsesCount: responses.get(s._id) ?? 0 } });
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed.ts')) {
  loadEnvFile();
  seed(parseConfig()).catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
