import type { Announcement, Notification } from '@/lib/types';
import { daysAgo, hoursAgo, istAt } from '@/lib/time';

export interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  availability: '24x7' | 'Office hours';
  kind: 'Security' | 'Medical' | 'Safety' | 'Counselling' | 'Trusted';
}

export const emergencyContacts: EmergencyContact[] = [
  { id: 'em-security', name: 'Campus security control room', role: 'Main gate & patrol', phone: '+91 00000 00101', availability: '24x7', kind: 'Security' },
  { id: 'em-ambulance', name: 'Campus ambulance', role: 'Medical emergency', phone: '+91 00000 00108', availability: '24x7', kind: 'Medical' },
  { id: 'em-clinic', name: 'Health centre', role: 'First aid & doctor on duty', phone: '+91 00000 00112', availability: 'Office hours', kind: 'Medical' },
  { id: 'em-women', name: 'Women’s safety desk', role: 'Harassment & safety concerns', phone: '+91 00000 00119', availability: '24x7', kind: 'Safety' },
  { id: 'em-counsel', name: 'Student counsellor', role: 'Confidential support', phone: '+91 00000 00121', availability: 'Office hours', kind: 'Counselling' },
  { id: 'em-hostel-warden', name: 'Hostel warden (night)', role: 'Hostel emergencies after 9 PM', phone: '+91 00000 00127', availability: '24x7', kind: 'Security' },
];

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: 'College news' | 'Competition results' | 'Club announcements' | 'Achievements' | 'Important notices' | 'Event announcements' | 'Local opportunities' | 'Online sessions';
  source: string;
  at: string;
  featured?: boolean;
}

export const news: NewsItem[] = [
  { id: 'n-1', title: 'Srujan Fest 2026 dates confirmed: 23–25 October', summary: 'Three days of cultural events, a battle of bands and the first-ever robo-soccer final. Registrations for participants open Monday.', category: 'Event announcements', source: 'Student Council', at: hoursAgo(4), featured: true },
  { id: 'n-2', title: 'Team from our college wins inter-college paper presentation', summary: 'Congrats to Tanvi Mane and Harsh Wagh for winning first place at the regional IEEE student showcase.', category: 'Competition results', source: 'IT & CE Departments', at: daysAgo(1) },
  { id: 'n-3', title: 'Robotics Club enters national robo-soccer qualifier', summary: 'Four students will represent the college in the national qualifier next month.', category: 'Club announcements', source: 'Robotics Club', at: daysAgo(1) },
  { id: 'n-4', title: 'Library extends exam-week hours', summary: 'Open until 10 PM from 20 October to 5 November. Digital library access is unchanged.', category: 'Important notices', source: 'Library', at: daysAgo(2) },
  { id: 'n-5', title: 'Internal assessment marks published for Sem 6', summary: 'Check your dashboard under Academics → Results. Re-evaluation requests close on 22 October.', category: 'College news', source: 'Examination cell', at: daysAgo(2) },
  { id: 'n-6', title: 'Volunteer badges open for blood-donation camp', summary: 'Volunteers earn a contribution badge and hours that count towards the sustainability club award.', category: 'Achievements', source: 'NSS Unit', at: daysAgo(3) },
  { id: 'n-7', title: 'Online session: Resume review with alumni', summary: 'Thursday 6 PM, live on campus portal. Bring your resume PDF for a quick critique.', category: 'Online sessions', source: 'Placement Cell', at: daysAgo(3) },
  { id: 'n-8', title: 'Summer internship openings in Pune startups', summary: 'Five startups posted paid roles for Dec–Jan. Apply via Opportunities.', category: 'Local opportunities', source: 'E-Cell', at: daysAgo(4) },
];

