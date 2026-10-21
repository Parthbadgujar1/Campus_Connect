import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors } from '../../core/errors.js';
import { requireAuth } from '../../core/guards.js';
import { email, idParam, text, uuid } from '../../core/validation.js';
import { limits } from '../../plugins/traffic.js';
import { AuthService, type RequestMeta } from './auth.service.js';
import type { CreatedSession } from './session.service.js';

// /v1/auth — sign-up, verification, sign-in/out, password reset/change, active sessions.
// Web clients receive an httpOnly cookie; mobile clients send `X-Client: mobile` and receive a
// bearer token in the body instead (stored in the device keychain, never in plain storage).

const password = z.string().min(1, 'Enter your password.').max(128, 'Use at most 128 characters.');
const roleInfo = z.object({
  enrollmentNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{4,40}$/, 'Use letters, numbers, / or -.').optional(),
  admissionYear: z.number().int().min(2000).max(2100).optional(),
  employeeId: z.string().trim().regex(/^[A-Za-z0-9/-]{2,40}$/, 'Use letters, numbers, / or -.').optional(),
  designation: z.string().trim().min(2).max(120).optional(),
  organization: z.string().trim().min(2).max(160).optional(),
  linkedinUrl: z.string().trim().max(300).regex(/^https:\/\/(www\.)?linkedin\.com\/\S+$/, 'Use your full LinkedIn profile link.').optional(),
});
const token = z.string().trim().min(10).max(200);

const CHECK_EMAIL = {
  status: 'check_email',
  message: 'If that address can be used, we have sent an email with the next step. It can take a minute to arrive.',
} as const;

function meta(request: FastifyRequest): RequestMeta {
  return { ipHash: request.ipHash, userAgent: request.headers['user-agent'], requestId: request.id };
}

function clientOf(request: FastifyRequest): 'web' | 'mobile' {
  return request.headers['x-client'] === 'mobile' ? 'mobile' : 'web';
}

