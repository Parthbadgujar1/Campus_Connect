import { daysAgo, hoursAgo } from '@/lib/time';

// Admin platform (module 56), moderation (55) and AI moderation (59).

export const adminStats = {
  students: 3420,
  verified: 2980,
  postsToday: 412,
  activeEvents: 9,
  openReports: 23,
  aiFlagsToday: 14,
};

export const verificationQueue = [
  { id: 'vq-1', personId: 'p-neha', method: 'College ID photo', submittedAt: hoursAgo(3), status: 'Pending' as const },
  { id: 'vq-2', personId: 'p-kunal', method: 'College email + ID', submittedAt: hoursAgo(9), status: 'Pending' as const },
  { id: 'vq-3', personId: 'p-sanket', method: 'Re-verification after branch change', submittedAt: daysAgo(1), status: 'Pending' as const },
  { id: 'vq-4', personId: 'p-sneha', method: 'College email', submittedAt: daysAgo(2), status: 'Pending' as const },
];

export const reportQueue = [
  { id: 'rp-1', target: 'Post', preview: '“Anyone selling a fake ID card?”', reason: 'Scam / fraud', reporter: 'Anonymous reporter', count: 4, status: 'Open' as const, at: hoursAgo(2) },
  { id: 'rp-2', target: 'Marketplace listing', preview: 'Dell laptop — ₹9,000 (no photos)', reason: 'Fake listing', reporter: 'Diya Rane', count: 2, status: 'Reviewing' as const, at: hoursAgo(5) },
  { id: 'rp-3', target: 'Room listing', preview: 'Single room, verification pending', reason: 'Unverified owner', reporter: 'Harsh Wagh', count: 2, status: 'Open' as const, at: daysAgo(1) },
  { id: 'rp-4', target: 'Anonymous comment', preview: 'Abusive comment on DBMS thread', reason: 'Harassment', reporter: 'Anonymous reporter', count: 6, status: 'Open' as const, at: hoursAgo(1) },
];

export const aiFlags = [
  { id: 'ai-1', type: 'Spam' as const, confidence: 96, preview: 'Repeated “earn ₹5000 daily” links in 9 posts', action: 'Auto-hidden', at: hoursAgo(1) },
  { id: 'ai-2', type: 'Duplicate post' as const, confidence: 88, preview: 'Same hackathon announcement posted 3 times in an hour', action: 'Merged', at: hoursAgo(3) },
  { id: 'ai-3', type: 'Scam listing' as const, confidence: 74, preview: 'Brand-new account listing iPhone at 30% of market price', action: 'Needs review', at: hoursAgo(4) },
  { id: 'ai-4', type: 'Suspicious account' as const, confidence: 67, preview: 'Account created today, messaged 40 students', action: 'Needs review', at: hoursAgo(6) },
  { id: 'ai-5', type: 'Toxic content' as const, confidence: 81, preview: 'Insult in anonymous lounge', action: 'Blurred for review', at: hoursAgo(7) },
  { id: 'ai-6', type: 'Fraudulent marketplace' as const, confidence: 59, preview: 'Advance-payment request on a rental listing', action: 'Needs review', at: daysAgo(1) },
];

export const anonymousRevealRequests = [
  { id: 'ar-1', reason: 'Threat reported in an anonymous chat', requestedBy: 'Women’s safety desk', status: 'Awaiting second approver' as const },
  { id: 'ar-2', reason: 'Academic dishonesty report', requestedBy: 'Examination cell', status: 'Awaiting second approver' as const },
];

export const contentQueue = [
  { id: 'cq-1', kind: 'Community' as const, title: 'Photography Society', submittedBy: 'Kunal Sawant', at: daysAgo(1) },
  { id: 'cq-2', kind: 'Event' as const, title: 'Campus Quiz Night (Oct 30)', submittedBy: 'Shruti Kale', at: hoursAgo(10) },
  { id: 'cq-3', kind: 'Club' as const, title: 'Debate & Public Speaking Club', submittedBy: 'Pooja Kulkarni', at: daysAgo(2) },
  { id: 'cq-4', kind: 'Resource' as const, title: 'Compiler Design — Unit 1 notes', submittedBy: 'Aryan Gaikwad', at: daysAgo(1) },
];
