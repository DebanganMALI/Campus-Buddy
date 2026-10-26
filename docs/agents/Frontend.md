# Frontend.md — Smart Campus Companion
### Role file for the Frontend owner (M2) and their AI agent

> **Read `docs/AGENTS.md` first** (contract, ownership, workflow), then `docs/agents/UI-UX.md` (how everything looks and moves). This file tells you *how to build the React application logic*.
> You own `frontend/**` **except** `frontend/src/three/**`, `frontend/src/layouts/**`, `frontend/public/3d/**` (UI/UX owner). You consume `@scc/shared` (contract) and `@scc/ui` (components). You never import `@scc/db` or any Node-only module.

---

## 0. Agent operating instructions

1. Read `AGENTS.md` → `UI-UX.md` §6, §9, §16 → this file → `shared/src/**`.
2. Plan mode first: one feature or page group per task (e.g., "login + MFA verify pages"). List files, hooks, tests. Wait for approval.
3. **Build order:** §2 app shell → §3 API client → §4 auth provider + guards → §5 routing → §6 data hooks → pages by phase (`AGENTS.md` §11) → §11 tests.
4. **Mock-first:** build every page against MSW mocks (§11.2) so you never wait for the backend. Turn mocks off per endpoint as the real API lands.
5. **Use `@scc/ui` components and tokens only.** If a component is missing, use semantic HTML + tokens temporarily and open an issue for the UI/UX owner — never create a parallel styling system.
6. Never weaken a security rule (§9) to make something work. Ask.