export const announcements: Announcement[] = [
  { id: 'an-1', title: 'DBMS viva schedule released', body: 'Division A viva on Monday 10:00 in Lab 3. Division B on Monday 14:00 in Lab 4. Bring your practical file.', author: 'Prof. Anita Kulkarni', at: hoursAgo(5), audience: 'Computer Engineering · Year 3', pinned: true, category: 'Notice' },
  { id: 'an-2', title: 'Fee deadline extended to 31 October', body: 'Late-fee applies from 1 November. Pay through the fee portal under Important links.', author: 'Accounts Office', at: daysAgo(1), audience: 'All students', pinned: true, category: 'Important' },
  { id: 'an-3', title: 'Campus Wi-Fi maintenance on Sunday', body: 'Expect short outages between 1 AM and 4 AM on Sunday in Hostel B and Block C.', author: 'IT Services', at: daysAgo(1), audience: 'All students', pinned: false, category: 'Notice' },
  { id: 'an-4', title: 'Placement drive: Thoughtworks (Pune)', body: 'Eligibility CGPA 6.5+, no active backlogs. Shortlist published on the Placement Cell portal.', author: 'Placement Cell', at: daysAgo(2), audience: 'Eligible students', pinned: false, category: 'Event' },
  { id: 'an-5', title: 'Semester 6 results — release date', body: 'End-semester results will be published on 3 November.', author: 'Examination cell', at: daysAgo(3), audience: 'All students', pinned: false, category: 'Results' },
];

export const notifications: Notification[] = [
  { id: 'nt-1', kind: 'message', title: 'Pooja Kulkarni sent you a voice note', body: 'About the 24-hour hackathon team', at: hoursAgo(0.4), href: '/chats/chat-pooja' },
  { id: 'nt-2', kind: 'deadline', title: 'Frontend Intern deadline in 2 days', body: 'Thoughtworks Pune · submit your resume before midnight', at: hoursAgo(1), href: '/opportunities/op-frontend-intern' },
  { id: 'nt-3', kind: 'event', title: 'Hackathon registration closes tomorrow', body: '24-Hour Web3 & AI Hackathon', at: hoursAgo(2), href: '/events/ev-hackathon' },
  { id: 'nt-4', kind: 'roommate', title: 'Kunal Sawant accepted your roommate request', body: 'Kailash Nagar · budget ₹4,500 match', at: hoursAgo(3), href: '/housing?tab=roommates' },
  { id: 'nt-5', kind: 'marketplace', title: 'New reply on “Dell Inspiron 14”', body: 'Tanvi asked about the battery health', at: hoursAgo(6), href: '/marketplace/mk-laptop' },
  { id: 'nt-6', kind: 'community', title: '12 new posts in GDSC Campus Chapter', body: 'Hackathon teammates are looking for members', at: hoursAgo(7), href: '/spaces/gdsc' },
  { id: 'nt-7', kind: 'travel', title: 'Shirdi trip: seat 5 of 6 confirmed', body: 'Expense split is ready to review', at: daysAgo(1), href: '/travel/trip-shirdi' },
  { id: 'nt-8', kind: 'announcement', title: 'DBMS viva schedule released', body: 'Division A and B slots are pinned', at: daysAgo(1), href: '/news' },
  { id: 'nt-9', kind: 'opportunity', title: 'New internship posted for your branch', body: 'Frontend Engineering Intern · Thoughtworks', at: daysAgo(1), href: '/opportunities/op-frontend-intern' },
  { id: 'nt-10', kind: 'system', title: 'Your student ID verification is approved', body: 'You now have a verified student badge', at: daysAgo(4), href: '/verify' },
];

export interface HelpPost {
  id: string;
  kind: 'Notes request' | 'Project help' | 'Peer assistance' | 'Local recommendation' | 'Travel question' | 'PPT/design help' | 'Borrow request';
  title: string;
  authorId: string;
  answers: number;
  solved: boolean;
  urgent: boolean;
  at: string;
}

