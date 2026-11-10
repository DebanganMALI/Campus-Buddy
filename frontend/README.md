# Frontend — Smart Campus Companion

React 19 + Vite 7 + TypeScript. Owners: Sweta Mandal and Tanisha Nandi.

## Run

```bash
cd frontend
npm install        # first time, and after pulling changes
npm run dev        # mock mode: a fake API runs in the browser (no backend needed)
npm run dev:api    # real mode: /api goes to the backend on http://localhost:4000
npm run typecheck
npm run build
```

Open http://localhost:5173. Mock logins are listed on the login page (password `demo-password-123`).

## What's here

| Area | Routes |
|---|---|
| Auth | `/login`, `/register` (split-screen) |
| Home | `/dashboard` — hero, featured + latest announcements, upcoming events, closing-soon openings, role-aware quick actions |
| Announcements | list (search, pinned, sort) · detail · `/new` · `/:id/edit` · delete |
| Events | upcoming/past · detail · `/new` · `/:id/edit` · delete |
| Resources | dept → year → sem → subject explorer · download · `/resources/upload` (faculty publish, students submit for review) |
| Opportunities | list (type, closing this week) · detail · `/leaving/:id` external-link check |
| Search, bookmarks, profile | `/search`, `/bookmarks`, `/me` (own profile only) |
| Admin | `/admin/users` — search, filter, suspend / reactivate |

## Design system
- Tokens: `src/styles/tokens.css` (colours, type, space, radius, motion). Styles: `src/styles/base.css`.
- Fonts (self-hosted): Newsreader (headlines) + Archivo (interface).
- Light editorial content; every section page opens with a night band (aurora light + its own line illustration in `components/Art.tsx`).
- One accent per section, for wayfinding: mint = announcements, sky = events, sand = resources, coral = opportunities (`--cat-*` tokens).
- Dashboard: "almanac" hero (today's date + coming-up timeline), Explore bento with one live line of real data per tile.
- Event covers are generated gradients (not posters); opportunities show company monograms.
- All text pairs ≥ 4.5:1 contrast.
- Mobile < 768 px · tablet 768–1023 px (bottom tab bar) · desktop ≥ 1024 px (pill navigation).
- `prefers-reduced-motion` turns animations off.

## Rules
- Auth uses httpOnly cookies set by the server. No tokens in localStorage. CSRF token in memory.
- Role guards in the UI are a convenience only. The server must return 403/404 (see `CONTRACT-GAPS.md`).
- No `dangerouslySetInnerHTML`. User text is shown as plain text.
- Mock data is fictional. Never put real student data in `src/mocks/`.
