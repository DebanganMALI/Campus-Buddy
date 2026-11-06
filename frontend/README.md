# Frontend — Smart Campus Companion

React + Vite. Owners: Sweta (logic), Tanisha (UI/UX).

## Run

```bash
cd frontend
npm install
npm run dev        # mock mode: a fake API runs in the browser (no backend needed)
npm run dev:api    # real mode: calls the backend on http://localhost:4000 via /api
npm run typecheck
```

Open http://localhost:5173. In mock mode, sample logins are shown on the login page.

## Notes
- `frontend/` is a standalone app (not in the root workspaces), so it installs even while the root install is broken.
- The shared contract is read from `../shared/src` (see `vite.config.ts` and `tsconfig.json`), so it uses the same validation rules as the backend.
- Auth uses httpOnly cookies set by the server. No tokens in localStorage. The CSRF token is kept in memory.
- Role guards in the UI are a convenience only. The server must refuse forbidden calls (403).