export const helpPosts: HelpPost[] = [
  { id: 'hp-7', kind: 'Notes request', title: 'Looking for Compiler Design Unit 1 notes', authorId: 'me', answers: 1, solved: false, urgent: false, at: hoursAgo(6) },
  { id: 'hp-1', kind: 'Notes request', title: 'Need Unit 2 notes for Compiler Design (urgent)', authorId: 'p-sanket', answers: 3, solved: false, urgent: true, at: hoursAgo(2) },
  { id: 'hp-2', kind: 'Project help', title: 'ESP32 MQTT client keeps disconnecting', authorId: 'p-sneha', answers: 5, solved: true, urgent: false, at: daysAgo(1) },
  { id: 'hp-3', kind: 'PPT/design help', title: 'Looking for someone to polish a 10-slide seminar deck', authorId: 'p-shruti', answers: 2, solved: false, urgent: false, at: daysAgo(1) },
  { id: 'hp-4', kind: 'Local recommendation', title: 'Best cheap PG near Kailash Nagar with mess?', authorId: 'p-neha', answers: 7, solved: false, urgent: false, at: daysAgo(2) },
  { id: 'hp-5', kind: 'Travel question', title: 'Is the 6 AM Shirdi train still running on Sundays?', authorId: 'p-kunal', answers: 4, solved: true, urgent: false, at: daysAgo(3) },
  { id: 'hp-6', kind: 'Borrow request', title: 'Borrowing a multimeter for lab practicals this week', authorId: 'p-aryan', answers: 1, solved: false, urgent: false, at: daysAgo(3) },
];

export interface Survey {
  id: string;
  title: string;
  type: 'College' | 'Club' | 'Event' | 'Course' | 'Facility';
  responses: number;
  target: number;
  questions: number;
  deadline: string;
  anonymous: boolean;
}

export const surveys: Survey[] = [
  { id: 'sv-library', title: 'Library hours and seating feedback', type: 'Facility', responses: 412, target: 900, questions: 6, deadline: istAt(6, 23, 59), anonymous: true },
  { id: 'sv-dbms', title: 'DBMS course feedback (Sem 6)', type: 'Course', responses: 88, target: 110, questions: 10, deadline: istAt(4, 23, 59), anonymous: true },
  { id: 'sv-hackathon', title: 'Hackathon 2026 — how did we do?', type: 'Event', responses: 54, target: 120, questions: 5, deadline: istAt(8, 23, 59), anonymous: false },
  { id: 'sv-robotics', title: 'Robotics Club: what should we build next?', type: 'Club', responses: 31, target: 134, questions: 4, deadline: istAt(10, 23, 59), anonymous: false },
  { id: 'sv-canteen', title: 'Canteen menu survey (weekly)', type: 'Facility', responses: 690, target: 1200, questions: 3, deadline: istAt(2, 23, 59), anonymous: true },
];

export interface NetworkItem {
  id: string;
  title: string;
  detail: string;
  date: string;
  tag: string;
  seed: string;
}

export const interCollege: NetworkItem[] = [
  { id: 'ic-1', title: 'Inter-college hackathon: Pune Build Week', detail: '9 colleges · team of 3 · ₹75,000 pool', date: istAt(20, 9), tag: 'Hackathon', seed: 'ic-1' },
  { id: 'ic-2', title: 'Robo-soccer regional qualifier', detail: 'Hosted at Sinhgad · 12 teams', date: istAt(11, 9), tag: 'Competition', seed: 'ic-2' },
  { id: 'ic-3', title: 'Shared opportunity: UX internship (partner college)', detail: 'Posted by Symbiosis Design Club · remote', date: istAt(2, 23, 59), tag: 'Opportunity', seed: 'ic-3' },
  { id: 'ic-4', title: 'College-to-college network: Maharashtra Engineering Clubs', detail: '34 clubs · shared events calendar', date: istAt(0, 10), tag: 'Community', seed: 'ic-4' },
];

export const cityNetwork: NetworkItem[] = [
  { id: 'cn-1', title: 'Students in Pune: Sunday cricket meet', detail: 'Open to all colleges · Balewadi ground', date: istAt(4, 7), tag: 'Meetup', seed: 'cn-1' },
  { id: 'cn-2', title: 'Pune → Goa bus group (Oct 17)', detail: '7 of 12 seats filled · split bus fare', date: istAt(3, 20), tag: 'Travel group', seed: 'cn-2' },
  { id: 'cn-3', title: 'Cross-college coffee & code', detail: 'Pair programming · three colleges', date: istAt(6, 16), tag: 'Networking', seed: 'cn-3' },
];
