# CampusConnect — web app

One Next.js codebase that works two ways:

- **Phone:** an app layout with a bottom tab bar (Home · Campus · Discover · Chats · You),
  installable to the home screen.
- **Desktop:** a slim rail on the left, wider pages and side-by-side chats.

Every screen reads live data from the CampusConnect API (`apps/api`).

## Run it

```bash
# from campus-connect/, with the API running on http://127.0.0.1:4000
npm run dev --workspace=web          # http://localhost:3000
npm run type-check --workspace=web
npm run build --workspace=web
```

The browser calls `/api/v1/...` on the web app itself and Next forwards it to the API
(`API_ORIGIN`, default `http://127.0.0.1:4000`), so session cookies stay first-party and there
are no CORS preflights. `npm run dev:alt` starts a second dev server on port 3001 with its own
build folder.

## Look and feel

- **Font:** Kalam for everything (titles, text, buttons, forms). Settings → Appearance also
  offers the device font and Atkinson Hyperlegible for people who find them easier to read.
- **Themes:** Day, Night and Paper, plus text size and reduced motion. All colours are tokens in
  `src/app/globals.css`, one set per theme; components never hard-code colours.
- **Motion:** Framer Motion through `src/components/motion` (respects reduced motion).
- **Lists** load more as you scroll and always end with a clear "You've reached the end".

## Structure

```
src/
  app/             Routes, one folder per screen (App Router)
    admin/         Admin console: overview, approvals, people, moderation, surveys,
                   feedback, inbox, system (sections shown per role)
  components/
    shell/         App shell (tab bar, rail), appearance panel, providers, survey gate
    ui/            Buttons, chips, fields, sheets, toasts, states, infinite list
    motion/        Animation helpers
    chat/ feed/ spaces/ hush/ market/ events/ opportunities/ people/ surveys/ admin/ ...
  lib/
    api/           client.ts (fetch, CSRF, uploads), hooks.ts (useQuery, useInfinite,
                   useAction, invalidate), types.ts and modules.ts (API response types)
    session.tsx    Signed-in user and their saved appearance settings
    roles.ts       What each role can see (tabs, tiles, admin sections, page gates)
    realtime.ts    One WebSocket for chats, typing and read receipts, with reconnect
    store.ts       Per-device preferences and personal notes (localStorage)
    nav.ts         Tabs and which tab each route belongs to
```

## Conventions

- **Data comes from the API hooks.** Use `useQuery` / `useInfinite` with a cache key, and
  `invalidate('prefix')` after a change so every screen showing that data refreshes.
- **Roles:** check `can(user, 'capability')` from `lib/roles.ts` before showing a tab or button.
  The API checks every action again, so hiding is a convenience, not the protection.
- **Mobile first:** layouts are checked at 375px wide; desktop adds the rail.
- **Entrance animations finish without a lasting transform**, which would trap
  `position: fixed` children (tab bar, composers).
