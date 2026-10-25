import type { ApiRole } from '@/lib/api/types';

export const SPACE_KINDS: Record<string, string> = {
  club: 'Club',
  interest: 'Interest',
  exam: 'Exam prep',
  hostel: 'Hostel',
  city: 'City',
  department: 'Department',
  class: 'Class',
};

/** Class and department spaces can only be created by faculty and admins. */
export function isStaffRole(role: ApiRole | undefined): boolean {
  return role === 'faculty' || role === 'moderator' || role === 'admin';
}

export const FLAIRS = ['Discussion', 'Question', 'Announcement', 'Team up', 'Resource', 'Event'];
