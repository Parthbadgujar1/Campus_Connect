# Deploying CampusConnect on Railway

One Railway project, three services: **MongoDB**, **api** and **web**. Both apps build from this
repository with the Dockerfiles in `apps/api` and `apps/web`.

```
Browser ──https──> web (Next.js)  ──private network──> api (Fastify) ──> MongoDB
   │                                                     ▲
   └──── wss + signed file links, straight to ───────────┘  (api needs its own public domain)
```

The web app forwards `/api/*` to the API, so sign-in cookies stay on the web domain. Realtime chat
(WebSocket) and file links go from the browser straight to the API's public domain.

## 1. Create the services

1. Railway → **New Project** → **Deploy from GitHub repo** → pick this repository. Name the service `api`.
2. In the same project: **New** → **GitHub Repo** (same repository again). Name it `web`.
3. **New** → **Database** → **MongoDB**. Leave its name as `MongoDB` (the variables below refer to it).

For **both** `api` and `web`, open **Settings** and set:

| Setting | `api` | `web` |
|---|---|---|
| Root Directory | `/campus-connect` | `/campus-connect` |
| Config-as-code file | `/campus-connect/apps/api/railway.json` | `/campus-connect/apps/web/railway.json` |
| Branch | `main` | `main` |

Then **Settings → Networking → Generate Domain** on both services. Don't deploy yet; set the variables first.

## 2. Variables for `api`

| Variable | Value |
|---|---|
| `PORT` | `4000` |
| `MONGODB_URL` | `${{MongoDB.MONGO_URL}}` |
| `MONGODB_DB` | `campus_connect` |
| `SESSION_SECRET` | a random 32+ character value |
| `FILE_SIGNING_SECRET` | a different random value |
| `IP_HASH_SECRET` | a third random value |
| `WEB_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| `WEB_ORIGINS` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| `PUBLIC_API_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `MAIL_TRANSPORT` | `smtp` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | from your email provider |
| `MAIL_FROM` | `CampusConnect <no-reply@your-domain>` (must be allowed by your SMTP provider) |
| `ENABLE_API_DOCS` | `false` |
| `OPERATOR_NAME`, `OPERATOR_ADDRESS`, `SUPPORT_EMAIL`, `PRIVACY_EMAIL` | the real details shown on legal pages |

Make a secret with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
(run it three times).

The API refuses to start in production without the three secrets and SMTP. The Dockerfile already
sets `NODE_ENV=production`, `HOST=::`, `TRUST_PROXY=true` and `COOKIE_SECURE=true`.

### First admin and college

A fresh database is empty, and the demo seed is disabled in production. Add these once and the API
creates the first college and an admin when it starts (it never overwrites an existing one):

| Variable | Value |
|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | your email |
| `BOOTSTRAP_ADMIN_PASSWORD` | 10+ characters |
| `BOOTSTRAP_ADMIN_NAME` | your name |
| `BOOTSTRAP_COLLEGE_NAME` | e.g. `CSMSS Chh. Shahu College of Engineering` |
| `BOOTSTRAP_COLLEGE_SHORT_NAME`, `BOOTSTRAP_COLLEGE_CITY`, `BOOTSTRAP_COLLEGE_STATE` | optional |

After you have signed in, **delete `BOOTSTRAP_ADMIN_PASSWORD`**, then add departments and email
domains in **Admin → Colleges**.

### File uploads (pick one)

- **S3-compatible bucket (recommended):** `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`,
  `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (Cloudflare R2, AWS S3, Backblaze B2...).
- **Railway Volume:** on `api` add a Volume mounted at `/data`, then set
  `STORAGE_LOCAL_DIR=/data/storage` and `RAILWAY_RUN_UID=0` (so the app can write to the volume).
  Without a volume, uploaded files are lost on every deploy.

## 3. Variables for `web`

| Variable | Value |
|---|---|
| `API_ORIGIN` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` |

`API_ORIGIN` is read **while the web app builds** (it is baked into the `/api` forwarding rule), so
if you change it, redeploy `web`. The build stops with a clear message if it is missing.

## 4. Deploy and check

1. Deploy `api` first. It is healthy when `https://<api-domain>/health/ready` returns `ok`.
2. Deploy `web`. Open its domain, sign in with the bootstrap admin, and open **Admin → System**.
3. Register a test student account to confirm the verification email arrives.

If sign-in loops or cookies are missing, check that `WEB_URL` and `WEB_ORIGINS` exactly match the
web domain (https, no trailing slash) and that `COOKIE_DOMAIN` is **not** set.

## Good to know

- **Transactions:** Railway's MongoDB template is a single server, so multi-step changes are not
  atomic. The app works on it; for transactions use MongoDB Atlas (a replica set) and put its
  connection string in `MONGODB_URL`.
- **More than one `api` replica** needs Redis (`REDIS_URL=${{Redis.REDIS_URL}}`) for shared rate
  limits and realtime. One replica works without it.
- **Custom domain:** add it to `web` in Railway, then update `WEB_URL` and `WEB_ORIGINS` on `api`.
- **Virus scanning** is off (`SCANNER=none`); ClamAV needs its own service.
- Run the demo seed only on your own machine; it is blocked in production on purpose.
