# CampusConnect — Module Roadmap (MVP / Phase 2 / Phase 3)

The product brief lists **61 modules**. They are the complete idea pool, not the first release.
This document sets the order. It is the agreed input for the backend phase.

**Status of the frontend (this phase):** every module has a screen in `apps/web` built on mock
data (`apps/web/src/data`). Screens are wired to a store and forms behave like the real flow, but
nothing is saved to a server. The backend phase replaces the data layer, not the screens.

## How the phases are chosen

- **MVP** — the core campus loop a student uses every day, plus the trust and admin tools needed
  to run it safely: verified students, feed, chats, communities, events, opportunities, resources
  and faculty lectures, campus services, lost & found, marketplace, search, notifications, admin.
- **Phase 2** — deeper academic and career tools, and features that need partners, data or a
  governance process (ERP integration, business onboarding, AI on real data).
- **Phase 3** — entertainment, monetisation, social discovery and matching features that carry the
  most moderation and legal load, or that only add value once a critical mass of users exists.

Dating (module 61) is Phase 3 and needs legal and safety review before any release.

## Module-by-module plan

| # | Module | Phase | Frontend route(s) | Notes for backend |
|---|---|---|---|---|
| 1 | Student profile & identity | MVP | `/profile/[username]`, `/profile/edit`, `/verify`, `/id` | Profile, skills, links, privacy fields |
| 2 | Campus / college hub | MVP | `/college`, `/campus` | College tenancy; feeds by dept, year, division |
| 3 | Social media (feed, posts, resonate, replies, keep) | MVP | `/`, `/create`, `/post/[id]`, `/you/kept` | Core feed; ranking later |
| 3a | Moments (stories), Loops (short video), polls in feed | Phase 2 | `/loops`, Moments viewer on `/` | Media pipeline and storage |
| 4 | Anonymous campus (Hush: anonymous questions and answers) | MVP | `/hush`, `/hush/[id]` (`/anonymous` redirects) | Needs identity-reveal governance (two approvers) |
| 5 | Chat & communication (1-to-1, group, class, dept, community, event) | MVP | `/chats`, `/chats/[id]` | Realtime (Socket.IO); message store |
| 5a | Voice notes, polls, stickers, view-once snaps, streaks, chat ambience | Phase 2 | `/chats/[id]` | Media storage; full-text search; snap expiry server-side |
| 6 | Communities → **Spaces** (Boards feed with votes and nested replies, text rooms, voice lounges) | MVP | `/spaces` (Boards), `/spaces/[slug]`, `/spaces/[slug]/t/[id]`, `/spaces/[slug]/c/[channel]`, `/spaces/new` | Join rules, moderators; voice needs a realtime media service (Phase 2) |
| 7 | Study together (studying now, circles, partners) and study tools (focus timer, flashcards, notes) | Phase 2 | `/study`, `/study/rooms/[id]`, `/study/focus`, `/study/flashcards`, `/study/notes` | Presence for live rooms; notes and decks sync per student |
| 8 | Watch together | Phase 3 | `/watch?tab=together`, `/watch/party/[id]` | Synchronised playback needs realtime sync |
| 9 | Games & entertainment (Playroom: quick games and live tables) | Phase 3 | `/games`, `/games/memory`, `/games/reflex`, `/games/quiz` | Leaderboards, anti-cheat |
| 10 | Memes | Phase 3 | `/memes` | Upvotes, contests |
| 11 | Events (RSVP, reminders, QR check-in, event chat) | MVP | `/events`, `/events/[id]` | Capacity, check-in tokens |
| 11a | Certificates | Phase 2 | `/events/[id]` | Certificate generation |
| 12 | Opportunities | MVP | `/opportunities`, `/opportunities/[id]` | Eligibility rules, deadlines |
| 13 | Project / team formation | Phase 2 | `/teams`, `/teams/[id]` | Skill matching |
| 14 | Jobs / internship hub (tracker, deadlines) | MVP | `/jobs` | Application stages |
| 14a | Company reviews | Phase 2 | `/opportunities/[id]` | Verified-review rules |
| 15 | Room / PG finder | Phase 2 | `/housing`, `/housing/[id]` | Verified owners; report flow |
| 16 | Roommate matching | Phase 3 | `/housing` (Roommates tab) | Compatibility scoring |
| 17 | Student marketplace (buy/sell, local pickup) | MVP | `/marketplace`, `/marketplace/[id]` | Listings, reports, chat with seller |
| 17a | Payments in marketplace | Phase 3 | — | Only after fraud tooling |
| 18 | Student-to-student services | Phase 2 | `/services` | Provider reviews |
| 19 | Local offers & coupons | Phase 2 | `/offers` | Business onboarding first |
| 20 | Student business hub | Phase 3 | `/business` | Business accounts |
| 21 | Travel (trips, train/bus/flight groups) | Phase 2 | `/travel`, `/travel/[id]` | Seats, trip chat |
| 22 | Travel partner matching | Phase 2 | `/travel` (Matches) | Matching rules |
| 23 | Travel expense sharing | Phase 3 | `/travel/[id]` (Expenses) | Split and settlement ledger |
| 24 | Campus services (canteen, library, labs, directory) | MVP | — (screen removed in the UI phase; bring back with real data) | Admin-maintained data |
| 25 | Student feedback & surveys | Phase 2 | `/feedback` | Anonymous responses |
| 26 | Lost & found (claim verification) | MVP | `/lost-found` | Claim workflow |
| 27 | Resource hub (notes, PYQs, syllabus, cheat sheets) | MVP | `/resources` | Upload moderation; storage |
| 27a | **Faculty video lectures** (admin upload, student watch) | MVP | `/watch?tab=lectures`, `/watch/v/[id]`, `/admin/lectures` | Video processing, progress per student, timestamped comments |
| 28 | AI student assistant | Phase 2 | `/assistant` | Grounded answers on campus data only |
| 29 | AI matching | Phase 3 | `/discover` (For you) | Depends on 16, 13, 22 |
| 30 | Smart notifications (basic MVP, digests Phase 2) | MVP | `/notifications`, `/settings/notifications` | Push, email, preferences |
| 31 | Campus map | Phase 2 | — (screen removed in the UI phase) | Map data from facilities team |
| 32 | Digital student ID (QR pass) | Phase 2 | `/id` | Signed, rotating QR tokens |
| 33 | Student dashboard ("Today") | MVP | `/` (Today card) | Aggregates timetable, chats, deadlines |
| 34 | Academic management (timetable, attendance, results) | Phase 2 | `/academics` | ERP integration |
| 35 | Peer tutoring | Phase 3 | `/study` (Tutors tab) | Booking and payments |
| 36 | Student creator platform (Makers) | Phase 3 | `/creators` | Showcase moderation; channel follows |
| 37 | Achievements & gamification | Phase 3 | `/achievements` | XP rules, anti-gaming |
| 38 | Inter-college network | Phase 3 | `/network` | Cross-college data sharing agreements |
| 39 | City student network | Phase 3 | `/network` (City tab) | Location privacy |
| 40 | Student-to-student help board | Phase 2 | `/help` | Accepted-answer flow |
| 41 | Emergency / safety (contacts, SOS, trusted contacts) | MVP | `/safety` | **SOS must be connected to the security desk before launch** |
| 42 | Campus news | MVP | `/news`, `/college` (News tab) | Source and category management |
| 43 | Placement hub | Phase 2 | `/placements` | Placement cell data |
| 44 | Coding hub | Phase 3 | `/coding` | Contest feeds |
| 45 | Clubs & organisations | Phase 2 | `/spaces` (kind: Club) | Same model as Spaces |
| 46 | Student finance tools | Phase 3 | `/finance` | Local-only or bank-linked (decide later) |
| 47 | Student delivery / exchange | Phase 2 | `/marketplace` (Exchange tab) | Swap workflow |
| 48 | Borrowing system (return tracking) | Phase 2 | `/marketplace` (Borrow tab) | Due dates, reminders |
| 49 | Campus memories (albums) | Phase 3 | `/memories`, `/memories/[id]` | Photo storage and consent |
| 50 | Alumni network | Phase 2 | `/alumni` | Alumni verification |
| 51 | Mentorship | Phase 3 | `/mentorship` | Mentor vetting |
| 52 | Personal career profile | Phase 2 | `/profile/[username]` (Career tab) | Portfolio links |
| 53 | Everything search | MVP | `/search` | Search index across modules |
| 54 | Trending engine | Phase 2 | `/trending` | Ranking job |
| 55 | Trust & verification (college email, ID, reports, blocks) | MVP | `/verify`, `/settings/privacy` | Email/ID checks, report and block APIs |
| 56 | Admin platform (students, moderation, content, announcements) | MVP | `/admin/*` | Role-based access, audit log |
| 57 | Business dashboard | Phase 3 | `/business` | Business analytics |
| 58 | Monetisation (ads, premium, plans) | Phase 3 | `/business` (Plans tab) | Billing provider |
| 59 | AI moderation | Phase 2 | `/admin/moderation` (AI flags tab) | Start rule-based in MVP, model in Phase 2 |
| 60 | AI recommendation engine | Phase 2 | `/discover`, home suggestions | Needs engagement data first |
| 61 | Dating & connections (opt-in, 18+) | Phase 3 | `/connect` | Age gate, safety review, legal review |

## What the MVP includes (summary)

Identity and verification (1, 55), home feed and dashboard (2, 3, 33), chats (5), Spaces (6),
events (11), opportunities and jobs (12, 14), resources and faculty video lectures (27, 27a), campus
news (42), lost & found (26), marketplace buy/sell (17), search (53), notifications
(30), safety contacts (41), and the admin platform (56).

## Gaps the backend phase must close before the MVP can launch

1. **SOS (module 41):** the screen is a preview. It must alert the campus security desk for real.
2. **Lecture video (27a):** the player is a preview with a simulated timeline. It needs real video
   storage, transcoding and per-student progress.
3. **Verification (55):** college-email codes and ID review are simulated. They need a real email
   service and the admin review queue.
4. **Realtime chat (5):** the thread is local state. It needs a socket connection and persistence.
5. **Moderation (56, 59):** report and flag queues are mock data and actions do nothing server-side.
6. **Spaces (6):** votes, threads and room messages are local state. They need persistence, vote
   integrity (one vote per student) and moderator tools on threads.
| 62 | Sign-in by role (student, teacher, industry expert, office) | MVP | `/login` | College email verification, role approval |
