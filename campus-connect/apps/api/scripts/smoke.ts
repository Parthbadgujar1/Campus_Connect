// End-to-end smoke test against a running API with the seeded accounts. It walks the main flows
// of every module the way the apps use them and prints a pass/fail line for each check.
// Exit code 1 if anything failed.
//
// The test writes data (posts, chats, sign-ups...), so run it against the test database, not the
// one you use day to day:
//   1. MONGODB_DB=campus_connect_test npm run db:reset --workspace=api
//   2. start an API with MONGODB_DB=campus_connect_test PORT=4100 (MAIL_TRANSPORT=dev)
//   3. MONGODB_DB=campus_connect_test API_URL=http://127.0.0.1:4100 npm run smoke --workspace=api

import { MongoClient } from 'mongodb';
import { Redis } from 'ioredis';
import sharp from 'sharp';
import { loadEnvFile, parseConfig } from '../src/config/env.js';
import { unsubscribeUrl } from '../src/core/unsubscribe.js';
import { DEMO_PASSWORD } from './seed.js';

loadEnvFile();
const config = parseConfig();
const API = process.env.API_URL ?? `http://127.0.0.1:${config.port}`;
const PASSWORD = process.env.SEED_PASSWORD || DEMO_PASSWORD;
const mongo = new MongoClient(config.db.url, { serverSelectionTimeoutMS: 5_000 });
const db = mongo.db(config.db.name);

// Seeded accounts used below.
const EMAIL = {
  riya: 'riya.deshmukh@example.com',
  pooja: 'pooja.kale@example.com',
  sanket: 'sanket.jadhav@example.com',
  aditi: 'aditi.shinde@example.com',
  vishwajeet: 'vishwajeet.patil@example.com',
  sneha: 'sneha.pawar@example.com',
  tejas: 'tejas.more@example.com',
  admin: 'prashant.joshi@example.com',
  admin2: 'neha.kulkarni@example.com',
  moderator: 'swati.gaikwad@example.com',
  faculty: 'anjali.deshpande@example.com',
  expert: 'karan.mehta@example.com',
  pendingFaculty: 'meenal.rao@example.com',
};

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    passes++;
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}`}`);
  }
}
function section(name: string): void {
  console.log(`\n${name}`);
}

interface Res<T = any> {
  status: number;
  body: T;
  headers: Headers;
  raw?: Buffer;
}

/** A client that behaves like the web app: keeps cookies and echoes the CSRF cookie. */
class Client {
  cookies = new Map<string, string>();
  bearer?: string;
  constructor(readonly label: string, readonly mobile = false) {}

  get csrf(): string | undefined {
    return this.cookies.get(config.cookies.csrfName);
  }

  async req<T = any>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Res<T>> {
    const headers: Record<string, string> = { ...extra };
    if (body !== undefined && !(body instanceof FormData)) headers['content-type'] = 'application/json';
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (this.csrf && method !== 'GET' && !('x-csrf-token' in extra)) headers['x-csrf-token'] = this.csrf;
    if (this.mobile) headers['x-client'] = 'mobile';
    if (this.bearer) headers.authorization = `Bearer ${this.bearer}`;
    const res = await fetch(API + path, {
      method,
      headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, ...rest] = pair!.split('=');
      const v = rest.join('=');
      if (!v || /max-age=0|expires=thu, 01 jan 1970/i.test(c)) this.cookies.delete(k!);
      else this.cookies.set(k!, v);
    }
    const raw = Buffer.from(await res.arrayBuffer());
    let parsed: any = null;
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('json')) {
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch {
        /* not JSON */
      }
    } else if (type.startsWith('text/')) parsed = raw.toString('utf8');
    return { status: res.status, body: parsed, headers: res.headers, raw };
  }

  get = <T = any>(p: string) => this.req<T>('GET', p);
  post = <T = any>(p: string, b: unknown = {}, h?: Record<string, string>) => this.req<T>('POST', p, b, h);
  patch = <T = any>(p: string, b: unknown = {}) => this.req<T>('PATCH', p, b);
  put = <T = any>(p: string, b: unknown = {}) => this.req<T>('PUT', p, b);
  del = <T = any>(p: string, b?: unknown) => this.req<T>('DELETE', p, b);

  async login(email: string, password = PASSWORD): Promise<Res> {
    const res = await this.post('/v1/auth/login', { email, password });
    if (this.mobile && res.body?.token) this.bearer = res.body.token;
    return res;
  }
}

async function latestEmail(to: string, template: string, since: Date): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const row = await db.collection('email_outbox').find({ toEmail: to, template, createdAt: { $gte: since }, status: 'sent' }).sort({ createdAt: -1 }).limit(1).next();
    if (row?.renderedText) return row.renderedText as string;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
const tokenIn = (text: string | null) => text?.match(/token=(cce_[A-Za-z0-9_-]{43})/)?.[1] ?? null;
const studentSignup = (email: string, password: string, displayName: string, extra: Record<string, unknown> = {}) => ({
  email,
  password,
  displayName,
  role: 'student',
  roleInfo: { enrollmentNumber: `SMOKE${Math.floor(Math.random() * 1e6)}`, admissionYear: 2025 },
  acceptTerms: true,
  confirmAdult: true,
  ...extra,
});