export const authRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const service = new AuthService(app.deps, app.sessions);

  /** Hands a new session to the client in the form it expects and returns the response body. */
  async function deliver(request: FastifyRequest, reply: FastifyReply, userId: string, session: CreatedSession) {
    const payload = await service.sessionPayload(userId, session);
    if (clientOf(request) === 'mobile') return { ...payload, token: session.token };
    app.sessions.setCookies(reply, session);
    return payload;
  }

  app.post(
    '/register',
    {
      config: limits.signUp,
      schema: {
        tags: ['auth'],
        summary: 'Create an account with any email address and password',
        body: z.object({
          email,
          password,
          displayName: text(2, 80),
          // Who is joining, and the details each role is asked for (kept private).
          role: z.enum(['student', 'faculty', 'expert']).default('student'),
          roleInfo: roleInfo.default({}),
          acceptTerms: z.boolean(),
          confirmAdult: z.boolean(),
          marketingOptIn: z.boolean().default(false),
          anonymousId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
          collegeId: uuid.optional(),
        }).superRefine((b, ctx) => {
          const need = (field: keyof typeof b.roleInfo, message: string) => {
            if (!b.roleInfo[field]) ctx.addIssue({ code: 'custom', path: ['roleInfo', field], message });
          };
          if (b.role === 'student') need('enrollmentNumber', 'Enter your enrolment (PRN) number.');
          if (b.role === 'faculty') {
            need('employeeId', 'Enter your employee ID.');
            need('designation', 'Enter your designation, for example Assistant Professor.');
          }
          if (b.role === 'expert') {
            need('organization', 'Enter your company or organisation.');
            need('designation', 'Enter your role there.');
          }
        }),
      },
    },
    async (request, reply) => {
      // Sign-ups have their own switch so they can be paused without blocking sign-ins.
      if (!(await app.deps.flags.isEnabled('module.registration'))) throw Errors.featureDisabled('module.registration');
      await service.register(request.body, meta(request));
      return reply.status(202).send(CHECK_EMAIL);
    },
  );

  app.post(
    '/verify-email',
    { config: limits.tokenAction, schema: { tags: ['auth'], summary: 'Confirm an email address and sign in', body: z.object({ token }) } },
    async (request, reply) => {
      const { userId, session } = await service.verifyEmail(request.body.token, meta(request));
      return deliver(request, reply, userId, session);
    },
  );

  app.post(
    '/resend-verification',
    { config: limits.emailAction, schema: { tags: ['auth'], summary: 'Send the verification email again', body: z.object({ email }) } },
    async (request, reply) => {
      await service.resendVerification(request.body.email, meta(request));
      return reply.status(202).send(CHECK_EMAIL);
    },
  );

  app.post(
    '/login',
    {
      config: limits.signIn,
      schema: {
        tags: ['auth'],
        summary: 'Sign in',
        body: z.object({ email, password, rememberMe: z.boolean().default(false) }),
      },
    },
    async (request, reply) => {
      const { userId, session } = await service.login({ ...request.body, client: clientOf(request) }, meta(request));
      // Signing in replaces any session this browser already had (prevents session fixation).
      if (request.auth) await app.sessions.revoke(request.auth.sessionId, 'logout').catch(() => undefined);
      return deliver(request, reply, userId, session);
    },
  );

  app.post('/logout', { schema: { tags: ['auth'], summary: 'Sign out of this device' } }, async (request, reply) => {
    // Idempotent: signing out without a session still clears cookies and succeeds.
    if (request.auth) await service.logout(request.auth.sessionId, request.auth.userId, meta(request));
    app.sessions.clearCookies(reply);
    return { status: 'signed_out' };
  });

  app.post('/logout-all', { schema: { tags: ['auth'], summary: 'Sign out everywhere' } }, async (request, reply) => {
    const auth = requireAuth(request);
    const sessions = await service.logoutAll(auth.userId, meta(request));
    app.sessions.clearCookies(reply);
    return { status: 'signed_out', sessions };
  });

  app.get('/session', { schema: { tags: ['auth'], summary: 'The current session, or nulls when signed out' } }, async (request) => {
    if (!request.auth) return { user: null, session: null, csrfToken: null };
    const row = await app.deps.db.col('sessions').findOne({ _id: request.auth.sessionId }, { projection: { idleExpiresAt: 1, absoluteExpiresAt: 1 } });
    if (!row) return { user: null, session: null, csrfToken: null };
    return service.sessionPayload(request.auth.userId, { sessionId: request.auth.sessionId, idleExpiresAt: row.idleExpiresAt, absoluteExpiresAt: row.absoluteExpiresAt });
  });

  app.post(
    '/forgot-password',
    { config: limits.emailAction, schema: { tags: ['auth'], summary: 'Email a password reset link', body: z.object({ email }) } },
    async (request, reply) => {
      await service.forgotPassword(request.body.email, meta(request));
      return reply.status(202).send(CHECK_EMAIL);
    },
  );

  app.post(
    '/reset-password',
    {
      config: limits.tokenAction,
      schema: { tags: ['auth'], summary: 'Set a new password with the emailed link', body: z.object({ token, password }) },
    },
    async (request, reply) => {
      await service.resetPassword(request.body.token, request.body.password, meta(request));
      app.sessions.clearCookies(reply);
      return { status: 'password_reset', message: 'Your password was changed. Sign in with the new password.' };
    },
  );

  app.post(
    '/change-password',
    {
      config: limits.emailAction,
      schema: {
        tags: ['auth'],
        summary: 'Change the password (signs out other devices)',
        body: z.object({ currentPassword: password, newPassword: password }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const revoked = await service.changePassword(auth.userId, auth.sessionId, request.body.currentPassword, request.body.newPassword, meta(request));
      return { status: 'password_changed', otherSessionsSignedOut: revoked };
    },
  );

  app.get('/sessions', { schema: { tags: ['auth'], summary: 'Devices signed in to this account' } }, async (request) => {
    const auth = requireAuth(request);
    const now = new Date();
    const rows = await app.deps.db
      .col('sessions')
      .find({ userId: auth.userId, revokedAt: null, idleExpiresAt: { $gt: now }, absoluteExpiresAt: { $gt: now } })
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .toArray();
    return {
      items: rows.map((r) => ({
        id: r._id,
        kind: r.kind,
        device: r.deviceLabel ?? 'Unknown device',
        current: r._id === auth.sessionId,
        signedInAt: r.createdAt.toISOString(),
        lastActiveAt: r.lastSeenAt.toISOString(),
        expiresAt: r.absoluteExpiresAt.toISOString(),
      })),
    };
  });

  app.delete(
    '/sessions/:id',
    { schema: { tags: ['auth'], summary: 'Sign out one device', params: idParam } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const revoked = await app.sessions.revoke(request.params.id, 'revoked_by_user', auth.userId);
      if (!revoked) throw Errors.notFound('That session');
      if (request.params.id === auth.sessionId) app.sessions.clearCookies(reply);
      return { status: 'signed_out' };
    },
  );
};
