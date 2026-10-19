# CampusConnect — Web app (mobile-first front end)

This is the front end for the CampusConnect student platform. It is one React codebase that works
two ways:

- **On a phone:** an app layout with a bottom tab bar: **Home · Campus · Discover · Chats · You**.
  The site is installable to the home screen (PWA manifest and icon).
- **On a computer:** the web portal, with a slim rail on the left and split views for chats and
  Space rooms.

It is built with Next.js (App Router) and React. **In this phase it runs entirely on mock data.**
The backend has been removed from the repository for the UI/UX phase and will be added later. See
[`docs/product/module-roadmap.md`](../../docs/product/module-roadmap.md) for what each module
includes and when it ships.

## Run it

```bash
# from campus-connect/
npm install
npm run dev --workspace=web      # http://localhost:3000
```

Check the production build and types:

```bash
npm run build --workspace=web
npx tsc --noEmit -p apps/web/tsconfig.json
```

## Design language

Brand: **Deep Blueberry** `#302675` (primary actions, active navigation), **Cream** `#F8F5ED` (page
background), **Soda Green** `#B8F28B` (highlights and positive accents), **Ink** `#252333` (text), white
(cards and menus). Typography: **Kalam** for headings and highlight labels (page headings 30–32px bold, section headings 20px), **Patrick Hand** for body text (15–16px), and **Inter** for navigation, buttons and forms (buttons 14–15px semibold, captions 13–14px). All colours are tokens in `src/app/globals.css`, one set per ambience (Day, Night, Paper, Dusk).

- **Sign in first.** Students, teachers, industry experts and the campus office sign in at `/login`. Each
  role lands on its own Home: students see the feed, teachers their lecture and question tools, experts
  mentoring and referrals, and the office what needs a decision.
- **Home** (students): Happening soon, Closing soon and Notices, then For you, Boards, Loops and Hush previews.
- **Campus:** Study first (Focus, Stacks, Your ink, Lectures, Study together), then College life, Career and Living.
- **Discover:** Boards (threads from your spaces), Loops (endless short videos), Hush (anonymous
  questions and answers) and Playroom (quick games and live tables), then Pulse, Makers, Beyond campus,
  Meme wall and Crossed paths.
- **Chats:** notes above your friends, a camera for quick snaps, communities with their groups, filters,
  read receipts, and per-chat actions. Inside a chat: reply, forward, copy, delete for you, reactions,
  saved messages, disappearing messages, calls on Google Meet or Jitsi, and group admins.
- **Profile:** a complete profile for you (posts, loops, about, badges, your ink) and a matching public
  profile for everyone else.
- **Ambiences.** Day, Night, Paper (reading) and Dusk, plus text size and Calm motion.

## Structure

```
src/
  app/                   Routes (one folder per screen; about 75 screens)
    layout.tsx           Root layout, fonts, ambience init script, app shell
    page.tsx             Home: greeting, live campus, Moments, "Your day" flow, Stream
    campus/              Campus hub: college, live places, study tools, shelves
    discover/            Discover: worlds bento (Watch, Spaces, Loops, Arcade, Study) and live now
    chats/               Split-view chats (list + conversation)
    you/                 Profile hub, momentum, ambience, Kept
    spaces/              Spaces index, space (board/rooms/events/members/about), threads, rooms, new
    watch/               Watch hub, video player (v/[id]), watch parties (party/[id])
    loops/               Full-screen loops
    games/               Arcade, memory, reflex, quiz
    study/               Study hub, focus, flashcards, notes, live rooms
    admin/               Admin portal (role-gated) — students, moderation, lectures, content, announcements
  components/
    shell/               App shell (dock, rail, aura), ambience panel, providers
    ui/                  Primitives: buttons, chips, tabs, sheet, toast, fields, layout
    chat/                Conversation view (lanes, bloom, snaps) and chat list
    feed/                Post card, Moments rail and viewer
    spaces/ watch/       Votes; video cards
    common/ events/      Shared cards (tickets, market, housing, opportunities), map, QR
  data/                  Mock data, typed (`src/lib/types.ts`), one file per domain
  lib/
    store.ts             Per-viewer state (ambience, kept, RSVP, joined, votes, notes…), persisted locally
    time.ts              Fixed prototype clock (Wed 14 Oct 2026, IST) and date helpers
    nav.ts               Tabs, route-to-tab mapping, full-screen routes
```

## Conventions

- **Screens depend on the data getters, not on fixed arrays.** When the backend arrives, change the
  data layer (`src/data`) to fetch and keep the screens as they are.
- **Mobile first.** Phone layouts are checked at 375px. Desktop adds the rail and split views.
- **Colours are tokens** in `src/app/globals.css`, defined once per ambience. Do not hard-code
  colours in components.
- **Entrance animations are short and use `backwards` fill**, so a finished animation leaves no transform or
  filter behind. A lasting transform would trap `position: fixed` children (docks, composers).
- **Demo role.** You → Preview as switches between Student, Faculty and Admin. The real app takes
  the role from sign-in.