### 0.1 Allowed dependencies (ask before adding others)
`react@19`, `react-dom`, `react-router` (data router — follow the current major's docs), `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod` (via `@scc/shared`), `react-markdown` (no raw HTML plugins), `qrcode` (local QR rendering for MFA), `@tanstack/react-virtual` (long admin tables only), `@scc/ui`, `@scc/shared`.
Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw`, `@faker-js/faker`, `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`. Phase 2: `vite-plugin-pwa`.
**Forbidden:** axios (fetch is enough), Redux, any CSS-in-JS runtime, analytics/tracking scripts, any CDN-loaded script, `rehype-raw`.

---

## 1. Responsibilities at a glance

| You build | You don't build |
|---|---|
| Routing, guards, data fetching, caching, forms, error handling | Visual components and tokens (`@scc/ui`, UI/UX) |
| API client with CSRF, refresh, step-up, error mapping | 3D canvas and Nova (UI/UX) — you only call `useNova().setMood()` |
| Page logic for every route in `UI-UX.md` §9 | Server-side validation and permissions (Backend) |
| Accessibility behaviour: focus management, live regions, titles | Layout shells' look (UI/UX owns `layouts/`; you place pages inside them) |
| Component/integration tests, e2e tests, Lighthouse config | CI workflow files (Backend owns `.github/`; you supply configs) |

---

## 2. App structure

```
frontend/
  index.html  vite.config.ts  tsconfig.json  vitest.config.ts  playwright.config.ts
  lighthouse-budget.json  .lighthouserc.json
  src/
    main.tsx                  # mounts <App/>, starts MSW in dev when VITE_USE_MOCKS=true
    app/
      App.tsx                 # providers: QueryClient, AuthProvider, Router, ToastProvider, StepUpProvider
      router.tsx              # route table (§5)
      query-client.ts         # TanStack Query defaults (§6.1)
    api/
      client.ts               # fetch wrapper (§3)
      csrf.ts                 # in-memory CSRF token store
      errors.ts               # ApiError class + helpers
      endpoints/              # typed functions per domain: auth.ts announcements.ts events.ts resources.ts ...
    auth/
      AuthProvider.tsx  useAuth.ts  guards.tsx  return-url.ts  step-up.tsx  session-expired.tsx
    features/                 # domain logic + feature-level components (compose @scc/ui)
      announcements/ events/ resources/ openings/ search/ bookmarks/ notifications/
      moderation/ admin/ profile/ security/ dashboard/
        hooks.ts  keys.ts  components/  *.test.tsx
    pages/                    # one file per route; thin — compose feature components inside layouts
    mocks/
      browser.ts  server.ts  handlers/  factories/   # MSW + faker factories built on @scc/shared schemas
    lib/
      format.ts  dates.ts  url.ts  a11y.ts  use-document-title.ts  use-online.ts
    three/  layouts/          # OWNED BY UI/UX — import only
  e2e/                        # Playwright specs
```
Rule: **pages are thin** (layout + feature components); **features hold logic**; **api/** holds network code only.

### 2.1 Vite config essentials
```ts
// frontend/vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:4000", changeOrigin: false } }, // same-origin in dev
  },
  build: {
    target: "es2022",
    sourcemap: "hidden",        // maps generated for error tracking, not served publicly
    rollupOptions: { output: { manualChunks: { three: ["three", "@react-three/fiber", "@react-three/drei"] } } },
  },
});
```
Env vars (`VITE_*` are **public** — never put secrets there): `VITE_TURNSTILE_SITE_KEY`, `VITE_USE_MOCKS`, `VITE_APP_NAME`. The API base is always the relative path `/api`.

---

## 3. API client (`src/api/client.ts`)

### 3.1 Behaviour (implement exactly)
1. `fetch("/api" + path, { credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" } })`.
2. For POST/PUT/PATCH/DELETE add `X-CSRF-Token` from the in-memory store. If the store is empty, call `GET /api/auth/csrf` first.
3. After **every** response, if it carries an `X-CSRF-Token` header, update the store.
4. Timeout 15 s via `AbortSignal.timeout`, combined with the caller's signal (`AbortSignal.any`).
5. Non-2xx → parse `{ code, message, requestId, issues }` → throw `ApiError`.
6. Automatic recovery (each at most **once** per request):
   - `ACCESS_TOKEN_EXPIRED` → **single-flight** `POST /api/auth/refresh` (all concurrent 401s wait for the same promise) → retry.
   - `REFRESH_IN_PROGRESS` (from refresh) → wait 300 ms → retry the original request.
   - `CSRF_INVALID` → `GET /api/auth/csrf` → retry.
   - `STEP_UP_REQUIRED` → open the global `StepUpDialog`; on success retry; on cancel reject with the original error.
7. Refresh failure (`SESSION_EXPIRED` / `SESSION_REVOKED` / `UNAUTHENTICATED`) → clear query cache, set auth state to anonymous, open the session-expired modal (keeps the return URL).
8. In development and tests, validate response bodies with the matching `@scc/shared` DTO schema (`schema.parse`) to catch contract drift early; in production skip parsing for speed but keep TypeScript types.

### 3.2 Reference implementation
```ts
// src/api/client.ts
import { ApiError, isApiError } from "./errors";
import { csrf } from "./csrf";
import { stepUp } from "../auth/step-up";
import { onSessionLost } from "../auth/session-expired";
import type { ZodType } from "zod";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let refreshing: Promise<void> | null = null;

async function ensureCsrf() { if (!csrf.get()) await raw("GET", "/auth/csrf"); }

async function raw(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (UNSAFE.has(method)) { const t = csrf.get(); if (t) headers["X-CSRF-Token"] = t; }
  const res = await fetch(`/api${path}`, {
    method, headers, credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
  });
  const next = res.headers.get("X-CSRF-Token");
  if (next) csrf.set(next);
  return res;
}

async function toError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => ({}));
  return new ApiError(res.status, data.code ?? "INTERNAL_ERROR", data.message ?? "Something went wrong",
    data.requestId ?? res.headers.get("X-Request-Id") ?? undefined, data.issues,
    Number(res.headers.get("Retry-After")) || undefined);
}

async function refreshOnce(): Promise<void> {
  refreshing ??= (async () => {
    try {
      await ensureCsrf();
      let res = await raw("POST", "/auth/refresh");
      if (res.status === 409) { await new Promise((r) => setTimeout(r, 300)); return; } // another tab rotated
      if (!res.ok) throw await toError(res);
    } finally { queueMicrotask(() => { refreshing = null; }); }
  })();
  return refreshing;
}

export async function api<T>(method: string, path: string, opts: {
  body?: unknown; signal?: AbortSignal; schema?: ZodType<T>; _retried?: Set<string>;
} = {}): Promise<T> {
  const retried = opts._retried ?? new Set<string>();
  if (UNSAFE.has(method)) await ensureCsrf();
  const res = await raw(method, path, opts.body, opts.signal);
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const json = await res.json();
    return import.meta.env.PROD || !opts.schema ? (json as T) : opts.schema.parse(json);
  }
  const err = await toError(res);
  const again = () => api<T>(method, path, { ...opts, _retried: retried });
  try {
    if (err.code === "ACCESS_TOKEN_EXPIRED" && !retried.has("refresh")) { retried.add("refresh"); await refreshOnce(); return again(); }
    if (err.code === "CSRF_INVALID" && !retried.has("csrf")) { retried.add("csrf"); csrf.clear(); await ensureCsrf(); return again(); }
    if (err.code === "STEP_UP_REQUIRED" && !retried.has("stepup")) { retried.add("stepup"); await stepUp.request(); return again(); }
  } catch (e) {
    if (isApiError(e) && ["SESSION_EXPIRED", "SESSION_REVOKED", "UNAUTHENTICATED"].includes(e.code)) onSessionLost();
    throw e;
  }
  if (["SESSION_EXPIRED", "SESSION_REVOKED"].includes(err.code)) onSessionLost();
  throw err;
}
```
Endpoint modules wrap it with typed functions, e.g. `export const getMe = (s?: AbortSignal) => api<MeResponse>("GET", "/auth/me", { signal: s, schema: meResponse })`.

### 3.3 Direct-to-storage upload (resources, CSV import)
1. `POST /api/resources/upload-url` → `{ resourceId, uploadUrl, headers }`.
2. Upload with **`XMLHttpRequest`** (for progress events): `PUT uploadUrl`, set exactly the returned `headers`, **no credentials, no CSRF header** (it's the storage host, not our API).
3. `POST /api/resources/:id/complete` → `{ status: "pending_scan" }`.
4. Poll `GET /api/resources/:id` every 2 s (max 60 s, back off to 5 s) until status leaves `pending_scan`; show `published`, `pending_review`, or the rejection reason.
5. Validate type and size **before** requesting the URL (shared limits) for instant feedback — the server still re-validates.

---

## 4. Authentication in the browser

### 4.1 Boot sequence
`AuthProvider` on mount: `GET /api/auth/csrf` → `GET /api/auth/me`.
- 200 → state `authenticated` with `{ user, permissions, mfa }`.
- 401 → state `anonymous`.
- 403 `MFA_ENROLLMENT_REQUIRED` → state `mfaEnrollmentRequired` (user is logged in but must finish MFA setup).
Render a full-screen skeleton (from `@scc/ui`) until the state resolves — never flash protected content.

```ts
type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "mfaEnrollmentRequired"; user: UserDTO }
  | { status: "authenticated"; user: UserDTO; permissions: Permission[]; mfa: { enabled: boolean; required: boolean } };
```
`useAuth()` exposes `state`, `can(permission)` (uses `hasPermission` from `@scc/shared` with the role — **UI convenience only**, server still enforces), `login()`, `verifyMfa()`, `logout()`, `logoutAll()`, `refetchMe()`.

### 4.2 Guards (`auth/guards.tsx`)
| Guard | Behaviour |
|---|---|
| `<RequireAuth>` | anonymous → redirect `/login?returnTo=<current path>`; `mfaEnrollmentRequired` → `/mfa/setup` |
| `<RequirePermission p="...">` | missing → render the Forbidden state (UI-UX §9.3), not a redirect |
| `<GuestOnly>` | authenticated → `/dashboard` (login/register pages) |
| `<RequireMfaPending>` | `/mfa/setup` only reachable when logged in |

**Open-redirect protection** (`return-url.ts`): accept `returnTo` only if it starts with a single `/`, does not start with `//` or `/\`, contains no scheme, and resolves to the same origin (`new URL(returnTo, location.origin).origin === location.origin`). Otherwise use `/dashboard`.

### 4.3 Flows
**Login page:** RHF form (`loginSchema`). Submit → `POST /auth/login`.
- `status: "OK"` → `refetchMe()` → navigate to `returnTo` → `useNova().setMood("success", 1500)`.
- `status: "MFA_REQUIRED"` → keep `challengeId` **in memory** (React state passed via router state, never in the URL or storage) → `/login/mfa`.
- `INVALID_CREDENTIALS` → show the generic message, focus the password field, `setMood("error", 1200)`.
- `ACCOUNT_LOCKED` / `RATE_LIMITED` → countdown from `retryAfter`, disable submit, `setMood("locked")`.
- `CAPTCHA_REQUIRED` → render Turnstile (script loaded only now, from `https://challenges.cloudflare.com`), resubmit with `turnstileToken`.
- `EMAIL_NOT_VERIFIED` → banner + "Resend verification" (calls `/auth/resend-verification`, always shows the same confirmation).
- "Continue with Google" is a plain `<a href="/api/auth/google">` (full-page navigation; no Google script). Show `?error=sso_failed` as a generic banner.

**MFA verify:** `OtpField` auto-submits at 6 digits; recovery-code toggle; on `MFA_INVALID` clear and refocus; if the challenge is missing (page refresh) → back to `/login` with a notice.

**MFA setup (3 steps):** enrol → render QR **locally** with `qrcode` (`toDataURL`) + manual key with copy button → confirm code → show 10 recovery codes (copy / download `.txt` generated client-side with `Blob`) → require "I saved these codes" checkbox → `refetchMe()` → dashboard. Clear codes from memory on unmount.

**Register / forgot / reset / verify / accept-invite:** always show the API's generic confirmations; never imply whether an account exists. Password fields use `autocomplete="new-password"`, show the strength meter, and surface the server's "found in a breach" message on `VALIDATION_ERROR`.

**Logout:** `POST /auth/logout` → `queryClient.clear()` → reset Nova → `/login`. **Logout everywhere** on the Security page.

**Session lost** (`onSessionLost`): clear cache, show the session-expired dialog with "Log in again" (keeps `returnTo`). Never loop: if already on `/login`, just reset state.

### 4.4 Step-up (`auth/step-up.tsx`)
A promise-based controller: `stepUp.request()` opens `StepUpDialog` (password, or TOTP if `mfa.enabled`) → `POST /auth/reauth` → resolves; cancel → rejects. Only one dialog at a time; concurrent requests await the same promise. Used automatically by the API client (§3.1 step 6).

### 4.5 Security page
Sessions list (`GET /auth/sessions`, `SessionRow`), revoke (`DELETE /auth/sessions/:id`), sign out other devices, change password (then the backend revokes other sessions — refetch the list), MFA status (disable hidden for staff), regenerate recovery codes (step-up), download my data (step-up), delete account (step-up + type `DELETE`).

---

## 5. Routing (`app/router.tsx`)

Every page is **lazy-loaded** (`lazy: () => import(...)`). Showcase routes may load the 3D chunk; workspace routes must not (UI-UX §13).

| Path | Page | Layout (UI/UX) | Guard |
|---|---|---|---|
| `/` | Landing | Showcase | — |
| `/login`, `/login/mfa`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/accept-invite` | Auth pages | Auth | `GuestOnly` (except verify/reset/invite: public) |
| `/mfa/setup` | MFA setup | Auth | `RequireMfaPending` or authenticated |
| `/dashboard` | Dashboard (role-tailored) | Workspace | `RequireAuth` |
| `/announcements`, `/announcements/:id` | List / detail | Workspace | `RequireAuth` |
| `/announcements/new`, `/announcements/:id/edit` | Editor | Workspace | `RequirePermission announcement:create` (+ policy check from API on save) |
| `/events`, `/events/:id`, `/events/new`, `/events/:id/edit` | Events | Workspace | as above with `event:*` |
| `/resources`, `/resources/:id`, `/resources/upload` | Resources | Workspace | upload: `resource:create` or `resource:submit` |
| `/openings`, `/openings/:id`, `/openings/new`, `/openings/:id/edit` | Openings | Workspace | create/edit: `opening:create` |
| `/leaving/:openingId` | External link interstitial | Workspace | `RequireAuth` |
| `/search` | Search results | Workspace | `RequireAuth` |
| `/bookmarks`, `/notifications` | Lists | Workspace | `RequireAuth` |
| `/me`, `/me/security`, `/me/settings` | Profile | Workspace | `RequireAuth` |
| `/moderation` | Queue | Workspace | `RequirePermission moderation:review` |
| `/admin/users`, `/admin/audit`, `/admin/analytics` | Admin | Workspace | `RequirePermission user:read` / `audit:read` / `analytics:read` |
| `/offline`, `*` | Offline / 404 | Showcase | — |

On every navigation: set `document.title` (`<Page> · Campus Companion`), move focus to the page `h1` (or the skip-link target), and announce the page name in a polite live region.

---

## 6. Server state (TanStack Query)

### 6.1 Defaults
```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,   // never retry 4xx
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
```

### 6.2 Query keys (one factory per feature, `features/*/keys.ts`)
```ts
export const announcementKeys = {
  all: ["announcements"] as const,
  list: (f: AnnouncementFilters) => [...announcementKeys.all, "list", f] as const,
  detail: (id: string) => [...announcementKeys.all, "detail", id] as const,
};
```
| Data | staleTime | Notes |
|---|---|---|
| `me` | 5 min | refetch after login, profile/role changes |
| Feeds/lists | 30 s | `useInfiniteQuery` with `nextCursor`; "Load more" / infinite scroll with a visible button fallback |
| Details | 60 s | seed from list cache (`initialData`) when available |
| Resources filter | 2 min | filters live in the **URL search params** (shareable, back-button friendly) |
| Search | 30 s | debounce 250 ms, abort previous request via the query `signal` |
| Notifications unread count | 60 s | poll only while the tab is visible (`refetchInterval` + `document.visibilityState`) |
| Admin tables | 0 (always fresh) | server-side filtering + cursor pagination |

### 6.3 Mutations
- Invalidate precisely (`queryClient.invalidateQueries({ queryKey: announcementKeys.all })`) after create/update/delete.
- **Optimistic updates** only for low-risk toggles: bookmarks and "applied" tracking (roll back on error).
- **Never optimistic** for RSVP (capacity decides), moderation, admin actions, auth.
- Disable submit while pending; show `loading` on the `Button`; prevent double submission.

---

## 7. Forms

- `react-hook-form` + `zodResolver(<schema from @scc/shared>)` — the **same schema** the server uses.
- Map server `VALIDATION_ERROR.issues` to fields with `setError(path, { message })`; unknown paths go to a form-level error summary at the top (focused on submit failure).
- Correct `autocomplete`: `email`, `current-password`, `new-password`, `one-time-code`, `name`, `tel`.
- Long forms (announcement editor, opening form): autosave draft **in memory** per route; warn on unsaved navigation (`useBlocker`).
- Audience picker writes `{ departments, years }` with the `["ALL"]` convention from the contract.
- Markdown editor preview renders with `react-markdown` (raw HTML disabled by default — keep it that way); links get `rel="noopener noreferrer nofollow"` and `target="_blank"`; only `http`, `https`, `mailto` URLs (react-markdown's default URL transform — don't override it).

---

## 8. Feature notes

| Feature | Logic to implement |
|---|---|
| **Dashboard** | Role-based composition from `useAuth().state.user.role`: feed (announcements + events merged by date), upcoming events, openings closing soon, bookmarks; staff: "Your posts"; admin: KPI tiles from `/admin/analytics/summary`. "New since last visit" badge uses the feed's first page vs. the user's last seen marker (`me.feed.lastSeenAt`; call `POST /api/profile/feed-seen` once the feed has been viewed). |
| **Resources** | Cascading filters dept → year → sem → subject (each select enabled after the previous), synced to URL; empty state per step; download = `GET /resources/:id/download` then `window.location.assign(url)` (storage sends `Content-Disposition: attachment`). |
| **Openings** | `DeadlineChip` from `closesAt`; tracker toggle (optimistic); "Apply" navigates to `/leaving/:openingId`, which **fetches the opening by id** and shows its `applyUrl` domain before continuing — the interstitial never accepts a URL from the query string (prevents open redirects). |
| **Events** | RSVP button reflects `myRsvp` + capacity; on response show going/waitlisted; `.ics` is a normal link to `/api/events/:id/ics`. |
| **Search** | `CommandPalette` (⌘K / Ctrl K) + `/search` page share one hook; grouped results; keyboard navigation per UI-UX. |
| **Moderation** | Keyboard shortcuts `J/K/A/R` only when focus is not in a text field; reject requires a reason. |
| **Admin users** | Server-side filters in URL params; role/status changes go through `ConfirmDialog` (step-up handled by the client automatically); after success refetch the row and show a toast; CSV import shows job progress by polling `/admin/jobs/:id`. |
| **Notifications** | Bell with unread count; list with mark-read; links are relative app paths only. |

### 8.1 Nova hooks (contract with UI/UX)
Call `useNova.getState().setMood(...)` per `UI-UX.md` §7.2 / §16.1: login success → `success`; auth errors → `error`; locked/rate-limited → `locked`; submitting → `thinking`; MFA screens → `shield`; 404/offline → `sleep`. On auth pages, call `setLookAt(inputEl.getBoundingClientRect())` on input focus. Never block UI on Nova (it may not be rendered at all).

---

## 9. Security rules (browser)

- **No tokens in JS.** Auth is cookie-based; the CSRF token lives only in memory (`api/csrf.ts`).
- `localStorage` only for non-sensitive UI flags (dismissed banner, sidebar collapsed). **Never** user data, query cache persistence, challenge IDs, recovery codes, or search history containing personal data.
- **No `dangerouslySetInnerHTML`** (ESLint rule `react/no-danger` = error). Markdown via `react-markdown` only.
- **No third-party scripts** except Turnstile, loaded on demand on the login challenge.
- Open-redirect protection for `returnTo` (§4.2) and the opening interstitial (§8).
- Clear `queryClient` and in-memory sensitive state on logout and session loss.
- No `console.log` of API responses (`no-console` error in production builds; dev-only logger).
- Generic auth error messages exactly as returned; never compose messages that reveal account existence.
- Production source maps are not served (`sourcemap: "hidden"`).
- External links in user content: `rel="noopener noreferrer nofollow"`.
- The CSP (set by nginx, `Backend.md` §12.3) forbids inline scripts and `eval` — don't use libraries that need them. React's `style` prop is fine (set via DOM APIs).

---

## 10. Performance and accessibility

**Performance** (budgets in `UI-UX.md` §13; enforced by Lighthouse CI):
- Route-level code splitting; prefetch the next likely route on link hover/focus (`queryClient.prefetchQuery` + route `lazy` preload).
- No 3D or `three` import in workspace routes (verify with the bundle report `npx vite-bundle-visualizer` before merging).
- Virtualise admin tables with > 200 rows (`@tanstack/react-virtual`).
- Images: `loading="lazy"`, explicit `width`/`height`, `srcset` from the API when available.
- Avoid re-render storms: memoise list rows, keep form state local, select narrow slices from queries (`select` option).

**Accessibility** (UI-UX §12 is the checklist; your parts):
- Focus to `h1` on route change; restore focus after dialogs (handled by `@scc/ui` Dialog — don't break it).
- Announce async results ("12 resources found", "Saved") in a polite live region (`lib/a11y.ts`).
- Form error summary with links to fields on submit failure.
- Keyboard support for every custom interaction you add; shortcuts documented and disabled inside inputs.

---

## 11. Testing

### 11.1 Unit and component (Vitest + Testing Library, `jsdom`)
- Test behaviour through the UI (roles/labels), not implementation details.
- Required: API client (refresh single-flight with 5 concurrent 401s → one refresh call; CSRF retry; step-up retry; session loss), `return-url` validator (table of malicious inputs: `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:alert(1)`, encoded variants), guards, login/MFA/register forms with every error code, resources cascading filters, upload flow states, admin confirm + step-up flow.
- Coverage ≥ **75% lines** for `src/api`, `src/auth`, `src/features`.

### 11.2 MSW mocks (`src/mocks/`)
- Handlers for **every** endpoint in `AGENTS.md` §5.8, returning data from faker **factories that build objects with the `@scc/shared` schemas** (parse the factory output so mocks can't drift from the contract).
- Scenario switches via query string or a dev panel: `?mock=locked`, `?mock=mfa`, `?mock=step-up`, `?mock=empty`, `?mock=slow`, `?mock=500` — so UI/UX and you can design and test every state.
- The same handlers power unit tests (`msw/node`) and dev mode (`msw/browser`, enabled with `VITE_USE_MOCKS=true`). Mocks are **never** included in production builds (dynamic import behind the env flag).

### 11.3 End-to-end (Playwright, `frontend/e2e/`)
Run against the full local stack (`docker compose` + seeded DB). Specs:
1. Register → read verification email via the **Mailpit API** → verify → login.
2. Faculty login with MFA (TOTP generated in the test from the seeded test secret) → publish announcement → student sees it.
3. Student resources flow: filter dept → year → sem → subject → download (assert the signed URL response).
4. Upload as faculty → status reaches `published` (dev scan stub).
5. Student opens an admin URL → Forbidden state; API call returns 403.
6. Admin suspends a student (step-up) → the student's next action shows session-expired.
7. Refresh rotation: expire access token (test hook) → request succeeds after silent refresh.
8. ⌘K search returns mixed types.
9. Accessibility: `@axe-core/playwright` on every route (zero serious/critical).
Projects: Chromium desktop + Pixel 7 emulation (mobile). Traces on failure.

### 11.4 Lighthouse CI
`.lighthouserc.json` runs against `vite preview` for `/`, `/login`, `/dashboard` (mocked), `/resources` (mocked) with `lighthouse-budget.json` (from UI-UX §13). Backend wires it into `lighthouse.yml`.

---

## 12. PWA (phase 2, only if time allows)
`vite-plugin-pwa` with **static assets only** in the precache; `/api/*` is **network-only** (no caching of personal data in the service worker); offline fallback page `/offline`; update prompt toast. Ask before enabling.

---

## 13. Definition of Done (Frontend)
- [ ] Uses `@scc/shared` schemas/types and `@scc/ui` components only; no ad-hoc styles beyond tokens.
- [ ] Works against MSW mocks **and** the real API; every error code relevant to the page handled per UI-UX §16.1.
- [ ] Guards correct; no protected content flashes; `returnTo` safe.
- [ ] Tests added (component + e2e where the flow is user-critical); axe clean; Lighthouse budget passes.
- [ ] Keyboard, focus, live-region behaviour verified; mobile 360 + desktop 1440 screenshots in the PR.
- [ ] No new dependency without approval; no secrets or personal data in code, mocks or screenshots.
