# Deploying CampusConnect on Railway

The whole project runs as **one Railway service** plus a MongoDB database. The `Dockerfile` and
`railway.json` at the repo root are picked up automatically, so there is no Root Directory, build
command or start command to set.

```
browser ──> one public domain ──┬─ /v1, /health, /docs ─> API  ┐ same container
                                └─ everything else ─────> web  ┘ (scripts/start.mjs)
                                                           │
                                                        MongoDB
```

## Deploy

1. Railway → **New Project** → **Deploy from GitHub repo** → `Parthbadgujar1/Campus_Connect`.
2. In the same project: **New → Database → MongoDB**.
3. Open the app service → **Variables** and add:

   | Variable | Value |
   |---|---|
   | `MONGODB_URL` | `${{MongoDB.MONGO_URL}}` |
   | `BOOTSTRAP_ADMIN_EMAIL` | your email (this becomes the first admin) |
   | `BOOTSTRAP_ADMIN_PASSWORD` | a password of 10+ characters |
   | `BOOTSTRAP_COLLEGE_NAME` | your college's name |

4. **Settings → Networking → Generate Domain**, then let it redeploy.
5. Open the domain and sign in with the admin email and password. Then **delete
   `BOOTSTRAP_ADMIN_PASSWORD`** and add departments and email domains in **Admin → Colleges**.

Everything else is filled in for you: the public URL comes from Railway's domain, the three secrets
are derived from the database URL (so they stay the same across deploys), cookies are secure, and
the API and web app find each other inside the container.

## Optional, when you are ready

| What | How |
|---|---|
| **Send real email** (password reset, notifications) | Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` from any email provider. Until then, emails are kept in **Admin → System → Email**. |
| **Require email confirmation** | Set `REQUIRE_EMAIL_VERIFICATION=true` (needs SMTP above). By default, sign-up signs people in straight away and everyone joins as a student. |
| **Keep uploaded files** | Add a **Volume** to the service (any mount path); it is used automatically. Or set `STORAGE_DRIVER=s3` with `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Without either, uploads are lost when the service redeploys. |
| **Your own secrets** | Set `APP_SECRET` (any long random value) to derive the secrets from it instead of the database URL, or set `SESSION_SECRET`, `FILE_SIGNING_SECRET` and `IP_HASH_SECRET` individually. |
| **Legal page details** | `OPERATOR_NAME`, `OPERATOR_ADDRESS`, `SUPPORT_EMAIL`, `PRIVACY_EMAIL`. |
| **Custom domain** | Add it in Networking and set `PUBLIC_URL` to `https://your-domain`. |

Any variable you set yourself overrides the defaults. The full list is in `apps/api/.env.example`.

## If something looks wrong

- **Build or boot log says "No database found":** `MONGODB_URL` is missing on the app service.
- **Sign-in does nothing:** the service has no public domain yet (step 4), and sign-in needs https.
- **`/health/ready` shows `unavailable`:** the app cannot reach MongoDB; check the `MONGODB_URL` reference.
- **No admin exists:** `BOOTSTRAP_ADMIN_EMAIL` or the password (10+ characters) was missing at start.
  Add them and redeploy; an existing admin or college is never overwritten.

## Good to know

- Railway's MongoDB template is a single server, so multi-step changes are not atomic. The app works
  on it; for transactions use MongoDB Atlas and put its connection string in `MONGODB_URL`.
- API and web share one container, so scale it up (more CPU/memory) rather than adding copies. Running
  several copies needs `REDIS_URL` for shared rate limits and realtime.
- The demo seed (`npm run db:reset`) is for your own machine only; it is blocked in production.
- Locally: `npm run dev --workspace=api` and `npm run dev --workspace=web`, as in the README.
