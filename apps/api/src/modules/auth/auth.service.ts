import type { ClientSession } from 'mongodb';
import { audit, auditBestEffort } from '../../core/audit.js';
import { randomToken, sha256Hex } from '../../core/crypto.js';
import { Errors } from '../../core/errors.js';
import type { Deps } from '../../deps.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { RoleInfo, User } from '../../infra/db/models.js';
import { defaultNotificationPrefs, defaultProfile, defaultSettings } from '../users/defaults.js';
import { loadMe } from '../users/me.js';
import { hashPassword, passwordProblems, verifyPassword } from './password.js';
import type { CreatedSession, SessionService } from './session.service.js';

// Account lifecycle: sign-up (per role), email verification, sign-in, sign-out, password
// reset/change.
//
// Security properties:
//   * no account enumeration: sign-up, resend and forgot-password give the same answer whether
//     or not the email exists; sign-in says "email or password is incorrect" either way and
//     takes the same time (dummy hash check)
//   * brute force: after 5 wrong guesses for an email in 15 minutes, or 100 from one network,
//     sign-in is refused for a while (tracked in the database, so it works even without Redis)
//   * single-use, expiring, hashed email tokens; a new one replaces any older unused one
//   * changing or resetting a password signs out every other session and sends an alert
//   * faculty and expert access is granted only after an admin reviews the request

export const TERMS_VERSION = '2026-10-20';
const VERIFY_TTL_HOURS = 24;
const RESET_TTL_MINUTES = 60;
const LOCK_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
// High on purpose: many people can share one public address (a college or office network, a
// mobile carrier's NAT), and a low limit would let one person lock everyone else out.
const MAX_FAILURES_PER_NETWORK = 100;
/** People must be at least this old to sign up (worked out from the date of birth). */
export const MINIMUM_AGE = 18;

