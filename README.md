# CampusConnect

One shared community for everyone: feed, chats, spaces, loops, events and more. Anyone can sign up with an
email and password and sees everyone else, with no colleges to choose between.

| Role | What they get |
|---|---|
| Student | Feed, chats, spaces, events, Shelf, lectures, opportunities, Hush, lost & found, marketplace, study tools, games |
| Faculty | Everything students get, plus notices, lectures and reviewing Shelf uploads (needs admin approval at sign-up) |
| Industry expert | Careers, mentoring, people, chats, spaces and lectures (needs admin approval at sign-up) |
| Moderator | The student app plus reports, people and the approval queue |
| Admin | Everything, including surveys, feedback, feature switches and the system page |

## Projects

```
apps/
  api/    Fastify 5 + MongoDB API: sessions, realtime chat (WebSocket), uploads, email outbox,
        background jobs, Excel/Word/PDF/CSV exports. Guide: apps/api/.env.example
  web/  Next.js 16 + React 19 web app (phone and desktop layouts). Guide: apps/web/README.md
scripts/start.mjs   Runs both as one service in production (used by the Dockerfile)
Dockerfile          One image for the whole project; railway.json points Railway at it
```

## Run it locally

You need Node.js 22.12 or newer and MongoDB 7 or newer running on `127.0.0.1:27017`.

```bash
npm install
cp apps/api/.env.example apps/api/.env        # optional: the defaults work locally
npm run db:reset --workspace=api               # create the schema and load the demo data
npm run dev --workspace=api                    # API on http://localhost:4000 (docs at /docs)
npm run dev --workspace=web                    # web app on http://localhost:3000
```

The demo accounts (one per role) are listed at the top of `apps/api/scripts/seed.ts`. They use
`@example.com` addresses and are for local testing only; the seed refuses to run in production.

### Transactions (recommended)

The API works on a standalone MongoDB server, but multi-step changes are only atomic on a replica
set. To turn a local Windows install into a single-node replica set, run PowerShell as
Administrator:

```powershell
Add-Content -Path "C:\Program Files\MongoDB\Server\9.0\bin\mongod.cfg" -Value "`nreplication:`n  replSetName: rs0"
Restart-Service MongoDB
mongosh --eval "rs.initiate()"
```

Admin → System shows whether the database is a replica set.

## Deploy

The whole project deploys as one service. On Railway: **New Project → Deploy from GitHub repo → add a
MongoDB**, then set `MONGODB_URL` and the first-admin variables. Step by step: [RAILWAY.md](RAILWAY.md).

## Checks

```bash
npm run type-check                                   # API and web
npm run build --workspace=web                        # production build of the web app
```

End-to-end smoke test (257 checks across every module), run against a separate test database:

```bash
MONGODB_DB=campus_connect_test npm run db:reset --workspace=api
# start an API with MONGODB_DB=campus_connect_test PORT=4100 MAIL_TRANSPORT=dev, then:
MONGODB_DB=campus_connect_test API_URL=http://127.0.0.1:4100 npm run smoke --workspace=api
```

## Before going live

- Set `NODE_ENV=production` and three different random secrets (`SESSION_SECRET`,
  `FILE_SIGNING_SECRET`, `IP_HASH_SECRET`); the API refuses to start in production without them.
- Use a MongoDB replica set (for example MongoDB Atlas), `MAIL_TRANSPORT=smtp`, and S3-compatible
  storage for uploads.
- Replace the operator name, address and support emails (see `apps/api/.env.example`).
