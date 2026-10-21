import type { Deps } from '../../deps.js';
import { Errors } from '../../core/errors.js';
import type { RoleInfo } from '../../infra/db/models.js';
import { avatarUrls, departmentNames } from './people.js';

// The signed-in person's own account and profile ("me"), returned after sign-in and by
// GET /v1/me. It includes private fields (email, role details, settings) that public profiles
// never show.

export interface Me {
  id: string;
  email: string;
  role: string;
  /** faculty or expert while an admin reviews the request, otherwise null */
  pendingRole: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  deletionScheduledFor: string | null;
  roleInfo: RoleInfo;
  college: { id: string; name: string; shortName: string; slug: string };
  profile: {
    username: string;
    displayName: string;
    headline: string | null;
    bio: string | null;
    avatarUrl: string | null;
    departmentId: string | null;
    department: string | null;
    year: number | null;
    semester: number | null;
    division: string | null;
    skills: string[];
    interests: string[];
    links: Record<string, string>;
    isVerified: boolean;
    visibility: Record<string, unknown>;
    messagePrivacy: string;
    followersCount: number;
    followingCount: number;
  };
}

export async function loadMe(deps: Deps, userId: string): Promise<Me> {
  const u = await deps.db.col('users').findOne({ _id: userId }, { projection: { passwordHash: 0, settings: 0, notificationPrefs: 0 } });
  if (!u) throw Errors.notFound('Your account');
  const [college, departments, avatars] = await Promise.all([
    deps.db.col('colleges').findOne({ _id: u.collegeId }, { projection: { name: 1, shortName: 1, slug: 1 } }),
    departmentNames(deps.db, [u.profile.departmentId]),
    avatarUrls(deps, [u.profile.avatarFileId]),
  ]);
  const p = u.profile;
  return {
    id: u._id,
    email: u.email,
    role: u.role,
    pendingRole: u.pendingRole ?? null,
    status: u.status,
    emailVerified: Boolean(u.emailVerifiedAt),
    createdAt: u.createdAt.toISOString(),
    deletionScheduledFor: u.deletionScheduledFor?.toISOString() ?? null,
    roleInfo: u.roleInfo ?? {},
    college: { id: u.collegeId, name: college?.name ?? '', shortName: college?.shortName ?? '', slug: college?.slug ?? '' },
    profile: {
      username: p.username,
      displayName: p.displayName,
      headline: p.headline,
      bio: p.bio,
      avatarUrl: p.avatarFileId ? (avatars.get(p.avatarFileId) ?? null) : null,
      departmentId: p.departmentId,
      department: p.departmentId ? (departments.get(p.departmentId) ?? null) : null,
      year: p.year,
      semester: p.semester,
      division: p.division,
      skills: p.skills,
      interests: p.interests,
      links: p.links,
      isVerified: p.isVerified,
      visibility: p.visibility,
      messagePrivacy: p.messagePrivacy,
      followersCount: p.followersCount,
      followingCount: p.followingCount,
    },
  };
}
