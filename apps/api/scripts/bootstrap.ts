// Creates the first college and the first admin on an empty production database, so a fresh
// deployment (for example on Railway) has someone who can sign in and run the admin console.
// It does nothing unless BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are set, and it is safe
// to run on every start: an existing college or admin is never touched or overwritten.
//
// Usage: runs before the server in the Railway start command, or by hand:
//   npm run db:bootstrap --workspace=api
//
// Variables (all optional except the first two):
//   BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (10+ characters), BOOTSTRAP_ADMIN_NAME
//   BOOTSTRAP_COLLEGE_NAME, BOOTSTRAP_COLLEGE_SHORT_NAME, BOOTSTRAP_COLLEGE_SLUG,
//   BOOTSTRAP_COLLEGE_CITY, BOOTSTRAP_COLLEGE_STATE
// Remove BOOTSTRAP_ADMIN_PASSWORD from the environment once you have signed in.

import pino from 'pino';
import { loadEnvFile, parseConfig } from '../src/config/env.js';
import { closeDeps, createDeps } from '../src/deps.js';
import { uuidv7 } from '../src/infra/db/ids.js';
import { applySchema, schemaIsCurrent } from '../src/infra/db/migrate.js';
import { TERMS_VERSION } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { defaultNotificationPrefs, defaultProfile, defaultSettings } from '../src/modules/users/defaults.js';

loadEnvFile();
const env = process.env;
const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = env.BOOTSTRAP_ADMIN_PASSWORD;

async function main() {
  if (!email || !password) {
    console.log('bootstrap: BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD not set, nothing to do');
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL is not a valid email address');
  if (password.length < 10 || password.length > 128) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be 10 to 128 characters');

  const config = parseConfig();
  const deps = createDeps(config, pino({ level: 'warn' }));
  try {
    await deps.db.connect();
    const db = deps.db;
    if (!(await schemaIsCurrent(db.db))) await applySchema(db.db);

    if (await db.col('users').findOne({ email }, { projection: { _id: 1 } })) {
      console.log(`bootstrap: ${email} already exists, leaving it as it is`);
      return;
    }

    const now = new Date();
    let collegeId = (await db.col('colleges').findOne({}, { projection: { _id: 1 } }))?._id;
    if (!collegeId) {
      const name = env.BOOTSTRAP_COLLEGE_NAME?.trim() || 'My College';
      const shortName = env.BOOTSTRAP_COLLEGE_SHORT_NAME?.trim() || name.slice(0, 12);
      const slug = (env.BOOTSTRAP_COLLEGE_SLUG?.trim() || shortName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'college';
      collegeId = uuidv7();
      await db.col('colleges').insertOne({
        _id: collegeId,
        slug,
        name,
        shortName,
        city: env.BOOTSTRAP_COLLEGE_CITY?.trim() || '',
        state: env.BOOTSTRAP_COLLEGE_STATE?.trim() || '',
        timezone: 'Asia/Kolkata',
        shard: 'default',
        status: 'active',
        domains: [],
        settings: { academicYear: `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`, currentSemester: 'odd', divisions: ['A', 'B', 'C'] },
        createdAt: now,
        updatedAt: now,
      });
      console.log(`bootstrap: created college "${name}" (add departments and domains in Admin → Colleges)`);
    }

    const userId = uuidv7();
    const displayName = env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Admin';
    await db.col('users').insertOne({
      _id: userId,
      collegeId,
      email,
      emailVerifiedAt: now,
      passwordHash: await hashPassword(password),
      role: 'admin',
      pendingRole: null,
      status: 'active',
      roleInfo: {},
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      passwordChangedAt: now,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: now,
      adultConfirmedAt: now,
      deletionScheduledFor: null,
      deletionReason: null,
      profile: defaultProfile({ username: 'admin', displayName }),
      settings: defaultSettings(),
      notificationPrefs: defaultNotificationPrefs(false),
      createdAt: now,
      updatedAt: now,
    });
    console.log(`bootstrap: created admin ${email}. Sign in, then remove BOOTSTRAP_ADMIN_PASSWORD from the environment.`);
  } finally {
    await closeDeps(deps);
  }
}

main().catch((err) => {
  console.error(`bootstrap failed: ${(err as Error).message ?? err}`);
  process.exit(1);
});