async function main() {
  await mongo.connect();
  console.log(`Smoke test against ${API} (database ${config.db.name})`);
  if (config.isProd) throw new Error('The smoke test writes data; do not run it against production.');
  if (config.db.name === 'campus_connect' && !process.env.SMOKE_ALLOW_DEV_DB) {
    throw new Error('The smoke test writes test data. Point it at campus_connect_test (see the top of this file), or set SMOKE_ALLOW_DEV_DB=1.');
  }
  // Start from a clean sign-in history and fresh rate-limit counters, so back-to-back runs do not
  // trip the protections they are testing.
  await db.collection('login_attempts').deleteMany({});
  if (config.redisUrl) {
    const redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await redis.connect();
      const keys = await redis.keys('cc:rl:*');
      if (keys.length) await redis.del(...keys);
    } catch {
      // Redis not running: limits fall back to per-process memory, which the server restart clears.
    } finally {
      redis.disconnect();
    }
  }

  // ------------------------------------------------------------------ platform
  section('Platform');
  const anon = new Client('anonymous');
  const live = await anon.get('/health/live');
  check('liveness answers', live.status === 200 && live.body.status === 'ok', live.body);
  const ready = await anon.get('/health/ready');
  check('readiness reports the database', ready.status === 200, ready.body);
  const status = await anon.get('/health/status');
  check('status hides details from anonymous callers', status.status === 200 && !('dependencies' in status.body), status.body);
  check('every response carries a request id', Boolean(live.headers.get('x-request-id')));
  check('security headers are set', live.headers.get('x-content-type-options') === 'nosniff' && Boolean(live.headers.get('content-security-policy')));
  const missing = await anon.get('/v1/definitely-not-here');
  check('unknown routes get the 404 envelope', missing.status === 404 && missing.body?.error?.code === 'NOT_FOUND', missing.body);
  const badJson = await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
  check('malformed JSON is a 400 with the error envelope', badJson.status === 400 && ((await badJson.json()) as any).error?.code === 'BAD_REQUEST');
  const foreign = await anon.post('/v1/auth/login', { email: EMAIL.riya, password: PASSWORD }, { origin: 'https://evil.example' });
  check('state-changing requests from other sites are refused', foreign.status === 403 && foreign.body.error.code === 'CSRF_FAILED', foreign.body);
  const colleges = await anon.get('/v1/meta/colleges');
  check('the sign-up form lists the colleges to choose from', colleges.status === 200 && colleges.body.items?.some((c: any) => c.shortName === 'CSMSS'), colleges.body);
  const collegeId = colleges.body.items?.[0]?.id;

  // ------------------------------------------------------------------ auth
  section('Auth and roles');
  const riya = new Client('riya');
  const wrong = await riya.login(EMAIL.riya, 'not-the-password-123');
  check('wrong password is a generic 401', wrong.status === 401 && wrong.body.error.code === 'INVALID_CREDENTIALS', wrong.body);
  const unknown = await anon.post('/v1/auth/login', { email: 'nobody@example.org', password: 'whatever-123456' });
  check('unknown email gives the same answer', unknown.status === 401 && unknown.body.error.message === wrong.body.error.message);
  const invalid = await anon.post('/v1/auth/login', { email: 'not-an-email', password: '' });
  check('validation errors list the fields', invalid.status === 400 && invalid.body.error.code === 'VALIDATION_FAILED' && Array.isArray(invalid.body.error.details), invalid.body);

  const ok = await riya.login(EMAIL.riya);
  check('student signs in', ok.status === 200 && ok.body.user?.email === EMAIL.riya, ok.body);
  check('session cookie is httpOnly', Boolean(riya.cookies.get(config.cookies.sessionName)));
  check('web sign-in does not expose the token in the body', ok.body && !('token' in ok.body));
  const session = await riya.get('/v1/auth/session');
  check('session endpoint returns the person', session.body.user?.profile?.username === 'riya.d', session.body);
  const noCsrf = await riya.post('/v1/auth/logout-all', {}, { 'x-csrf-token': '' });
  check('cookie requests without the CSRF token are refused', noCsrf.status === 403 && noCsrf.body.error.code === 'CSRF_FAILED', noCsrf.body);
  const sessions = await riya.get('/v1/auth/sessions');
  check('active sessions are listed with the current one marked', sessions.status === 200 && sessions.body.items.some((s: any) => s.current), sessions.body);

  const phone = new Client('riya-mobile', true);
  const mobile = await phone.login(EMAIL.riya);
  check('mobile sign-in returns a bearer token', mobile.status === 200 && typeof mobile.body.token === 'string' && phone.cookies.size === 0, mobile.body);
  const mobileSession = await phone.get('/v1/auth/session');
  check('bearer token authenticates', mobileSession.body.user?.email === EMAIL.riya);

  const anyEmail = await anon.post('/v1/auth/register', studentSignup(`any.${Date.now()}@example.org`, 'a-long-pass-phrase-9', 'Any Email', { collegeId }));
  check('any email address can sign up (no college email needed)', anyEmail.status === 202 && anyEmail.body.status === 'check_email', anyEmail.body);
  const badCollege = await anon.post('/v1/auth/register', studentSignup(`nocollege.${Date.now()}@example.org`, 'a-long-pass-phrase-9', 'No College', { collegeId: '00000000-0000-7000-8000-000000000000' }));
  check('an unknown college is refused with a field message', badCollege.status === 400 && badCollege.body.error.details?.[0]?.field === 'collegeId', badCollege.body);
  const noTerms = await anon.post('/v1/auth/register', studentSignup('x1@example.org', 'a-long-pass-phrase-9', 'X One', { acceptTerms: false }));
  check('terms must be accepted', noTerms.status === 400 && noTerms.body.error.details?.[0]?.field === 'acceptTerms', noTerms.body);
  const weak = await anon.post('/v1/auth/register', studentSignup('x2@example.org', 'password123', 'X Two'));
  check('weak passwords are refused with reasons', weak.status === 422 && weak.body.error.code === 'WEAK_PASSWORD', weak.body);
  const noPrn = await anon.post('/v1/auth/register', { ...studentSignup('x3@example.org', 'a-long-pass-phrase-9', 'X Three'), roleInfo: {} });
  check('students are asked for their enrolment number', noPrn.status === 400 && noPrn.body.error.details?.some((d: any) => d.field === 'roleInfo.enrollmentNumber'), noPrn.body);
  const noOrg = await anon.post('/v1/auth/register', { ...studentSignup('x4@example.org', 'a-long-pass-phrase-9', 'X Four'), role: 'expert', roleInfo: { designation: 'Engineer' } });
  check('experts are asked for their organisation', noOrg.status === 400 && noOrg.body.error.details?.some((d: any) => d.field === 'roleInfo.organization'), noOrg.body);

  const newEmail = `smoke.${Date.now()}@example.org`;
  const since = new Date(Date.now() - 5_000);
  const reg = await anon.post('/v1/auth/register', studentSignup(newEmail, 'smoke-test-pass-2026', 'Smoke Tester'));
  check('sign-up answers "check your email"', reg.status === 202 && reg.body.status === 'check_email', reg.body);
  const pending = await anon.post('/v1/auth/login', { email: newEmail, password: 'smoke-test-pass-2026' });
  check('an unverified account is asked to verify', pending.status === 403 && pending.body.error.code === 'EMAIL_NOT_VERIFIED', pending.body);
  const again = await anon.post('/v1/auth/register', studentSignup(EMAIL.riya, 'smoke-test-pass-2026', 'Riya Again'));
  check('sign-up with an existing email gives the same answer', again.status === 202 && again.body.status === 'check_email');
  const verifyToken = tokenIn(await latestEmail(newEmail, 'verify_email', since));
  check('verification email is delivered (dev mailbox)', Boolean(verifyToken));
  const fresh = new Client('fresh');
  const verified = await fresh.post('/v1/auth/verify-email', { token: verifyToken });
  check('verifying the email signs the person in', verified.status === 200 && verified.body.user?.status === 'active', verified.body);
  const reused = await anon.post('/v1/auth/verify-email', { token: verifyToken });
  check('verification links work only once', reused.status === 410 && reused.body.error.code === 'GONE', reused.body);

  const forgotSince = new Date(Date.now() - 1_000);
  const forgot = await anon.post('/v1/auth/forgot-password', { email: newEmail });
  check('forgot-password answers generically', forgot.status === 202);
  const resetToken = tokenIn(await latestEmail(newEmail, 'reset_password', forgotSince));
  check('reset email is delivered', Boolean(resetToken));
  const reset = await anon.post('/v1/auth/reset-password', { token: resetToken, password: 'a-brand-new-pass-2026' });
  check('password reset works', reset.status === 200, reset.body);
  const oldSession = await fresh.get('/v1/auth/session');
  check('reset signs out existing sessions', oldSession.body.user === null, oldSession.body);
  const relogin = await fresh.login(newEmail, 'a-brand-new-pass-2026');
  check('new password signs in', relogin.status === 200, relogin.body);
  const changed = await fresh.post('/v1/auth/change-password', { currentPassword: 'a-brand-new-pass-2026', newPassword: 'another-new-pass-2026' });
  check('change password keeps this session', changed.status === 200 && (await fresh.get('/v1/auth/session')).body.user !== null, changed.body);

  const lockEmail = `lock.${Date.now()}@example.org`;
  for (let i = 0; i < 5; i++) await anon.post('/v1/auth/login', { email: lockEmail, password: `wrong-guess-${i}-xx` });
  const locked = await anon.post('/v1/auth/login', { email: lockEmail, password: 'wrong-guess-final' });
  check('repeated wrong guesses lock sign-in for that email', locked.status === 429 && Boolean(locked.headers.get('retry-after')), locked.body);

  const out = await fresh.post('/v1/auth/logout');
  check('sign out clears the session', out.status === 200 && (await fresh.get('/v1/auth/session')).body.user === null);

  await moduleChecks({ riya, anon });

  console.log(`\n${passes} passed, ${failures} failed`);
  await mongo.close();
  process.exit(failures ? 1 : 0);
}

// ------------------------------------------------------------------ helpers for module checks
const run = Date.now().toString(36);
const uid = (label: string) => `${label}-${run}-${Math.random().toString(36).slice(2, 8)}`;

async function signedIn(email: string): Promise<Client> {
  const c = new Client(email);
  const res = await c.login(email);
  if (res.status !== 200) throw new Error(`could not sign in ${email}: ${JSON.stringify(res.body)}`);
  return c;
}

/** Registers and verifies a brand-new account through the real email flow. */
async function newAccount(name: string, signup: Record<string, unknown> = {}): Promise<{ client: Client; email: string; password: string }> {
  const email = `${name}.${run}@example.org`;
  const password = `smoke-${run}-pass-2026`;
  const since = new Date(Date.now() - 5_000);
  const anon = new Client('anon');
  await anon.post('/v1/auth/register', { ...studentSignup(email, password, `Smoke ${name}`), ...signup });
  const token = tokenIn(await latestEmail(email, 'verify_email', since));
  const client = new Client(email);
  await client.post('/v1/auth/verify-email', { token });
  return { client, email, password };
}

async function upload(c: Client, purpose: string, name: string, bytes: Buffer, type: string): Promise<Res> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type }), name);
  return c.req('POST', `/v1/files?purpose=${purpose}`, form);
}

function waitFor<T>(ws: WebSocket, predicate: (msg: any) => T | undefined, ms = 5_000): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMessage);
      resolve(null);
    }, ms);
    function onMessage(e: MessageEvent) {
      let msg: unknown;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      const hit = predicate(msg);
      if (hit !== undefined) {
        clearTimeout(timer);
        ws.removeEventListener('message', onMessage);
        resolve(hit);
      }
    }
    ws.addEventListener('message', onMessage);
  });
}

/** Signatures of the four export formats: ZIP for xlsx/docx, %PDF for pdf, a BOM for csv. */
const looksLike = (format: string, raw?: Buffer) =>
  Boolean(raw) &&
  (format === 'pdf' ? raw!.subarray(0, 5).toString('latin1') === '%PDF-' : format === 'csv' ? raw![0] === 0xef && raw![1] === 0xbb : raw![0] === 0x50 && raw![1] === 0x4b);