/** Whole years between a date of birth and a day (birthdays counted in UTC). */
export function ageOn(dob: Date, day: Date): number {
  let age = day.getUTCFullYear() - dob.getUTCFullYear();
  const m = day.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && day.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export type SignupRole = 'student' | 'faculty' | 'expert';

export interface RequestMeta {
  ipHash: string | null;
  userAgent?: string;
  requestId: string;
}

function domainOf(email: string): string {
  return email.split('@')[1] ?? '';
}

function usernameBase(email: string): string {
  const local = (email.split('@')[0] ?? 'student').toLowerCase().replace(/[^a-z0-9._]/g, '.').replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
  const base = local.slice(0, 18);
  return base.length >= 3 ? base : `${base}user`.slice(0, 18);
}

export class AuthService {
  constructor(
    private readonly deps: Deps,
    private readonly sessions: SessionService,
  ) {}

  private get users() {
    return this.deps.db.col('users');
  }

  private async uniqueUsername(email: string): Promise<string> {
    const base = usernameBase(email);
    for (let i = 0; i < 8; i++) {
      const candidate = i === 0 ? base : `${base}${Math.floor(100 + Math.random() * 9900)}`;
      const taken = await this.users.findOne({ 'profile.usernameLower': candidate.toLowerCase() }, { projection: { _id: 1 } });
      if (!taken) return candidate;
    }
    return `${base.slice(0, 12)}${Date.now().toString(36)}`;
  }

  private async issueEmailToken(input: { userId: string | null; email: string; purpose: 'verify_email' | 'reset_password' | 'data_request'; ttlMinutes: number; ipHash: string | null }, session?: ClientSession): Promise<string> {
    const tokens = this.deps.db.col('email_tokens');
    // A fresh token replaces any earlier unused one for the same purpose.
    await tokens.updateMany({ email: input.email, purpose: input.purpose, consumedAt: null }, { $set: { consumedAt: new Date() } }, { session });
    const token = randomToken('cce');
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);
    await tokens.insertOne(
      { _id: uuidv7(), userId: input.userId, email: input.email, purpose: input.purpose, tokenHash: sha256Hex(token), expiresAt, consumedAt: null, ipHash: input.ipHash, createdAt: new Date(), expireAt: new Date(expiresAt.getTime() + 86_400_000) },
      { session },
    );
    return token;
  }

  /** Consumes a token atomically: it can be used exactly once, before it expires. */
  async consumeToken(token: string, purpose: 'verify_email' | 'reset_password' | 'data_request', session?: ClientSession): Promise<{ userId: string | null; email: string }> {
    if (!/^cce_[A-Za-z0-9_-]{43}$/.test(token)) throw Errors.gone();
    const row = await this.deps.db.col('email_tokens').findOneAndUpdate(
      { tokenHash: sha256Hex(token), purpose, consumedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { consumedAt: new Date() } },
      { session },
    );
    if (!row) throw Errors.gone();
    return { userId: row.userId, email: row.email };
  }

  private async resolveCollege(collegeId: string | undefined, email: string) {
    const colleges = this.deps.db.col('colleges');
    if (collegeId) {
      const chosen = await colleges.findOne({ _id: collegeId, status: 'active' });
      if (!chosen) throw Errors.validation([{ field: 'collegeId', message: 'Choose your college from the list.' }]);
      return chosen;
    }
    const byDomain = await colleges.findOne({ 'domains.domain': domainOf(email), status: 'active' });
    if (byDomain) return byDomain;
    const active = await colleges.find({ status: 'active' }).limit(2).toArray();
    if (active.length === 1) return active[0]!;
    throw Errors.validation([{ field: 'collegeId', message: 'Choose your college from the list.' }]);
  }

  async register(
    input: {
      email: string;
      password: string;
      displayName: string;
      role: SignupRole;
      roleInfo?: RoleInfo;
      phone: string;
      dateOfBirth: string;
      acceptTerms: boolean;
      confirmAdult?: boolean;
      marketingOptIn: boolean;
      anonymousId?: string;
      /** The college chosen on the sign-up form. Optional when the deployment has one college. */
      collegeId?: string;
    },
    meta: RequestMeta,
  ): Promise<{ userId: string; verifyUrl?: string; session?: CreatedSession } | void> {
    if (!input.acceptTerms) throw Errors.validation([{ field: 'acceptTerms', message: 'Please accept the terms and privacy policy.' }]);

    // The age is worked out from the date of birth: CampusConnect is for people aged 18 or over.
    const dob = new Date(`${input.dateOfBirth}T00:00:00Z`);
    const age = ageOn(dob, new Date());
    if (Number.isNaN(dob.getTime()) || age < 0 || age > 100) throw Errors.validation([{ field: 'dateOfBirth', message: 'Enter a valid date of birth.' }]);
    if (age < MINIMUM_AGE) throw Errors.validation([{ field: 'dateOfBirth', message: `CampusConnect is for people aged ${MINIMUM_AGE} or over.` }]);

    // Any email address works (Gmail, Outlook, a college address...). Students and faculty choose
    // their college on the form; industry experts are not from a college, so they join the main
    // one. Roles are not inferred from the address: faculty and expert access is reviewed.
    const college = await this.resolveCollege(input.collegeId, input.email);

    const problems = passwordProblems(input.password, { email: input.email, name: input.displayName });
    if (problems.length) throw Errors.weakPassword(problems);

    // Hash before the lookup so both paths cost the same time (no timing-based enumeration).
    const passwordHash = await hashPassword(input.password);
    const existing = await this.users.findOne({ email: input.email }, { projection: { status: 1 } });
    if (existing) {
      // Signing in right after sign-up cannot hide whether an address is taken, so say so plainly.
      if (!this.deps.config.requireEmailVerification) throw Errors.validation([{ field: 'email', message: 'An account with this email already exists. Sign in instead.' }]);
      // Same answer as a new sign-up; the owner gets an email instead (no enumeration).
      if (existing.status === 'pending') await this.resendVerification(input.email, meta);
      else if (existing.status === 'active') {
        await this.deps.mailer.enqueue({ to: input.email, template: 'account_exists', category: 'security', userId: existing._id, dedupeKey: `account-exists:${existing._id}:${new Date().toISOString().slice(0, 13)}` });
      }
      return;
    }

    const now = new Date();
    const userId = uuidv7();
    const username = await this.uniqueUsername(input.email);
    // Everyone who signs up is a student. Admins come from the bootstrap script or another admin.
    const verify = this.deps.config.requireEmailVerification;
    const user: User = {
      _id: userId,
      collegeId: college._id,
      email: input.email,
      emailVerifiedAt: null,
      passwordHash,
      role: 'student',
      pendingRole: null,
      status: verify ? 'pending' : 'active',
      roleInfo: {},
      phone: input.phone,
      dateOfBirth: dob,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      passwordChangedAt: now,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: now,
      adultConfirmedAt: now,
      deletionScheduledFor: null,
      deletionReason: null,
      profile: defaultProfile({ username, displayName: input.displayName }),
      settings: defaultSettings(),
      notificationPrefs: defaultNotificationPrefs(input.marketingOptIn),
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.deps.db.tx(async (session) => {
      await this.users.insertOne(user, { session });
      await this.deps.db.col('consents').insertMany(
        (['terms', 'privacy', 'marketing_email'] as const).map((purpose) => ({
          _id: uuidv7(),
          userId,
          anonymousId: input.anonymousId ?? null,
          purpose,
          granted: purpose === 'marketing_email' ? input.marketingOptIn : true,
          policyVersion: TERMS_VERSION,
          source: 'signup' as const,
          ipHash: meta.ipHash,
          createdAt: now,
        })),
        { session },
      );
      await audit(this.deps.db, { action: 'auth.register', actorId: userId, collegeId: college._id, entityType: 'user', entityId: userId, ipHash: meta.ipHash, requestId: meta.requestId, meta: { role: 'student' } }, session);

      if (!verify) {
        // No email step for now: the account is active and the person is signed in straight away.
        const created = await this.sessions.create({ userId, role: 'student', kind: 'web', rememberMe: true, ipHash: meta.ipHash, userAgent: meta.userAgent }, session);
        return { userId, session: created };
      }
      const token = await this.issueEmailToken({ userId, email: input.email, purpose: 'verify_email', ttlMinutes: VERIFY_TTL_HOURS * 60, ipHash: meta.ipHash }, session);
      const url = `${this.deps.config.webUrl}/verify-email?token=${token}`;
      await this.deps.mailer.enqueue({ to: input.email, template: 'verify_email', userId, payload: { name: input.displayName.split(' ')[0], url } }, session);
      return { userId, verifyUrl: url };
    });
    return result;
  }

  async resendVerification(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.users.findOne({ email, status: 'pending' }, { projection: { 'profile.displayName': 1 } });
    if (!user) return; // same response either way
    const token = await this.issueEmailToken({ userId: user._id, email, purpose: 'verify_email', ttlMinutes: VERIFY_TTL_HOURS * 60, ipHash: meta.ipHash });
    await this.deps.mailer.enqueue({ to: email, template: 'verify_email', userId: user._id, payload: { name: user.profile.displayName.split(' ')[0], url: `${this.deps.config.webUrl}/verify-email?token=${token}` } });
  }

  /** Verifies the email and signs the person in. */
  async verifyEmail(token: string, meta: RequestMeta) {
    return this.deps.db.tx(async (session) => {
      const t = await this.consumeToken(token, 'verify_email', session);
      const user = await this.users.findOneAndUpdate(
        { _id: t.userId ?? '', status: { $in: ['pending', 'active'] } },
        [{ $set: { emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', '$$NOW'] }, status: 'active', updatedAt: '$$NOW' } }],
        { session, returnDocument: 'after', projection: { role: 1, collegeId: 1, email: 1, pendingRole: 1, 'profile.displayName': 1 } },
      );
      if (!user) throw Errors.gone();
      // Faculty and experts: email confirmed, but they sign in only after an admin approves.
      if (user.pendingRole) {
        await audit(this.deps.db, { action: 'auth.email_verified', actorId: user._id, collegeId: user.collegeId, entityType: 'user', entityId: user._id, ipHash: meta.ipHash, requestId: meta.requestId }, session);
        return { userId: user._id, session: null, pendingRole: user.pendingRole };
      }
      await this.deps.mailer.enqueue({ to: user.email, template: 'welcome', userId: user._id, payload: { name: user.profile.displayName.split(' ')[0] }, dedupeKey: `welcome:${user._id}` }, session);
      await audit(this.deps.db, { action: 'auth.email_verified', actorId: user._id, collegeId: user.collegeId, entityType: 'user', entityId: user._id, ipHash: meta.ipHash, requestId: meta.requestId }, session);
      const created = await this.sessions.create({ userId: user._id, role: user.role, kind: 'web', rememberMe: true, ipHash: meta.ipHash, userAgent: meta.userAgent }, session);
      return { userId: user._id, session: created, pendingRole: null };
    });
  }

  private async assertNotThrottled(email: string, ipHash: string | null): Promise<void> {
    // Only wrong guesses count; a correct password on an unverified account is not an attack.
    const since = new Date(Date.now() - LOCK_WINDOW_MINUTES * 60_000);
    const attempts = this.deps.db.col('login_attempts');
    const wrong = { success: false, reason: { $in: ['bad_password', 'unknown_email'] }, createdAt: { $gt: since } };
    const [byEmail, byIp] = await Promise.all([
      attempts.countDocuments({ email, ...wrong }),
      ipHash ? attempts.countDocuments({ ipHash, ...wrong }) : Promise.resolve(0),
    ]);
    if (byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_NETWORK) {
      throw Errors.tooMany(LOCK_WINDOW_MINUTES * 60, 'Too many sign-in attempts. Wait 15 minutes, or reset your password.');
    }
  }

  private async recordAttempt(email: string, userId: string | null, ipHash: string | null, success: boolean, reason: string): Promise<void> {
    await this.deps.db
      .col('login_attempts')
      .insertOne({ _id: uuidv7(), email, userId, ipHash, success, reason, createdAt: new Date() })
      .catch((err) => this.deps.logger.warn({ err: (err as Error).message }, 'could not record login attempt'));
  }

  async login(input: { email: string; password: string; rememberMe: boolean; client: 'web' | 'mobile' }, meta: RequestMeta) {
    await this.assertNotThrottled(input.email, meta.ipHash);
    const user = await this.users.findOne({ email: input.email }, { projection: { passwordHash: 1, role: 1, status: 1, collegeId: 1, lockedUntil: 1, pendingRole: 1 } });

    const ok = await verifyPassword(user?.passwordHash ?? null, input.password);
    if (!user || !ok || user.status === 'deleted') {
      await this.recordAttempt(input.email, user?._id ?? null, meta.ipHash, false, user ? 'bad_password' : 'unknown_email');
      throw Errors.invalidCredentials();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordAttempt(input.email, user._id, meta.ipHash, false, 'locked');
      throw Errors.tooMany(Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000), 'This account is temporarily locked. Try again later.');
    }
    if (user.status === 'pending') {
      await this.recordAttempt(input.email, user._id, meta.ipHash, false, 'not_verified');
      throw Errors.emailNotVerified();
    }
    if (user.status === 'suspended') {
      await this.recordAttempt(input.email, user._id, meta.ipHash, false, 'suspended');
      throw Errors.suspended();
    }
    if (user.pendingRole) {
      await this.recordAttempt(input.email, user._id, meta.ipHash, false, 'approval_pending');
      throw Errors.approvalPending(user.pendingRole);
    }

    const session = await this.sessions.create({ userId: user._id, role: user.role, kind: input.client, rememberMe: input.rememberMe, ipHash: meta.ipHash, userAgent: meta.userAgent });
    await this.users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), failedLoginCount: 0 } });
    await this.recordAttempt(input.email, user._id, meta.ipHash, true, 'ok');
    await auditBestEffort(this.deps.db, { action: 'auth.login', actorId: user._id, actorRole: user.role, collegeId: user.collegeId, entityType: 'session', entityId: session.sessionId, ipHash: meta.ipHash, requestId: meta.requestId, meta: { client: input.client } }, this.deps.logger);
    await this.maybeAlertNewDevice(user._id, input.email, session.sessionId).catch(() => undefined);
    return { userId: user._id, session };
  }

  private async maybeAlertNewDevice(userId: string, email: string, sessionId: string): Promise<void> {
    if (!(await this.deps.flags.isEnabled('feature.sign_in_alerts'))) return;
    const sessions = this.deps.db.col('sessions');
    const current = await sessions.findOne({ _id: sessionId }, { projection: { deviceLabel: 1 } });
    const label = current?.deviceLabel ?? null;
    const [seen, anyBefore] = await Promise.all([
      sessions.findOne({ userId, _id: { $ne: sessionId }, deviceLabel: label, createdAt: { $gt: new Date(Date.now() - 90 * 86_400_000) } }, { projection: { _id: 1 } }),
      sessions.findOne({ userId, _id: { $ne: sessionId } }, { projection: { _id: 1 } }),
    ]);
    if (seen || !anyBefore) return; // known device, or the very first sign-in
    await this.deps.mailer.enqueue({
      to: email,
      template: 'new_sign_in',
      category: 'security',
      userId,
      payload: { device: label ?? 'a new device', when: new Date().toUTCString() },
      dedupeKey: `new-sign-in:${userId}:${label ?? 'unknown'}:${new Date().toISOString().slice(0, 10)}`,
    });
  }

  async logout(sessionId: string, userId: string, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(sessionId, 'logout', userId);
    await auditBestEffort(this.deps.db, { action: 'auth.logout', actorId: userId, entityType: 'session', entityId: sessionId, ipHash: meta.ipHash, requestId: meta.requestId }, this.deps.logger);
  }

  async logoutAll(userId: string, meta: RequestMeta): Promise<number> {
    const n = await this.sessions.revokeAll(userId, 'logout_all');
    await auditBestEffort(this.deps.db, { action: 'auth.logout_all', actorId: userId, entityType: 'user', entityId: userId, ipHash: meta.ipHash, requestId: meta.requestId, meta: { sessions: n } }, this.deps.logger);
    return n;
  }

  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.users.findOne({ email, status: { $in: ['active', 'pending'] } }, { projection: { 'profile.displayName': 1 } });
    if (!user) return; // same response either way
    const token = await this.issueEmailToken({ userId: user._id, email, purpose: 'reset_password', ttlMinutes: RESET_TTL_MINUTES, ipHash: meta.ipHash });
    await this.deps.mailer.enqueue({ to: email, template: 'reset_password', category: 'security', userId: user._id, payload: { name: user.profile.displayName.split(' ')[0], url: `${this.deps.config.webUrl}/reset-password?token=${token}` } });
    await auditBestEffort(this.deps.db, { action: 'auth.password_reset_requested', actorId: user._id, entityType: 'user', entityId: user._id, ipHash: meta.ipHash, requestId: meta.requestId }, this.deps.logger);
  }

  async resetPassword(token: string, password: string, meta: RequestMeta): Promise<void> {
    // Check the new password before using up the token, so a weak choice can simply be retried.
    const peek = /^cce_[A-Za-z0-9_-]{43}$/.test(token)
      ? await this.deps.db.col('email_tokens').findOne({ tokenHash: sha256Hex(token), purpose: 'reset_password', consumedAt: null, expiresAt: { $gt: new Date() } })
      : null;
    if (!peek?.userId) throw Errors.gone();
    const owner = await this.users.findOne({ _id: peek.userId, status: { $in: ['active', 'pending'] } }, { projection: { email: 1, 'profile.displayName': 1 } });
    if (!owner) throw Errors.gone();
    const problems = passwordProblems(password, { email: owner.email, name: owner.profile.displayName });
    if (problems.length) throw Errors.weakPassword(problems);
    const passwordHash = await hashPassword(password);

    await this.deps.db.tx(async (session) => {
      const t = await this.consumeToken(token, 'reset_password', session);
      if (t.userId !== owner._id) throw Errors.gone();
      // Resetting by email also proves ownership of the address, so it verifies a pending account.
      await this.users.updateOne(
        { _id: owner._id },
        [{ $set: { passwordHash: { $literal: passwordHash }, passwordChangedAt: '$$NOW', failedLoginCount: 0, lockedUntil: null, status: { $cond: [{ $eq: ['$status', 'pending'] }, 'active', '$status'] }, emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', '$$NOW'] }, updatedAt: '$$NOW' } }],
        { session },
      );
      await this.deps.db.col('email_tokens').updateMany({ userId: owner._id, purpose: 'reset_password', consumedAt: null }, { $set: { consumedAt: new Date() } }, { session });
      await this.sessions.revokeAll(owner._id, 'password_reset', undefined, session);
      await this.deps.mailer.enqueue({ to: owner.email, template: 'password_changed', category: 'security', userId: owner._id, payload: { when: new Date().toUTCString() } }, session);
      await audit(this.deps.db, { action: 'auth.password_reset', actorId: owner._id, entityType: 'user', entityId: owner._id, ipHash: meta.ipHash, requestId: meta.requestId }, session);
    });
  }

  async changePassword(userId: string, sessionId: string, current: string, next: string, meta: RequestMeta): Promise<number> {
    const user = await this.users.findOne({ _id: userId }, { projection: { passwordHash: 1, email: 1, 'profile.displayName': 1 } });
    if (!user) throw Errors.unauthenticated();
    if (!(await verifyPassword(user.passwordHash, current))) throw Errors.validation([{ field: 'currentPassword', message: 'Your current password is not correct.' }]);
    if (current === next) throw Errors.validation([{ field: 'newPassword', message: 'Choose a password you have not used here.' }]);
    const problems = passwordProblems(next, { email: user.email, name: user.profile.displayName });
    if (problems.length) throw Errors.weakPassword(problems);
    const passwordHash = await hashPassword(next);
    return this.deps.db.tx(async (session) => {
      await this.users.updateOne({ _id: userId }, { $set: { passwordHash, passwordChangedAt: new Date(), updatedAt: new Date() } }, { session });
      const revoked = await this.sessions.revokeAll(userId, 'password_changed', sessionId, session);
      await this.deps.mailer.enqueue({ to: user.email, template: 'password_changed', category: 'security', userId, payload: { when: new Date().toUTCString() } }, session);
      await audit(this.deps.db, { action: 'auth.password_changed', actorId: userId, entityType: 'user', entityId: userId, ipHash: meta.ipHash, requestId: meta.requestId, meta: { otherSessionsRevoked: revoked } }, session);
      return revoked;
    });
  }

  async sessionPayload(userId: string, session: { sessionId: string; idleExpiresAt: Date | string; absoluteExpiresAt: Date | string }) {
    const me = await loadMe(this.deps, userId);
    return {
      user: me,
      session: { id: session.sessionId, idleExpiresAt: new Date(session.idleExpiresAt).toISOString(), absoluteExpiresAt: new Date(session.absoluteExpiresAt).toISOString() },
      csrfToken: this.sessions.csrfTokenFor(session.sessionId),
    };
  }
}
