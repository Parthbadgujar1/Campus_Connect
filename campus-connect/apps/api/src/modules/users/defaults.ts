import type { NotificationPrefs, Profile, UserSettings } from '../../infra/db/models.js';

// What every new account starts with. Privacy-protective defaults: profile visible only inside the
// college, email hidden, activity hidden, marketing email off, summaries weekly.

export function defaultProfile(input: { username: string; displayName: string }): Profile {
  return {
    username: input.username,
    usernameLower: input.username.toLowerCase(),
    displayName: input.displayName,
    headline: null,
    bio: null,
    departmentId: null,
    year: null,
    semester: null,
    division: null,
    skills: [],
    interests: [],
    links: {},
    avatarFileId: null,
    isVerified: false,
    visibility: { profile: 'campus', showBranch: true, showEmail: false, showActivity: false, showOnline: true },
    messagePrivacy: 'everyone',
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
  };
}

export function defaultSettings(): UserSettings {
  return {
    theme: 'system',
    font: 'pro',
    textSize: 'md',
    reduceMotion: false,
    highContrast: false,
    onboardingCompletedAt: null,
    onboardingSkipped: false,
    tourCompletedAt: null,
    tourSkipped: false,
    tourVersion: 0,
    seen: [],
  };
}

export function defaultNotificationPrefs(marketing = false): NotificationPrefs {
  return { inApp: {}, email: {}, emailDigest: 'weekly', marketingEmails: marketing, quietStart: null, quietEnd: null };
}