async function moduleChecks({ riya, anon }: { riya: Client; anon: Client }): Promise<void> {
  const [pooja, sanket, aditi, vishwajeet, sneha, tejas, admin, admin2, moderator, faculty, expert] = (await Promise.all(
    [EMAIL.pooja, EMAIL.sanket, EMAIL.aditi, EMAIL.vishwajeet, EMAIL.sneha, EMAIL.tejas, EMAIL.admin, EMAIL.admin2, EMAIL.moderator, EMAIL.faculty, EMAIL.expert].map((e) => signedIn(e)),
  )) as [Client, Client, Client, Client, Client, Client, Client, Client, Client, Client, Client];
  const me = async (c: Client) => (await c.get('/v1/me')).body.user;
  const riyaMe = await me(riya);
  const poojaMe = await me(pooja);
  const sanketMe = await me(sanket);

  // ---------------------------------------------------------------- roles
  section('Roles at sign-in');
  const roles = await Promise.all([riya, faculty, expert, moderator, admin].map(me));
  check('each seeded person signs in with their role', roles.map((r) => r.role).join(',') === 'student,faculty,expert,moderator,admin', roles.map((r) => r.role));
  const pendingFaculty = await signedIn(EMAIL.pendingFaculty);
  const pf = await me(pendingFaculty);
  check('a faculty sign-up waits for approval (student access meanwhile)', pf.role === 'student' && pf.pendingRole === 'faculty', pf);
  check('and cannot publish notices yet', (await pendingFaculty.post('/v1/announcements', { title: 'Not yet', body: 'x' })).status === 403);
  const roleQueue = await admin.get('/v1/admin/verifications?kind=faculty_role');
  const meenalReq = roleQueue.body.items?.find((v: any) => v.person.username === 'meenal.rao');
  check('admins see role requests with the details given at sign-up', Boolean(meenalReq) && meenalReq.roleInfo?.employeeId === 'CSMSS-F-0466', meenalReq);
  check('moderators cannot grant faculty access', (await moderator.post(`/v1/admin/verifications/${meenalReq?.id}/decision`, { decision: 'approve' })).status === 403);
  const granted = await admin.post(`/v1/admin/verifications/${meenalReq?.id}/decision`, { decision: 'approve' });
  const pfAfter = await me(pendingFaculty);
  check('approving makes them faculty right away', granted.status === 200 && pfAfter.role === 'faculty' && pfAfter.pendingRole === null, pfAfter);
  const facultySignup = await newAccount('newfaculty', { role: 'faculty', roleInfo: { employeeId: `CSMSS-F-${run.slice(-4)}`, designation: 'Assistant Professor' } });
  const nf = await me(facultySignup.client);
  check('signing up as faculty records the request', nf.role === 'student' && nf.pendingRole === 'faculty', nf);
  const expertSignup = await newAccount('newexpert', { role: 'expert', roleInfo: { organization: 'Infosys', designation: 'Engineering Manager' } });
  const ne = await me(expertSignup.client);
  check('experts join with any email and wait for approval', ne.role === 'student' && ne.pendingRole === 'expert' && ne.email.endsWith('@example.org'), ne);

  // ---------------------------------------------------------------- people & settings
  section('People, profile and settings');
  const meRes = await riya.get('/v1/me');
  check('my account comes with resolved feature flags', meRes.status === 200 && meRes.body.flags['module.feed'] === true, meRes.body);
  const headline = `Smoke run ${run}`;
  const patched = await riya.patch('/v1/me/profile', { headline, skills: ['React', 'TypeScript', 'SQL'] });
  check('editing my profile saves it', patched.status === 200 && patched.body.user.profile.headline === headline, patched.body);
  const taken = await riya.patch('/v1/me/profile', { username: 'pooja.kale' });
  check('a taken username is refused with a field message', taken.status === 400 && taken.body.error.details?.[0]?.field === 'username', taken.body);
  const dir = await riya.get('/v1/users?q=pooja');
  check('the directory finds people by name', dir.status === 200 && dir.body.items.some((p: any) => p.username === 'pooja.kale'), dir.body);
  const profile = await riya.get('/v1/users/pooja.kale');
  check('a profile shows follow state and counts', profile.status === 200 && typeof profile.body.isFollowing === 'boolean' && profile.body.followersCount >= 1, profile.body);
  await riya.del(`/v1/users/${poojaMe.id}/follow`);
  const follow = await riya.post(`/v1/users/${poojaMe.id}/follow`);
  check('following someone works', follow.status === 200 && follow.body.following === true, follow.body);
  const followers = await riya.get(`/v1/users/${poojaMe.id}/followers`);
  check('followers list includes me', followers.body.items?.some((p: any) => p.username === 'riya.d'), followers.body);
  await riya.post(`/v1/users/${(await me(aditi)).id}/block`);
  const hidden = await aditi.get('/v1/users/riya.d');
  check('blocking hides each profile from the other', hidden.status === 404, hidden.body);
  await riya.del(`/v1/users/${(await me(aditi)).id}/block`);
  check('unblocking restores it', (await aditi.get('/v1/users/riya.d')).status === 200);
  const prefs = await riya.put('/v1/me/notification-preferences', { inApp: { like: true, security: false }, emailDigest: 'weekly' });
  const prefsRead = await riya.get('/v1/me/notification-preferences');
  check('notification preferences save (security alerts stay on)', prefs.status === 200 && prefsRead.body.inApp.security === true && prefsRead.body.emailDigest === 'weekly', prefsRead.body);
  const settings = await riya.patch('/v1/me/settings', { theme: 'night', font: 'readable', textSize: 'lg', onboarding: 'completed', tour: 'skipped', seenAdd: ['/campus/careers', '/campus/living'] });
  check('appearance, onboarding and tour progress save', settings.status === 200 && settings.body.theme === 'night' && settings.body.font === 'readable' && settings.body.onboarding.completed && settings.body.tour.skipped && settings.body.seen.includes('/campus/careers'), settings.body);
  await riya.patch('/v1/me/settings', { theme: 'system', font: 'handwritten', textSize: 'md' });
  check('the removed "dusk" theme is refused', (await riya.patch('/v1/me/settings', { theme: 'dusk' })).status === 400);
  const badFont = await riya.patch('/v1/me/settings', { font: 'comic-sans' });
  check('unknown font choices are refused', badFont.status === 400, badFont.body);
  const consent = await anon.post('/v1/consents', { anonymousId: `anon_${run}`, policyVersion: '2026-10-20', choices: { preferences: true, analytics: false, marketing: false } });
  check('cookie choices are recorded without signing in', consent.status === 200, consent.body);
  const activity = await riya.get('/v1/me/security');
  check('sign-in activity is listed', activity.status === 200 && Array.isArray(activity.body.recentAttempts), activity.body);

  // ---------------------------------------------------------------- files
  section('Files');
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#3355cc' } }).png().toBuffer();
  const up = await upload(riya, 'post', 'campus photo.png', png, 'image/png');
  check('an image uploads with a thumbnail and signed link', up.status === 201 && up.body.kind === 'image' && Boolean(up.body.url) && Boolean(up.body.thumbnailUrl), up.body);
  const bytes = up.body.url ? await fetch(up.body.url) : null;
  check('the signed link serves the image with safe headers', bytes?.status === 200 && bytes.headers.get('content-type') === 'image/png' && bytes.headers.get('x-content-type-options') === 'nosniff');
  const ranged = up.body.url ? await fetch(up.body.url, { headers: { range: 'bytes=0-99' } }) : null;
  check('byte ranges work (video and audio seeking)', ranged?.status === 206 && ranged.headers.get('content-range')?.startsWith('bytes 0-99/') === true);
  const tampered = up.body.url ? await fetch(up.body.url.replace(/sig=[^&]+/, 'sig=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')) : null;
  check('a tampered link is refused', tampered?.status === 410);
  const exe = await upload(riya, 'post', 'notes.pdf', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 1)]), 'application/pdf');
  check('a program renamed to .pdf is refused (type is read from the bytes)', exe.status === 415, exe.body);
  const html = await upload(riya, 'resource', 'page.txt', Buffer.from('<html><script>alert(1)</script></html>'), 'text/plain');
  check('plain text is accepted but stored as text, never as a web page', html.status === 201 && html.body.mimeType === 'text/plain', html.body);
  const wrongPurpose = await upload(riya, 'avatar', 'notes.txt', Buffer.from('just some notes for class'), 'text/plain');
  check('each purpose allows only its own kinds (no documents as avatars)', wrongPurpose.status === 415, wrongPurpose.body);

  // ---------------------------------------------------------------- feed
  section('Feed');
  const seededFeed = await sneha.get('/v1/feed?limit=50');
  check('the feed shows real seeded posts with authors and counts', seededFeed.status === 200 && seededFeed.body.items.length >= 8 && seededFeed.body.items.some((p: any) => p.likesCount >= 3), seededFeed.body.items?.length);
  const post = await riya.post('/v1/posts', { body: `Smoke post ${run} with a photo @pooja.kale`, tags: ['smoke'], attachments: [up.body.id] });
  check('a post with an attachment is published', post.status === 201 && post.body.attachments.length === 1 && post.body.isMine, post.body);
  const feed = await pooja.get('/v1/feed?limit=50');
  check('it appears in other people’s feeds', feed.status === 200 && feed.body.items.some((p: any) => p.id === post.body.id), feed.body?.items?.length);
  let page = await pooja.get('/v1/feed?limit=5');
  let pages = 1;
  const seen = new Set<string>(page.body.items.map((p: any) => p.id));
  while (page.body.nextCursor && pages < 20) {
    page = await pooja.get(`/v1/feed?limit=5&cursor=${encodeURIComponent(page.body.nextCursor)}`);
    page.body.items.forEach((p: any) => seen.add(p.id));
    pages++;
  }
  check('paging the feed ends (no endless loop) without repeats', page.body.nextCursor === null && pages < 20 && seen.size >= 10, { pages, seen: seen.size });
  const like = await pooja.put(`/v1/posts/${post.body.id}/like`);
  check('liking counts once', like.body.liked && like.body.likesCount === 1 && (await pooja.put(`/v1/posts/${post.body.id}/like`)).body.likesCount === 1, like.body);
  const unlike = await pooja.del(`/v1/posts/${post.body.id}/like`);
  await pooja.put(`/v1/posts/${post.body.id}/like`);
  check('unliking lowers the count', unlike.body.likesCount === 0, unlike.body);
  const comment = await pooja.post(`/v1/posts/${post.body.id}/comments`, { body: 'Lovely shot!' });
  const reply = await riya.post(`/v1/posts/${post.body.id}/comments`, { body: 'Thank you!', parentId: comment.body.id });
  const comments = await riya.get(`/v1/posts/${post.body.id}/comments`);
  check('comments and replies are threaded', comment.status === 201 && reply.status === 201 && comments.body.items.some((c: any) => c.parentId === comment.body.id), comments.body);
  check('the comment count follows', (await riya.get(`/v1/posts/${post.body.id}`)).body.commentsCount === 2);
  const edit = await riya.patch(`/v1/posts/${post.body.id}`, { body: `Smoke post ${run} (edited)` });
  check('authors can edit their post', edit.status === 200 && edit.body.body.endsWith('(edited)'), edit.body);
  const notMine = await pooja.patch(`/v1/posts/${post.body.id}`, { body: 'hijack' });
  check('others cannot edit it', notMine.status === 404, notMine.body);
  const poll = await riya.post('/v1/posts', { body: 'Best day for the hackathon?', kind: 'poll', poll: { options: ['Saturday', 'Sunday'] } });
  const vote = await pooja.put(`/v1/posts/${poll.body.id}/vote`, { optionId: poll.body.poll.options[1].id });
  const revote = await pooja.put(`/v1/posts/${poll.body.id}/vote`, { optionId: poll.body.poll.options[0].id });
  check('poll votes count once and can be changed', vote.body.totalVotes === 1 && revote.body.totalVotes === 1 && revote.body.myVote === poll.body.poll.options[0].id && revote.body.options[0].votes === 1 && revote.body.options[1].votes === 0, revote.body);
  const deptPost = await vishwajeet.post('/v1/posts', { body: 'Computer department only: lab moved to room 304', audience: 'department' });
  check('department posts are visible to that department', (await riya.get(`/v1/posts/${deptPost.body.id}`)).status === 200);
  check('and hidden from other departments', (await aditi.get(`/v1/posts/${deptPost.body.id}`)).status === 404);
  const anonPost = await sneha.post('/v1/posts', { body: `Anonymous smoke question ${run}`, kind: 'question', anonymous: true });
  const anonView = await riya.get(`/v1/posts/${anonPost.body.id}`);
  check('anonymous posts never include the author', anonPost.status === 201 && anonView.body.author === null && anonView.body.anonymous && !anonView.body.isMine, anonView.body);
  check('the author still sees it as theirs', (await sneha.get(`/v1/posts/${anonPost.body.id}`)).body.isMine === true);
  const opReply = await sneha.post(`/v1/posts/${anonPost.body.id}/comments`, { body: 'Thanks everyone (OP)' });
  check('the anonymous author replies anonymously ("original poster")', opReply.status === 201 && opReply.body.author === null && opReply.body.byOriginalPoster, opReply.body);
  const studentNotice = await riya.post('/v1/posts', { body: 'Official notice', kind: 'announcement' });
  check('students cannot post announcements', studentNotice.status === 403, studentNotice.body);
  const scopes = await Promise.all(['following', 'campus', 'class'].map((s) => riya.get(`/v1/feed?scope=${s}`)));
  check('feed filters (following, campus, class) work', scopes.every((s) => s.status === 200), scopes.map((s) => s.status));
  const tagged = await riya.get('/v1/feed?scope=tag&tag=smoke');
  check('tag filter finds tagged posts', tagged.body.items?.some((p: any) => p.id === post.body.id), tagged.body);
  const saved = await sanket.put(`/v1/saved/post/${post.body.id}`);
  check('saving a post works and is counted', [200, 201].includes(saved.status) && (await sanket.get(`/v1/posts/${post.body.id}`)).body.saved === true, saved.body);

  // ---------------------------------------------------------------- notifications
  section('Notifications');
  const bell = await riya.get('/v1/notifications?limit=50');
  check('likes and comments create notifications', ['like', 'comment'].every((k) => bell.body.items.some((n: any) => n.kind === k)), bell.body.items?.map((n: any) => n.kind));
  const mention = await pooja.get('/v1/notifications?limit=50');
  check('@mentions notify the person mentioned', mention.body.items.some((n: any) => n.kind === 'mention'), mention.body.items?.map((n: any) => n.kind));
  const unread = await riya.get('/v1/notifications/unread-count');
  await riya.post('/v1/notifications/read', { all: true });
  const after = await riya.get('/v1/notifications/unread-count');
  check('the badge counts unread and clears when read', unread.body.count > 0 && after.body.count === 0, { before: unread.body, after: after.body });

  // ---------------------------------------------------------------- spaces & discussions
  section('Spaces and discussions');
  const spaces = await riya.get('/v1/spaces');
  check('spaces are listed by size', spaces.status === 200 && spaces.body.items.length >= 5 && spaces.body.items[0].membersCount >= spaces.body.items.at(-1).membersCount, spaces.body.items?.length);
  const mySpaces = await riya.get('/v1/spaces?mine=true');
  const notMineSpaces = await riya.get('/v1/spaces?mine=false');
  check('"my spaces" filters, and mine=false does not', mySpaces.body.items.every((s: any) => s.membership?.status === 'active') && notMineSpaces.body.items.length >= mySpaces.body.items.length, [mySpaces.body.items.length, notMineSpaces.body.items.length]);
  const gdsc = await riya.get('/v1/spaces/gdsc');
  check('a space opens by its address', gdsc.status === 200 && gdsc.body.canRead, gdsc.body);
  const proposed = await riya.post('/v1/spaces', { name: `Smoke Club ${run}`, kind: 'club', description: 'Testing' });
  check('student-created spaces wait for approval', proposed.status === 201 && proposed.body.status === 'pending', proposed.body);
  const disc = await riya.post(`/v1/spaces/${gdsc.body.id}/discussions`, { title: `Smoke discussion ${run}`, body: 'What should the next study jam cover?', flair: 'Question' });
  check('members can start a discussion', disc.status === 201, disc.body);
  const discReply = await pooja.post(`/v1/discussions/${disc.body.id}/replies`, { body: 'Kubernetes basics please!' });
  const nested = await riya.post(`/v1/discussions/${disc.body.id}/replies`, { body: 'Good idea', parentId: discReply.body.id });
  check('replies nest under each other', discReply.status === 201 && nested.status === 201 && nested.body.depth === 1, nested.body);
  const dv = await pooja.put(`/v1/discussions/${disc.body.id}/vote`, { value: 1 });
  const dv2 = await sanket.put(`/v1/discussions/${disc.body.id}/vote`, { value: -1 });
  const undo = await sanket.put(`/v1/discussions/${disc.body.id}/vote`, { value: 0 });
  check('votes add up and can be undone', dv.body.score === 1 && dv2.body.score === 0 && undo.body.score === 1, [dv.body, dv2.body, undo.body]);
  const board = await riya.get(`/v1/spaces/${gdsc.body.id}/discussions?sort=top`);
  check('the board lists discussions (pinned first, then by votes)', board.body.items?.[0]?.pinned === true && board.body.items.some((t: any) => t.id === disc.body.id), board.body);
  check('reply counts are kept', (await riya.get(`/v1/discussions/${disc.body.id}`)).body.commentsCount === 2);
  const priv = await riya.get('/v1/spaces/te-comp-b');
  const ask = await pooja.post(`/v1/spaces/${priv.body.id}/join`);
  check('private spaces need approval to join', ask.body.status === 'pending', ask.body);
  const approve = await faculty.post(`/v1/spaces/${priv.body.id}/members/${poojaMe.id}`, { action: 'approve' });
  const joined = await pooja.get(`/v1/spaces/${priv.body.id}`);
  check('owners approve join requests', approve.status === 200 && joined.body.membership?.status === 'active', joined.body.membership);
  const leave = await pooja.del(`/v1/spaces/${priv.body.id}/membership`);
  check('members can leave', leave.status === 200);
  const outsider = await aditi.get(`/v1/spaces/${priv.body.id}/discussions`);
  check('non-members cannot read a private board', outsider.status === 403, outsider.body);
  const notOwnerLock = await riya.patch(`/v1/discussions/${disc.body.id}`, { locked: true });
  check('only space owners and moderators can lock', notOwnerLock.status === 403, notOwnerLock.body);
  const lock = await pooja.patch(`/v1/discussions/${disc.body.id}`, { locked: true });
  const lockedReply = await sanket.post(`/v1/discussions/${disc.body.id}/replies`, { body: 'Can I still reply?' });
  check('a space owner can lock a discussion', lock.status === 200 && lockedReply.status === 409, lockedReply.body);
  const across = await riya.get('/v1/discussions?sort=top&limit=10');
  check('discussions across my spaces are listed for Home', across.status === 200 && across.body.items.length >= 3, across.body.items?.length);

  // ---------------------------------------------------------------- events
  section('Events');
  const events = await riya.get('/v1/events');
  check('upcoming events are listed soonest first', events.status === 200 && events.body.items.length >= 3 && new Date(events.body.items[0].startsAt) <= new Date(events.body.items[1].startsAt), events.body.items?.length);
  const workshop = events.body.items.find((e: any) => e.title === 'Line Follower Workshop');
  const going = await riya.put(`/v1/events/${workshop.id}/rsvp`, { status: 'going' });
  check('RSVP takes a seat', going.status === 200 && going.body.spotsLeft === 0, going.body);
  const full = await sanket.put(`/v1/events/${workshop.id}/rsvp`, { status: 'going' });
  check('a full event refuses more seats (EVENT_FULL)', full.status === 409 && full.body.error.code === 'EVENT_FULL', full.body);
  const interested = await sanket.put(`/v1/events/${workshop.id}/rsvp`, { status: 'interested' });
  check('"interested" is still possible when full', interested.status === 200, interested.body);
  const racers = await Promise.all([tejas, vishwajeet].map((c) => c.put(`/v1/events/${workshop.id}/rsvp`, { status: 'going' })));
  check('two people racing for no seats both get EVENT_FULL', racers.every((r) => r.status === 409), racers.map((r) => r.status));
  const code = await riya.get(`/v1/events/${workshop.id}/check-in-code`);
  const checkin = await aditi.post(`/v1/events/${workshop.id}/check-in`, { qr: code.body.qr });
  check('organisers check people in with the rotating QR code', code.status === 200 && checkin.status === 200 && checkin.body.person.username === 'riya.d', checkin.body);
  const forged = await aditi.post(`/v1/events/${workshop.id}/check-in`, { qr: code.body.qr.replace(/:[A-Za-z0-9_-]{10}$/, ':AAAAAAAAAA') });
  check('a forged check-in code is refused', forged.status === 410, forged.body);
  const notOrganiser = await sanket.post(`/v1/events/${workshop.id}/check-in`, { qr: code.body.qr });
  check('only organisers can check people in', notOrganiser.status === 403);
  const ics = await fetch(`${API}/v1/events/${workshop.id}/calendar.ics`, { headers: { cookie: [...riya.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } });
  check('events export to calendars (.ics)', ics.status === 200 && (ics.headers.get('content-type') ?? '').startsWith('text/calendar') && (await ics.text()).includes('BEGIN:VEVENT'));
  const start = new Date(Date.now() + 10 * 86400_000);
  const studentEvent = await riya.post('/v1/events', { title: `Smoke meetup ${run}`, category: 'meetup', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600_000).toISOString(), venue: 'Canteen', capacity: 20 });
  check('student events wait for approval', studentEvent.status === 201 && studentEvent.body.status === 'pending', studentEvent.body);
  const badDates = await admin.post('/v1/events', { title: 'Backwards event', category: 'meetup', startsAt: start.toISOString(), endsAt: start.toISOString(), venue: 'Hall', capacity: 5 });
  check('events must end after they start', badDates.status === 400, badDates.body);

  // ---------------------------------------------------------------- announcements
  section('Announcements');
  const studentAnn = await riya.post('/v1/announcements', { title: 'Not allowed', body: 'x' });
  check('students cannot publish notices', studentAnn.status === 403);
  const ann = await faculty.post('/v1/announcements', { title: `Smoke notice ${run}`, body: 'Lab timings changed for this week.', category: 'notice' });
  check('faculty publish notices and everyone is notified at once', ann.status === 201 && ann.body.notified > 5, ann.body);
  const board2 = await riya.get('/v1/announcements');
  check('the notice board shows it, pinned notices first', board2.body.items[0]?.pinned === true && board2.body.items.some((a: any) => a.id === ann.body.id));
  const yearNotice = (await aditi.get('/v1/announcements')).body.items.some((a: any) => a.title === 'Second-year lab batches revised');
  const notForRiya = (await riya.get('/v1/announcements')).body.items.some((a: any) => a.title === 'Second-year lab batches revised');
  check('year notices reach only that year', yearNotice && !notForRiya);

  // ---------------------------------------------------------------- opportunities
  section('Opportunities');
  const opps = await riya.get('/v1/opportunities?eligibleOnly=true');
  check('open opportunities are listed with eligibility', opps.status === 200 && opps.body.items.length >= 2 && opps.body.items.every((o: any) => o.eligibility.eligible), opps.body.items?.length);
  const mentorship = (await riya.get('/v1/opportunities?q=mentorship')).body.items[0];
  await db.collection('applications').deleteMany({ opportunityId: mentorship.id, userId: riyaMe.id });
  const apply = await riya.post(`/v1/opportunities/${mentorship.id}/apply`, { note: 'Excited to learn' });
  check('applying is recorded', apply.status === 201 && apply.body.stage === 'applied', apply.body);
  check('applying twice is refused', (await riya.post(`/v1/opportunities/${mentorship.id}/apply`, {})).status === 409);
  const applicants = await expert.get(`/v1/opportunities/${mentorship.id}/applicants`);
  check('the expert who posted it sees applicants', applicants.status === 200 && applicants.body.items.some((a: any) => a.person.username === 'riya.d'), applicants.body);
  const stage = await expert.patch(`/v1/applications/${apply.body.id}`, { stage: 'shortlisted' });
  const tracker = await riya.get('/v1/me/applications');
  check('posters move candidates along and the tracker updates', stage.status === 200 && tracker.body.items.some((a: any) => a.id === apply.body.id && a.stage === 'shortlisted'), tracker.body);
  const technova = (await aditi.get('/v1/opportunities?q=TechNova')).body.items[0];
  const ineligible = technova ? await aditi.post(`/v1/opportunities/${technova.id}/apply`, {}) : null;
  check('people who are not eligible cannot apply', ineligible?.status === 403, ineligible?.body);
  const expertPost = await expert.post('/v1/opportunities', { orgName: 'Razorpay', title: `Smoke referral ${run}`, kind: 'job', mode: 'remote', location: 'Remote', deadline: new Date(Date.now() + 9 * 86400_000).toISOString(), description: 'Testing' });
  check('experts publish opportunities without review', expertPost.status === 201 && expertPost.body.status === 'published', expertPost.body);

  // ---------------------------------------------------------------- shelf & lectures
  section('Shelf and lectures');
  const filters = await riya.get('/v1/resources/filters');
  check('the shelf starts from filters built from its contents', filters.status === 200 && filters.body.total >= 4 && filters.body.departments.length === 6 && filters.body.subjects.length >= 3, filters.body);
  const comp = filters.body.departments.find((d: any) => d.code === 'COMP');
  const narrowed = await riya.get(`/v1/resources/filters?departmentId=${comp.id}&semester=5`);
  check('choosing a department and semester narrows the subjects', narrowed.body.subjects.every((s: any) => s.count > 0) && narrowed.body.subjects.some((s: any) => s.name === 'Operating Systems'), narrowed.body.subjects);
  const osSubject = narrowed.body.subjects.find((s: any) => s.name === 'Operating Systems');
  const shelf = await riya.get(`/v1/resources?subjectId=${osSubject.id}`);
  check('then the notes for that subject are listed', shelf.status === 200 && shelf.body.items.length >= 1 && shelf.body.items.every((r: any) => r.status === 'approved' && r.subject === 'Operating Systems'), shelf.body);
  const seededNote = shelf.body.items[0];
  const noteFile = await sanket.post(`/v1/resources/${seededNote.id}/download`);
  const pdfBytes = noteFile.body.url ? Buffer.from(await (await fetch(noteFile.body.url)).arrayBuffer()) : null;
  check('seeded notes are real PDF documents', looksLike('pdf', pdfBytes ?? undefined), noteFile.body);
  const newSubject = `Compiler Design ${run}`;
  const added = await riya.post('/v1/resources', { title: `Smoke notes ${run}`, kind: 'notes', subject: newSubject, semester: 6, departmentId: comp.id, externalUrl: 'https://developer.mozilla.org/' });
  check('a new subject is created while uploading (subjects are not a fixed list)', added.status === 201 && added.body.status === 'pending' && added.body.subject?.name === newSubject, added.body);
  const subjects = await pooja.get(`/v1/subjects?q=${encodeURIComponent('Compiler Design')}`);
  check('everyone sees the new subject', subjects.body.items.some((s: any) => s.name === newSubject), subjects.body);
  const dupSubject = await pooja.post('/v1/subjects', { name: newSubject.toUpperCase() });
  check('the same subject in other capitals is not duplicated', dupSubject.status === 201 && dupSubject.body.id === added.body.subject.id, dupSubject.body);
  const queue = await faculty.get('/v1/resources/review-queue');
  check('faculty see the review queue', queue.body.items?.some((r: any) => r.id === added.body.id), queue.body);
  check('students cannot open the review queue', (await riya.get('/v1/resources/review-queue')).status === 403);
  const reviewed = await faculty.post(`/v1/resources/${added.body.id}/review`, { decision: 'approve', note: 'Clear and useful' });
  check('approving publishes it', reviewed.status === 200 && (await pooja.get(`/v1/resources/${added.body.id}`)).body.status === 'approved', reviewed.body);
  const counted = (await riya.get(`/v1/subjects?q=${encodeURIComponent('Compiler Design')}`)).body.items.find((s: any) => s.name === newSubject);
  check('the subject counts its approved items', counted?.resourcesCount === 1, counted);
  const rate = await pooja.put(`/v1/resources/${added.body.id}/rating`, { rating: 5 });
  const rerate = await pooja.put(`/v1/resources/${added.body.id}/rating`, { rating: 3 });
  check('ratings average and can be changed', rate.body.rating === 5 && rerate.body.rating === 3 && rerate.body.ratingCount === 1, rerate.body);
  check('you cannot rate your own upload', (await riya.put(`/v1/resources/${added.body.id}/rating`, { rating: 5 })).status === 400);
  const dl = await pooja.post(`/v1/resources/${added.body.id}/download`);
  check('downloads give a link and are counted', dl.status === 200 && dl.body.url === 'https://developer.mozilla.org/');
  const rename = await faculty.patch(`/v1/subjects/${added.body.subject.id}`, { name: `Compiler Construction ${run}` });
  check('staff rename subjects and the items follow', rename.status === 200 && (await pooja.get(`/v1/resources/${added.body.id}`)).body.subject === `Compiler Construction ${run}`);
  check('students cannot rename subjects', (await riya.patch(`/v1/subjects/${added.body.subject.id}`, { name: 'Mine' })).status === 403);
  const lectures = await riya.get('/v1/lectures');
  const lecture = await riya.get(`/v1/lectures/${lectures.body.items[0].id}`);
  check('lectures play through a privacy-friendly embed', lecture.status === 200 && String(lecture.body.embedUrl).startsWith('https://www.youtube-nocookie.com/embed/'), lecture.body);
  const v1 = await riya.post(`/v1/lectures/${lecture.body.id}/view`);
  const v2 = await riya.post(`/v1/lectures/${lecture.body.id}/view`);
  check('views are counted once per person per hour', v1.status === 200 && v2.body.counted === false, [v1.body, v2.body]);
  check('students cannot add lectures', (await riya.post('/v1/lectures', { title: 'Mine', subject: 'OS', source: 'link', url: 'https://example.com/v' })).status === 403);

  // ---------------------------------------------------------------- hush
  section('Hush');
  const q1 = await riya.post('/v1/hush', { topic: 'placements', body: `Smoke: how did you prepare for aptitude rounds? ${run}` });
  const asOther = await pooja.get(`/v1/hush/${q1.body.id}`);
  check('Hush questions are anonymous to everyone else', q1.status === 201 && asOther.body.author === null && !asOther.body.isMine, asOther.body);
  check('the asker still sees "mine"', (await riya.get(`/v1/hush/${q1.body.id}`)).body.isMine === true);
  const answer = await pooja.post(`/v1/hush/${q1.body.id}/answers`, { body: 'IndiaBix plus one mock test a day for a month.' });
  const askerBell = await riya.get('/v1/notifications?limit=10');
  check('the asker is told about answers without learning who answered', answer.status === 201 && askerBell.body.items.some((n: any) => n.title.includes('Hush') && n.actor === null), askerBell.body.items?.slice(0, 3));
  const accept = await riya.post(`/v1/hush/${q1.body.id}/accept`, { answerId: answer.body.id });
  check('the asker can mark the helpful answer', accept.status === 200 && (await pooja.get(`/v1/hush/${q1.body.id}`)).body.acceptedAnswerId === answer.body.id);
  check('only the asker can do that', (await pooja.post(`/v1/hush/${q1.body.id}/accept`, { answerId: answer.body.id })).status === 403);
  const hv = await sanket.put(`/v1/hush/${q1.body.id}/vote`, { value: 1 });
  check('Hush votes count', hv.body.votesCount === 1, hv.body);
  const hlist = await riya.get('/v1/hush?topic=placements&sort=new');
  check('Hush filters by topic', hlist.body.items.every((x: any) => x.topic === 'placements') && hlist.body.items.some((x: any) => x.id === q1.body.id));
  check('answer counts are kept', (await riya.get(`/v1/hush/${q1.body.id}`)).body.answersCount === 1);

  // ---------------------------------------------------------------- lost & found
  section('Lost & found');
  const found = await sanket.post('/v1/lost-found', { kind: 'found', title: `Blue water bottle ${run}`, category: 'other', location: 'Library', occurredAt: new Date().toISOString(), verificationQuestion: 'What sticker is on it?' });
  const claim = await riya.post(`/v1/lost-found/${found.body.id}/claims`, { answer: 'A NASA sticker' });
  check('found items can be claimed with an answer', found.status === 201 && claim.status === 201, claim.body);
  check('the finder cannot claim their own report', (await sanket.post(`/v1/lost-found/${found.body.id}/claims`, { answer: 'mine' })).status === 400);
  const claims = await sanket.get(`/v1/lost-found/${found.body.id}/claims`);
  check('only the finder sees the claim answers', claims.body.items?.[0]?.answer === 'A NASA sticker' && (await pooja.get(`/v1/lost-found/${found.body.id}/claims`)).status === 403);
  const decided = await sanket.post(`/v1/lost-found/claims/${claim.body.id}/decision`, { decision: 'approve' });
  check('approving a claim marks the item returned', decided.status === 200 && (await riya.get(`/v1/lost-found/${found.body.id}`)).body.status === 'returned');

  // ---------------------------------------------------------------- marketplace
  section('Marketplace');
  const listingImg = await upload(riya, 'listing', 'calculator.png', png, 'image/png');
  const listing = await riya.post('/v1/listings', { title: `Casio calculator ${run}`, mode: 'sell', category: 'electronics', pricePaise: 45000, condition: 'good', location: 'Hostel B', imageFileIds: [listingImg.body.id] });
  check('listings are created with photos and a price in paise', listing.status === 201, listing.body);
  check('items for sale need a price', (await riya.post('/v1/listings', { title: 'Free price', mode: 'sell', category: 'books', condition: 'good', location: 'Library' })).status === 400);
  const browse = await pooja.get('/v1/listings?mode=sell&q=calculator');
  check('search and filters find it', browse.body.items?.some((l: any) => l.id === listing.body.id && l.images.length === 1), browse.body);
  const cheap = await pooja.get('/v1/listings?sort=price_low');
  const prices = cheap.body.items.map((l: any) => l.pricePaise ?? 0);
  check('listings sort by price', prices.every((p: number, i: number) => i === 0 || p >= prices[i - 1]), prices);
  const contact = await pooja.post(`/v1/listings/${listing.body.id}/contact`);
  check('"Contact seller" opens a chat', contact.status === 200 && Boolean(contact.body.chatId), contact.body);
  const sold = await riya.patch(`/v1/listings/${listing.body.id}`, { status: 'sold' });
  check('sellers mark items sold', sold.status === 200);

  // ---------------------------------------------------------------- chats & realtime
  section('Chats and live updates');
  const chats = await riya.get('/v1/chats');
  const dm = chats.body.items.find((c: any) => c.kind === 'direct' && c.other?.username === 'pooja.kale');
  check('my chats are listed with unread counts and previews', chats.status === 200 && Boolean(dm) && dm.lastMessage !== null, chats.body.items?.length);
  const ticket = await riya.get('/v1/realtime/ticket');
  const ws = new WebSocket(ticket.body.url);
  const readyMsg = await waitFor(ws, (m) => (m.type === 'ready' ? m : undefined));
  check('the live connection opens with a ticket', Boolean(readyMsg));
  ws.send(JSON.stringify({ type: 'subscribe', chatId: dm.id }));
  const subscribed = await waitFor(ws, (m) => (m.type === 'subscribed' ? m : undefined));
  check('subscribing to my own chat is allowed', Boolean(subscribed));
  ws.send(JSON.stringify({ type: 'subscribe', chatId: '00000000-0000-0000-0000-000000000000' }));
  const forbidden = await waitFor(ws, (m) => (m.type === 'error' ? m : undefined), 2_000);
  check('subscribing to someone else’s chat is refused', forbidden?.code === 'FORBIDDEN', forbidden);
  const clientId = uid('msg');
  const incoming = waitFor(ws, (m) => (m.type === 'message.created' && m.message?.body === `Live hello ${run}` ? m : undefined));
  const sent = await pooja.post(`/v1/chats/${dm.id}/messages`, { clientId, body: `Live hello ${run}` });
  check('a message is delivered live to the other person', sent.status === 201 && Boolean(await incoming), sent.body);
  const retry = await pooja.post(`/v1/chats/${dm.id}/messages`, { clientId, body: `Live hello ${run}` });
  check('resending after a network drop does not duplicate it', retry.status === 200 && retry.body.id === sent.body.id, retry.body);
  const unreadChats = await riya.get('/v1/chats/unread-count');
  check('the chat badge counts chats with new messages', unreadChats.body.count >= 1, unreadChats.body);
  const history = await riya.get(`/v1/chats/${dm.id}/messages`);
  check('history pages come back oldest to newest', history.body.items.at(-1)?.id === sent.body.id, history.body.items?.length);
  const react = await riya.put(`/v1/messages/${sent.body.id}/reactions`, { emoji: '👍' });
  check('reactions are added', react.status === 200 && react.body.reactions.some((r: any) => r.emoji === '👍'), react.body);
  const mine = await riya.post(`/v1/chats/${dm.id}/messages`, { clientId: uid('msg'), body: 'Typo mesage' });
  const fixed = await riya.patch(`/v1/messages/${mine.body.id}`, { body: 'Typo message' });
  check('my messages can be edited for 15 minutes', fixed.status === 200 && fixed.body.edited, fixed.body);
  check('other people’s messages cannot be edited', (await riya.patch(`/v1/messages/${sent.body.id}`, { body: 'nope' })).status === 403);
  const removed = await riya.del(`/v1/messages/${mine.body.id}`);
  check('deleting removes the text for everyone', removed.status === 200 && (await pooja.get(`/v1/chats/${dm.id}/messages`)).body.items.find((m: any) => m.id === mine.body.id)?.body === null);
  const read = await riya.post(`/v1/chats/${dm.id}/read`);
  check('marking read works', read.status === 200 && Boolean(read.body.lastReadAt));
  const group = await riya.post('/v1/chats/group', { title: `Smoke group ${run}`, memberIds: [poojaMe.id, sanketMe.id] });
  check('group chats are created with members', group.status === 201 && group.body.added === 2, group.body);
  const plan = await riya.post(`/v1/chats/${group.body.chatId}/messages`, { clientId: uid('plan'), kind: 'plan', payload: { title: 'Library at 6', place: 'Central library' } });
  const rsvpPlan = await pooja.put(`/v1/messages/${plan.body.id}/response`, { response: 'in' });
  check('plans collect "in / maybe / out" answers', plan.status === 201 && rsvpPlan.body.counts.in === 1, rsvpPlan.body);
  const settingsChat = await riya.patch(`/v1/chats/${group.body.chatId}/settings`, { pinned: true, muteHours: 8 });
  check('chats can be pinned and muted', settingsChat.status === 200 && (await riya.get(`/v1/chats/${group.body.chatId}`)).body.settings.muted === true);
  const pinnedFirst = (await riya.get('/v1/chats')).body.items[0];
  check('pinned chats come first', pinnedFirst?.id === group.body.chatId, pinnedFirst?.title);
  const outsiderChat = await aditi.get(`/v1/chats/${group.body.chatId}/messages`);
  check('non-members cannot read a chat', outsiderChat.status === 404);
  const leaveGroup = await sanket.del(`/v1/chats/${group.body.chatId}/members/${sanketMe.id}`);
  check('members can leave a group', leaveGroup.status === 200);
  ws.close();

  // ---------------------------------------------------------------- search
  section('Search');
  const search = await riya.get('/v1/search?q=cloud');
  check('one search covers events, posts and more', search.status === 200 && search.body.results.events?.length >= 1 && search.body.unavailable.length === 0, search.body.results && Object.fromEntries(Object.entries(search.body.results).map(([k, v]) => [k, (v as unknown[]).length])));
  const people = await riya.get('/v1/search?q=pooja&type=people');
  check('people search by name', people.body.results.people?.some((p: any) => p.username === 'pooja.kale'));
  const partial = await riya.get('/v1/search?q=desh&type=people');
  check('partial names match too', partial.body.results.people?.some((p: any) => p.username === 'dr.deshpande'), partial.body.results.people?.map((p: any) => p.username));
  const anonSearch = await riya.get(`/v1/search?q=${encodeURIComponent('Anonymous smoke question')}&type=posts`);
  check('anonymous posts in search never show the author', anonSearch.body.results.posts?.every((p: any) => p.author === 'Anonymous' || !p.body.includes('Anonymous smoke question')));
  check('search needs at least 2 characters', (await riya.get('/v1/search?q=a')).status === 400);

  // ---------------------------------------------------------------- reports & moderation
  section('Reports and moderation');
  const spam = await vishwajeet.post('/v1/posts', { body: `Buy followers cheap!!! ${run}` });
  const r1 = await riya.post('/v1/reports', { targetType: 'post', targetId: spam.body.id, reason: 'spam' });
  check('reporting works and duplicate reports are refused', r1.status === 201 && (await riya.post('/v1/reports', { targetType: 'post', targetId: spam.body.id, reason: 'spam' })).status === 409, r1.body);
  check('you cannot report your own post', (await vishwajeet.post('/v1/reports', { targetType: 'post', targetId: spam.body.id, reason: 'spam' })).status === 400);
  await pooja.post('/v1/reports', { targetType: 'post', targetId: spam.body.id, reason: 'spam' });
  await sanket.post('/v1/reports', { targetType: 'post', targetId: spam.body.id, reason: 'scam' });
  check('three reports hide the post until a moderator reviews it', (await aditi.get(`/v1/posts/${spam.body.id}`)).status === 404);
  const reportQueue = await moderator.get('/v1/admin/reports');
  const queued = reportQueue.body.items?.find((r: any) => r.targetId === spam.body.id);
  check('moderators see one queue entry per item, with all reasons', queued?.reports === 3 && queued.reasons.includes('scam'), queued);
  const removeSpam = await moderator.post('/v1/admin/reports/action', { targetType: 'post', targetId: spam.body.id, action: 'remove', note: 'Spam' });
  check('acting resolves every report on the item', removeSpam.status === 200 && (await riya.get('/v1/reports/mine')).body.items.some((r: any) => r.targetId === spam.body.id && r.status === 'actioned'));

  // ---------------------------------------------------------------- surveys
  section('Surveys');
  check('students cannot create surveys', (await riya.post('/v1/admin/surveys', { title: 'Mine', questions: [{ type: 'text', prompt: 'Why?' }] })).status === 403);
  const badSurvey = await admin.post('/v1/admin/surveys', { title: 'Broken', questions: [{ type: 'single', prompt: 'Pick one', options: ['Only one'] }] });
  check('choice questions need at least two options', badSurvey.status === 400, badSurvey.body);
  const survey = await admin.post('/v1/admin/surveys', {
    title: `App check-in ${run}`,
    description: 'Required before you continue.',
    category: 'app',
    compulsory: true,
    anonymous: false,
    audienceRoles: ['student'],
    publish: true,
    questions: [
      { type: 'rating', prompt: 'How useful is the app?' },
      { type: 'single', prompt: 'Which device do you use most?', options: ['Phone', 'Laptop', 'Tablet'] },
      { type: 'multiple', prompt: 'What should we build next?', options: ['Offline notes', 'Timetable', 'Bus tracker'] },
      { type: 'text', prompt: 'Anything else?', required: false },
    ],
  });
  check('admins publish a compulsory survey and its audience is notified', survey.status === 201 && survey.body.status === 'published' && survey.body.notified >= 5, survey.body);
  const pendingSurveys = await sneha.get('/v1/surveys/pending');
  const due = pendingSurveys.body.compulsory?.find((s: any) => s.id === survey.body.id);
  check('students see it at once as compulsory, with its questions', Boolean(due) && due.questions.length === 4, pendingSurveys.body);
  check('people outside the audience do not see it', !(await faculty.get('/v1/surveys/pending')).body.compulsory?.some((s: any) => s.id === survey.body.id));
  const qs = due.questions;
  const missingRequired = await sneha.post(`/v1/surveys/${survey.body.id}/responses`, { answers: { [qs[0].id]: 4 } });
  check('required questions must be answered', missingRequired.status === 400 && missingRequired.body.error.details?.some((d: any) => d.field === qs[1].id), missingRequired.body);
  const badOption = await sneha.post(`/v1/surveys/${survey.body.id}/responses`, { answers: { [qs[0].id]: 4, [qs[1].id]: 'Smartwatch', [qs[2].id]: ['Timetable'] } });
  check('answers must be one of the options', badOption.status === 400, badOption.body);
  const answered = await sneha.post(`/v1/surveys/${survey.body.id}/responses`, { answers: { [qs[0].id]: 4, [qs[1].id]: 'Phone', [qs[2].id]: ['Timetable', 'Offline notes'], [qs[3].id]: 'Love the Shelf filters' } });
  await riya.post(`/v1/surveys/${survey.body.id}/responses`, { answers: { [qs[0].id]: 5, [qs[1].id]: 'Laptop', [qs[2].id]: ['Timetable'] } });
  check('answering clears it from my pending list', answered.status === 201 && !(await sneha.get('/v1/surveys/pending')).body.compulsory.some((s: any) => s.id === survey.body.id), answered.body);
  check('each person answers once', (await sneha.post(`/v1/surveys/${survey.body.id}/responses`, { answers: { [qs[0].id]: 1, [qs[1].id]: 'Phone', [qs[2].id]: ['Timetable'] } })).status === 409);
  const results = await admin.get(`/v1/admin/surveys/${survey.body.id}/results`);
  const timetable = results.body.summary?.[2]?.options?.find((o: any) => o.option === 'Timetable');
  check('results summarise every question', results.status === 200 && results.body.survey.responsesCount === 2 && results.body.summary[0].average === 4.5 && timetable?.count === 2, results.body.summary);
  check('named surveys show who answered', results.body.responses.some((r: any) => r.respondent?.username === 'sneha.p'));
  for (const format of ['xlsx', 'docx', 'pdf', 'csv']) {
    const file = await admin.get(`/v1/admin/surveys/${survey.body.id}/export?format=${format}`);
    check(`results download as ${format.toUpperCase()}`, file.status === 200 && looksLike(format, file.raw) && /attachment; filename=".+\.\w+"/.test(file.headers.get('content-disposition') ?? ''), { status: file.status, type: file.headers.get('content-type') });
  }
  const seededSurvey = (await admin.get('/v1/admin/surveys?status=published')).body.items.find((s: any) => s.title === 'CampusConnect first-month check-in');
  const anonResults = await admin.get(`/v1/admin/surveys/${seededSurvey?.id}/results`);
  check('anonymous surveys never show who answered', anonResults.status === 200 && anonResults.body.responses.length >= 3 && anonResults.body.responses.every((r: any) => r.respondent === null), anonResults.body.responses?.slice(0, 2));
  check('questions are locked once people have answered', (await admin.patch(`/v1/admin/surveys/${survey.body.id}`, { questions: [{ type: 'text', prompt: 'New question' }] })).status === 409);
  const closed = await admin.patch(`/v1/admin/surveys/${survey.body.id}`, { status: 'closed' });
  check('closing a survey takes it off everyone’s list', closed.status === 200 && !(await tejas.get('/v1/surveys/pending')).body.compulsory.some((s: any) => s.id === survey.body.id));

  // ---------------------------------------------------------------- feedback
  section('Feedback');
  const fb = await tejas.post('/v1/feedback', { category: 'idea', rating: 4, message: `Please add bus timings ${run}`, page: '/campus' });
  check('anyone can send feedback from Settings', fb.status === 201, fb.body);
  check('feedback needs a message', (await tejas.post('/v1/feedback', { category: 'bug', message: '' })).status === 400);
  const mineFb = await tejas.get('/v1/feedback/mine');
  check('people see what they sent and its status', mineFb.body.items.some((f: any) => f.id === fb.body.id && f.status === 'new'));
  check('students cannot read everyone’s feedback', (await riya.get('/v1/admin/feedback')).status === 403);
  const inboxFb = await admin.get('/v1/admin/feedback?category=idea');
  check('admins read feedback with totals and filters', inboxFb.status === 200 && inboxFb.body.items.some((f: any) => f.id === fb.body.id) && inboxFb.body.items.every((f: any) => f.category === 'idea') && inboxFb.body.stats.total >= 5, inboxFb.body.stats);
  const planned = await admin.patch(`/v1/admin/feedback/${fb.body.id}`, { status: 'planned' });
  const told = (await tejas.get('/v1/notifications?limit=5')).body.items.some((n: any) => n.title.includes('planned'));
  check('marking it planned tells the person', planned.status === 200 && told);
  for (const format of ['xlsx', 'docx', 'pdf', 'csv']) {
    const file = await admin.get(`/v1/admin/feedback/export?format=${format}`);
    check(`feedback downloads as ${format.toUpperCase()}`, file.status === 200 && looksLike(format, file.raw), { status: file.status });
  }

  // ---------------------------------------------------------------- admin
  section('Admin console');
  check('students cannot open the admin console', (await riya.get('/v1/admin/overview')).status === 403);
  const overview = await admin.get('/v1/admin/overview');
  check('the overview has people, activity and queues', overview.status === 200 && overview.body.people.students > 0 && typeof overview.body.queues.open_reports === 'number' && overview.body.queues.surveys_live >= 1, overview.body);
  const statusPage = await admin.get('/health/status');
  check('staff see dependency details on the status page', Boolean(statusPage.body.dependencies?.database), Object.keys(statusPage.body));
  const users = await admin.get('/v1/admin/users?role=student&q=riya');
  check('admins search people (with sign-up details)', users.body.items?.some((u: any) => u.email === EMAIL.riya && u.roleInfo?.enrollmentNumber === 'CSMSS24CO045'), users.body.items?.[0]);
  await tejas.post('/v1/me/verification-requests', { kind: 'student_id', note: 'Smoke test' });
  const vq = await admin.get('/v1/admin/verifications?kind=student_id');
  const vr = vq.body.items?.find((v: any) => v.person.username === 'tejas.more');
  const vd = vr ? await admin.post(`/v1/admin/verifications/${vr.id}/decision`, { decision: 'approve' }) : null;
  check('verification requests are approved and the badge appears', vd?.status === 200 && (await riya.get('/v1/users/tejas.more')).body.isVerified === true, vd?.body);
  const aq = await admin.get('/v1/admin/queue');
  const appr = await admin.post(`/v1/admin/queue/space/${proposed.body.id}`, { decision: 'approve' });
  check('the approval queue publishes submissions', aq.body.space?.some((s: any) => s.id === proposed.body.id) && appr.status === 200, appr.body);
  const off = await admin.patch('/v1/admin/flags/module.marketplace', { enabled: false });
  const blocked = await riya.get('/v1/listings');
  const adminStill = await admin.get('/v1/listings');
  await admin.patch('/v1/admin/flags/module.marketplace', { enabled: true });
  const backOn = await riya.get('/v1/listings');
  check('switching a module off answers a friendly 503, only for that module', off.status === 200 && blocked.status === 503 && blocked.body.error.code === 'FEATURE_DISABLED' && (await riya.get('/v1/events')).status === 200, blocked.body);
  check('admins can still test a switched-off module, and switching back restores it', adminStill.status === 200 && backOn.status === 200);
  check('only admins change feature switches', (await moderator.patch('/v1/admin/flags/module.hush', { enabled: false })).status === 403);
  const suspendMe = await newAccount('suspendme');
  const suspendId = (await me(suspendMe.client)).id;
  const susp = await admin.patch(`/v1/admin/users/${suspendId}`, { suspended: true, reason: 'Smoke test' });
  const suspLogin = await new Client('suspended').login(suspendMe.email, suspendMe.password);
  check('a suspended account is signed out and cannot sign in', susp.status === 200 && (await suspendMe.client.get('/v1/auth/session')).body.user === null && suspLogin.status === 403 && suspLogin.body.error.code === 'ACCOUNT_SUSPENDED', suspLogin.body);
  const revealReq = await admin.post('/v1/admin/identity-reveals', { contentType: 'post', contentId: anonPost.body.id, reason: 'Smoke test of the two-admin reveal process' });
  const selfApprove = await admin.post(`/v1/admin/identity-reveals/${revealReq.body.id}/decision`, { decision: 'approve' });
  check('the admin who asked cannot approve their own reveal', revealReq.status === 201 && selfApprove.status === 403, selfApprove.body);
  const revealed = await admin2.post(`/v1/admin/identity-reveals/${revealReq.body.id}/decision`, { decision: 'approve' });
  check('a second admin approves and sees the author', revealed.status === 200 && revealed.body.author?.username === 'sneha.p', revealed.body);
  const auditLog = await admin.get('/v1/admin/audit?action=admin.identity_reveal');
  check('the reveal is in the audit log', auditLog.body.items?.length >= 2, auditLog.body.items?.map((a: any) => a.action));
  const emails = await admin.get('/v1/admin/emails?status=sent&limit=5');
  const oneEmail = emails.body.items?.[0] ? await admin.get(`/v1/admin/emails/${emails.body.items[0].id}`) : null;
  check('the dev mailbox shows sent emails', emails.status === 200 && Boolean(oneEmail?.body.subject), oneEmail?.body?.subject);
  const sys = await admin.get('/v1/admin/system');
  check('the system page lists background jobs', sys.status === 200 && sys.body.jobs.some((j: any) => j.name === 'email-outbox'), sys.body.jobs?.map((j: any) => j.name));
  const cleanup = await admin.post('/v1/admin/jobs/cleanup/run');
  check('admins can run a job now', cleanup.status === 200 && cleanup.body.ran && cleanup.body.lastStatus === 'ok', cleanup.body);

  // ---------------------------------------------------------------- privacy rights
  section('Privacy: contact, unsubscribe, export and deletion');
  const sentContact = await anon.post('/v1/contact', { name: 'Smoke Visitor', email: `visitor.${run}@example.com`, topic: 'general', subject: 'Hello there', message: 'Just testing the contact form end to end.', consent: true });
  check('the contact form accepts messages', sentContact.status === 202, sentContact.body);
  const noConsent = await anon.post('/v1/contact', { name: 'Smoke Visitor', email: `visitor.${run}@example.com`, topic: 'general', subject: 'Hello there', message: 'Just testing the contact form end to end.', consent: false });
  check('it requires consent to process the message', noConsent.status === 400, noConsent.body);
  const inbox = await admin.get('/v1/admin/contact');
  check('admins see it in the contact inbox', inbox.body.items?.some((m: any) => m.email === `visitor.${run}@example.com`));
  const link = new URL(unsubscribeUrl(config.webUrl, config.secrets.session, EMAIL.riya, 'marketing'));
  const unsub = await anon.post('/v1/privacy/unsubscribe', { e: link.searchParams.get('e'), s: 'marketing', t: link.searchParams.get('t') });
  const badUnsub = await anon.post('/v1/privacy/unsubscribe', { e: link.searchParams.get('e'), s: 'all', t: link.searchParams.get('t') });
  check('signed unsubscribe links work and cannot be altered', unsub.status === 200 && badUnsub.status === 410, [unsub.body, badUnsub.body]);
  await db.collection('email_suppressions').deleteMany({ email: EMAIL.riya });

  const leaver = await newAccount('leaver');
  const leaverMe = await me(leaver.client);
  const leaverImg = await upload(leaver.client, 'post', 'leaving.png', png, 'image/png');
  const leaverPost = await leaver.client.post('/v1/posts', { body: `I will delete my account ${run}`, attachments: [leaverImg.body.id] });
  await leaver.client.post(`/v1/posts/${post.body.id}/comments`, { body: 'A comment that must not outlive me' });
  await leaver.client.post(`/v1/users/${riyaMe.id}/follow`);
  const exp = await leaver.client.post('/v1/me/exports');
  const ran = await admin.post(`/v1/admin/data-requests/${exp.body.id}/run`);
  const exportsList = await leaver.client.get('/v1/me/exports');
  const dataFile = exportsList.body.items?.[0]?.download?.url ? await fetch(exportsList.body.items[0].download.url) : null;
  const data = dataFile ? ((await dataFile.json()) as any) : null;
  check('a data export contains my account and my posts', exp.status === 202 && ran.status === 200 && data?.account?.email === leaver.email && data.posts.some((p: any) => p._id === leaverPost.body.id), { exp: exp.body, ran: ran.body });
  const publicReqSince = new Date(Date.now() - 2_000);
  const publicReq = await anon.post('/v1/privacy/requests', { email: leaver.email, kind: 'export' });
  const confirmToken = tokenIn(await latestEmail(leaver.email, 'data_request_confirm', publicReqSince));
  const confirmed = await anon.post('/v1/privacy/requests/confirm', { token: confirmToken });
  check('data requests without signing in are confirmed by email', publicReq.status === 202 && confirmed.status === 200 && confirmed.body.kind === 'export', confirmed.body);
  const wrongPw = await leaver.client.post('/v1/me/deletion', { password: 'wrong-password-123', confirm: 'DELETE' });
  check('deleting needs the password', wrongPw.status === 400, wrongPw.body);
  const noConfirm = await leaver.client.post('/v1/me/deletion', { password: leaver.password, confirm: 'delete' });
  check('and typing DELETE to confirm', noConfirm.status === 400);
  const scheduled = await leaver.client.post('/v1/me/deletion', { password: leaver.password, confirm: 'DELETE', reason: 'Smoke test' });
  const days = scheduled.body.scheduledFor ? Math.round((new Date(scheduled.body.scheduledFor).getTime() - Date.now()) / 86400_000) : 0;
  check('deletion is scheduled 30 days ahead and signs out everywhere', scheduled.status === 200 && days === 30 && (await leaver.client.get('/v1/auth/session')).body.user === null, scheduled.body);
  check('the profile is hidden from others during the 30 days', (await riya.get(`/v1/users/${leaverMe.id}`)).status === 404);
  const back = new Client('leaver-again');
  await back.login(leaver.email, leaver.password);
  const backMe = await back.get('/v1/me');
  check('signing in during the 30 days shows the scheduled date', Boolean(backMe.body.user?.deletionScheduledFor));
  const cancel = await back.del('/v1/me/deletion');
  check('and the deletion can be cancelled', cancel.status === 200 && (await back.get('/v1/me')).body.user.deletionScheduledFor === null);
  await back.post('/v1/me/deletion', { password: leaver.password, confirm: 'DELETE' });
  await db.collection('users').updateOne({ email: leaver.email }, { $set: { deletionScheduledFor: new Date(Date.now() - 60_000) } });
  const riyaFollowersBefore = (await riya.get('/v1/users/riya.d')).body.followersCount;
  const purge = await admin.post('/v1/admin/jobs/account-deletion/run');
  const [gone, postGone, filesGone, commentKept] = await Promise.all([
    db.collection('users').countDocuments({ email: leaver.email }),
    db.collection('posts').countDocuments({ _id: leaverPost.body.id } as never),
    db.collection('files').countDocuments({ ownerId: leaverMe.id }),
    db.collection('comments').findOne({ postId: post.body.id, body: '[deleted]' }),
  ]);
  check('after 30 days the account and all its history are deleted', purge.status === 200 && purge.body.lastStatus === 'ok' && gone === 0 && postGone === 0 && filesGone === 0, { purge: purge.body, gone, postGone, filesGone });
  check('their comments on other people’s posts become "[deleted]"', Boolean(commentKept) && commentKept?.authorId === null);
  check('follower counts stay correct', (await riya.get('/v1/users/riya.d')).body.followersCount === riyaFollowersBefore - 1);
  const goodbye = await latestEmail(leaver.email, 'account_deleted', new Date(Date.now() - 60_000));
  check('and a final confirmation email is sent', Boolean(goodbye));
}

main().catch(async (err) => {
  console.error(err);
  await mongo.close().catch(() => undefined);
  process.exit(1);
});
