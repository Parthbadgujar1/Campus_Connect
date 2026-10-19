# CampusConnect — Monorepo

A student-focused campus app. The repository currently contains the **mobile-first web front end only**. The backend is removed for the UI/UX phase and will be added back later.

## Quick start

```bash
# from campus-connect/
npm install
npm run dev --workspace=web      # http://localhost:3000
```

## Structure

```
campus-connect/
  apps/
    web/          # Next.js (App Router) + React — phone and web layouts, mock data
  docs/
    product/      # Module roadmap: MVP / Phase 2 / Phase 3
```

## Planning

- [Module roadmap](./docs/product/module-roadmap.md) — the 61 modules and when each ships.
- [Web app guide](./apps/web/README.md) — the design language, routes, conventions and how to run it.

## Tech stack (front end)

| Layer | Technology |
|---|---|
| Web | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4, design tokens for four ambiences (Day, Night, Paper, Dusk); system font |
| Icons | lucide-react |
| Data | Typed mock data in `apps/web/src/data` |
