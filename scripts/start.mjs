// One-container launcher for Railway (or any Docker host): runs the API and the web app together
// behind a single public port, so the whole project deploys as ONE service with no settings.
//
//   browser ──> this process (PORT) ──┬─ /v1, /health, /docs ─> API  (127.0.0.1:4001)
//                                     └─ everything else ─────> web  (127.0.0.1:3001)
//
// It fills in sensible production defaults from what Railway provides (public domain, database
// URL, volume), so the only thing you must supply is the database. Any variable you set yourself
// always wins over the defaults below.

import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const PORT = Number(env.PORT) || 3000;
// Keep in sync with API_ORIGIN in the Dockerfile (the web build bakes the API address in).
const API_PORT = 4001;
const WEB_PORT = 3001;

const log = (msg) => console.log(`[start] ${msg}`);

// ------------------------------------------------------------------ configuration
const mongo = env.MONGODB_URL || env.MONGO_URL || env.MONGODB_URI || env.DATABASE_URL;
if (!mongo) {
  console.error(
    '[start] No database found. Add a MongoDB service to the project and set MONGODB_URL to ${{MongoDB.MONGO_URL}} on this service (Variables tab).',
  );
  process.exit(1);
}
env.MONGODB_URL = mongo;
env.MONGODB_DB ??= 'campus_connect';

const domain = env.RAILWAY_PUBLIC_DOMAIN || env.RAILWAY_STATIC_URL;
const base = (env.PUBLIC_URL || (domain ? `https://${domain}` : `http://localhost:${PORT}`)).replace(/\/$/, '');
if (!env.PUBLIC_URL && !domain) {
  log('No public domain yet. The app is running, but sign-in needs one: in Railway open Settings → Networking → Generate Domain (the service redeploys by itself).');
}
env.WEB_URL ??= base;
env.WEB_ORIGINS ??= base;
env.PUBLIC_API_URL ??= base; // the API is served from the same address, under /v1

env.NODE_ENV = 'production';
env.TRUST_PROXY ??= 'true';
// The API refuses to run in production without secure cookies, and hosts like Railway always serve
// over https at the edge, so this stays on even before a domain exists.
env.COOKIE_SECURE ??= 'true';
env.LOG_PRETTY ??= 'false';
env.ENABLE_API_DOCS ??= 'false';

// Secrets must stay the same between deploys (they sign sessions and file links), so when they are
// not set they are derived from the database URL (or APP_SECRET, if you set one).
const seed = env.APP_SECRET || mongo;
const derive = (label) => createHmac('sha256', seed).update(`campusconnect:${label}`).digest('base64url');
env.SESSION_SECRET ??= derive('session');
env.FILE_SIGNING_SECRET ??= derive('file-signing');
env.IP_HASH_SECRET ??= derive('ip-hash');

// Email: without SMTP the app still runs, and messages are kept in Admin → System → Email.
if (env.SMTP_HOST) {
  env.MAIL_TRANSPORT ??= 'smtp';
} else {
  env.MAIL_TRANSPORT ??= 'dev';
  env.ALLOW_DEV_MAIL ??= 'true';
  log('SMTP_HOST is not set: emails are kept in Admin → System → Email instead of being sent.');
}

// Uploads: a Railway Volume (if attached) survives deploys; otherwise files live in the container.
const volume = env.RAILWAY_VOLUME_MOUNT_PATH;
env.STORAGE_LOCAL_DIR ??= volume ? join(volume, 'storage') : join(ROOT, 'storage');
if (env.STORAGE_DRIVER !== 's3' && !volume && !env.STORAGE_LOCAL_DIR.startsWith('/data')) {
  log('Uploads are stored inside the container and are lost on redeploy. Attach a Volume (or set STORAGE_DRIVER=s3) to keep them.');
}

// ------------------------------------------------------------------ child processes
const children = [];
let stopping = false;

function run(name, args, cwd, extraEnv) {
  const child = spawn(process.execPath, args, { cwd, env: { ...env, ...extraEnv }, stdio: 'inherit' });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (!stopping) {
      log(`${name} stopped (${signal ?? code}); shutting down so Railway restarts the service`);
      stop(code || 1);
    }
  });
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 10_000).unref();
  Promise.all(children.map((c) => new Promise((done) => (c.exitCode === null ? c.once('exit', done) : done())))).then(() => process.exit(code));
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));

// ------------------------------------------------------------------ one public port
const API_PATHS = /^\/(v1|health|docs)(\/|\?|$)/;
const targetFor = (url) => (API_PATHS.test(url ?? '') ? API_PORT : WEB_PORT);

const server = http.createServer((req, res) => {
  const upstream = http.request({ host: '127.0.0.1', port: targetFor(req.url), method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '2' });
    res.end('CampusConnect is starting. Please try again in a moment.');
  });
  req.pipe(upstream);
});

// WebSockets (realtime chat) are tunnelled straight through to the API.
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(targetFor(req.url), '127.0.0.1', () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

function listen(host) {
  server.once('error', (err) => {
    if (host === '::' && err.code !== 'EADDRINUSE') return listen('0.0.0.0');
    console.error(`[start] cannot listen on port ${PORT}: ${err.message}`);
    process.exit(1);
  });
  server.listen(PORT, host, () => log(`listening on port ${PORT} (${base})`));
}
listen('::');

// ------------------------------------------------------------------ start everything
// First college and admin on an empty database; does nothing unless BOOTSTRAP_ADMIN_* is set.
await new Promise((done) => {
  const boot = spawn(process.execPath, ['dist/scripts/bootstrap.js'], { cwd: join(ROOT, 'apps/api'), env, stdio: 'inherit' });
  boot.on('exit', (code) => {
    if (code) log('bootstrap reported a problem (see above); starting the app anyway');
    done();
  });
});

run('api', ['dist/src/server.js'], join(ROOT, 'apps/api'), { PORT: String(API_PORT), HOST: '127.0.0.1' });
const nextBin = createRequire(join(ROOT, 'apps/web/package.json')).resolve('next/dist/bin/next');
run('web', [nextBin, 'start', '-p', String(WEB_PORT), '-H', '127.0.0.1'], join(ROOT, 'apps/web'), { PORT: String(WEB_PORT), NEXT_TELEMETRY_DISABLED: '1' });
