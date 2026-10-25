import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// All configuration comes from the environment (12-factor). Nothing environment-specific is
// hard-coded in modules: they receive a validated, typed `Config` object.

const API_ROOT = resolve(import.meta.dirname, '..', '..');

/** Loads apps/api/.env (if present) without overriding variables already set by the shell. */
export function loadEnvFile(file = process.env.ENV_FILE ?? resolve(API_ROOT, '.env')): void {
  if (existsSync(file)) process.loadEnvFile(file);
}

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1' || v === 'yes'));

const list = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? fallback)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const DEV_SECRET = 'dev-only-secret-change-me-dev-only-secret';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: bool(false),
  TRUST_PROXY: bool(false),

  WEB_URL: z.url().default('http://localhost:3000'),
  WEB_ORIGINS: list('http://localhost:3000,http://127.0.0.1:3000'),
  PUBLIC_API_URL: z.url().default('http://localhost:4000'),

  // MongoDB. Locally a single-node replica set (enables transactions); in production MongoDB
  // Atlas or any replica set. directConnection=true lets one URL work for both standalone and
  // single-node replica sets during development.
  MONGODB_URL: z.string().min(1).default('mongodb://127.0.0.1:27017/?directConnection=true'),
  MONGODB_DB: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/).default('campus_connect'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(500).default(20),
  DB_OPERATION_TIMEOUT_MS: z.coerce.number().int().min(200).max(120000).default(8000),

  REDIS_URL: optionalString,

  SESSION_SECRET: z.string().min(32).default(DEV_SECRET),
  FILE_SIGNING_SECRET: z.string().min(32).default(DEV_SECRET),
  IP_HASH_SECRET: z.string().min(32).default(DEV_SECRET),
  COOKIE_SECURE: bool(false),
  COOKIE_DOMAIN: optionalString,

  MAIL_TRANSPORT: z.enum(['dev', 'smtp']).default('dev'),
  // Lets production start with the built-in dev mailbox (messages are kept in Admin → System → Email
  // instead of being sent). For a first deploy before SMTP is set up; real sign-ups need SMTP.
  ALLOW_DEV_MAIL: bool(false),
  MAIL_FROM: z.string().default('CampusConnect <no-reply@campusconnect.local>'),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('var/storage'),
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(5120).default(25),

  SCANNER: z.enum(['none', 'clamav']).default('none'),
  CLAMAV_HOST: z.string().default('127.0.0.1'),
  CLAMAV_PORT: z.coerce.number().int().default(3310),

  // Operator details shown in email footers and legal pages. Replace the placeholders with the
  // registered business name, postal address and a monitored inbox before launch.
  OPERATOR_NAME: z.string().default('CampusConnect (operator name to be confirmed)'),
  OPERATOR_ADDRESS: z.string().default('Registered address to be confirmed, India'),
  SUPPORT_EMAIL: z.string().default('support@campusconnect.local'),
  PRIVACY_EMAIL: z.string().default('privacy@campusconnect.local'),

  // When false (the default for now), sign-up creates an active account and signs the person in at
  // once. Set true to require confirming the email address first (needs working email delivery).
  REQUIRE_EMAIL_VERIFICATION: bool(false),

  JOBS_ENABLED: bool(true),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(300),
  ENABLE_API_DOCS: bool(true),
});

export type Config = ReturnType<typeof parseConfig>;

export function parseConfig(source: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';

  // Production must never start with development defaults or half-configured providers.
  if (isProd) {
    const problems: string[] = [];
    for (const key of ['SESSION_SECRET', 'FILE_SIGNING_SECRET', 'IP_HASH_SECRET'] as const) {
      if (env[key] === DEV_SECRET) problems.push(`${key} must be set to a unique random value`);
    }
    if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production');
    const devMailAllowed = env.ALLOW_DEV_MAIL && env.MAIL_TRANSPORT === 'dev';
    if (!devMailAllowed && (env.MAIL_TRANSPORT !== 'smtp' || !env.SMTP_HOST)) problems.push('MAIL_TRANSPORT=smtp and SMTP_HOST are required (or ALLOW_DEV_MAIL=true to keep emails in the admin console)');
    if (env.STORAGE_DRIVER === 's3' && (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
      problems.push('S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required for STORAGE_DRIVER=s3');
    }
    if (problems.length) throw new Error(`Unsafe production configuration:\n  - ${problems.join('\n  - ')}`);
  }

  return {
    env: env.NODE_ENV,
    isProd,
    isTest: env.NODE_ENV === 'test',
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    logPretty: env.LOG_PRETTY,
    trustProxy: env.TRUST_PROXY,
    webUrl: env.WEB_URL.replace(/\/$/, ''),
    webOrigins: env.WEB_ORIGINS,
    publicApiUrl: env.PUBLIC_API_URL.replace(/\/$/, ''),
    db: {
      url: env.MONGODB_URL,
      name: env.MONGODB_DB,
      poolMax: env.DB_POOL_MAX,
      operationTimeoutMs: env.DB_OPERATION_TIMEOUT_MS,
    },
    redisUrl: env.REDIS_URL,
    secrets: {
      session: env.SESSION_SECRET,
      fileSigning: env.FILE_SIGNING_SECRET,
      ipHash: env.IP_HASH_SECRET,
    },
    cookies: {
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
      // The __Host- prefix makes browsers refuse the cookie unless it is Secure, host-only and
      // path=/, which blocks subdomain cookie injection. It needs HTTPS, so it is production-only.
      sessionName: env.COOKIE_SECURE && !env.COOKIE_DOMAIN ? '__Host-cc_session' : 'cc_session',
      csrfName: env.COOKIE_SECURE && !env.COOKIE_DOMAIN ? '__Host-cc_csrf' : 'cc_csrf',
    },
    mail: {
      transport: env.MAIL_TRANSPORT,
      from: env.MAIL_FROM,
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      localDir: resolve(API_ROOT, env.STORAGE_LOCAL_DIR),
      s3: {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    },
    scanner: { driver: env.SCANNER, host: env.CLAMAV_HOST, port: env.CLAMAV_PORT },
    operator: {
      name: env.OPERATOR_NAME,
      address: env.OPERATOR_ADDRESS,
      supportEmail: env.SUPPORT_EMAIL,
      privacyEmail: env.PRIVACY_EMAIL,
    },
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    jobsEnabled: env.JOBS_ENABLED,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    enableApiDocs: env.ENABLE_API_DOCS,
  };
}
