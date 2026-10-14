# AGENTS.md — Smart Campus Companion
### The shared rulebook for every human and every AI agent working in this repo

> **Every agent reads this file first, every session.** Then it reads its own role file:
> `docs/agents/Backend.md` · `docs/agents/Frontend.md` · `docs/agents/Database.md` · `docs/agents/UI-UX.md`.
> If a role file conflicts with this file, **this file wins**. If this file is unclear, **stop and ask the human** — do not guess on anything in the contract (§5–§7).

---

## 1. Project in one paragraph

Smart Campus Companion is a secure web app that gives a college one dashboard for **announcements, events, study resources and job/internship openings**. Five roles — **student, faculty, moderator, placement officer, admin** — see and do different things, and **every permission is enforced on the server**. Stack: **MongoDB + Express + React + Node (MERN), TypeScript everywhere**. Target: **1 lakh users** at launch, designed to grow to **10–20 lakh** without a rewrite. Security target: **OWASP ASVS Level 2** (Level 3 controls for auth/admin) and the **OWASP API Security Top 10**. Hard deadline: **20 Nov 2026** (cut scope, not time).

### 1.1 In scope
Auth (email + password, Google SSO for the college domain, MFA, sessions), RBAC, announcements, events (RSVP), resources (upload, scan, filter, download), openings (eligibility, tracker), search, bookmarks, in-app + email notifications, moderation queue, admin (users, roles, suspend, invite, audit log, analytics), landing page with 3D mascot.

### 1.2 Out of scope (do not build, do not "prepare" for)
Payments, attendance, exams/grades, chat/DMs, push notifications to phones, AI/LLM features, native mobile apps, multi-college tenancy (data model stays tenant-ready, nothing more).

---

## 2. Team and ownership

| Member | Role file | Owns (may edit) | Also responsible for |
|---|---|---|---|
| **M1 — Backend (Coordinator)** | `Backend.md` | `backend/**`, `.github/**`, root config files | Integration, CI/CD, deployment, merging `dev → main` |
| **M2 — Frontend** | `Frontend.md` | `frontend/**` **except** the UI/UX folders below | API client, routing, state, page logic, e2e tests |
| **M3 — Database** | `Database.md` | `database/**` | Models, indexes, migrations, seed data, query helpers, backups plan |
| **M4 — UI/UX** | `UI-UX.md` | `ui/**`, `ui/design/**`, `frontend/src/three/**`, `frontend/src/layouts/**`, `frontend/public/3d/**` | Figma, design tokens, components, 3D mascot, accessibility |
| **Everyone (shared)** | — | `shared/**`, `AGENTS.md`, `docs/api/**` | Changes need approval from **all four** (§9.4) |

**Rule of ownership:** an agent edits **only** files in its owner's folders. If you need a change elsewhere, open a GitHub issue (template "Change request") assigned to the owner, or propose it in your PR description — never edit it yourself.

Replace `@m1-github … @m4-github` in `.github/CODEOWNERS` with real usernames on Day 0.

---

## 3. Tooling setup per AI tool

This file lives at `docs/AGENTS.md` to keep the repo root clean, so tools won't find it automatically. Start every agent session by attaching it (in Antigravity, @-mention `docs/AGENTS.md` and your role file).

Each person starts every agent session with: *"Read AGENTS.md and docs/agents/<MyRole>.md, then make a plan for: <task>."* Use **plan mode**, review the plan, then approve.

---

## 4. Repository layout

```
Campus-Buddy/
├── backend/   @scc/backend # Express 5 API (src/), worker (src/worker/), docker-compose.yml, .env.example (M1)
├── database/  @scc/db      # Mongoose models, indexes, migrations, seed, query helpers (M3)
├── frontend/  @scc/frontend# React 19 + Vite SPA                      (M2, parts M4)
├── shared/    @scc/shared  # Zod schemas, DTO types, roles, permissions, error codes (ALL)
├── ui/        @scc/ui      # Design tokens, components, design/ (Figma exports, 3D scripts) (M4)
├── docs/                   # AGENTS.md, agents/ (role guides), api/, adr/, lab/
├── .github/                # CI workflows, CODEOWNERS, PR template (M1)
├── .editorconfig  .gitattributes  .gitignore
├── eslint.config.js  package.json  tsconfig.base.json
└── README.md
```
**Keep the root minimal.** Anything that belongs to one member goes inside their folder (their own `.env.example`, Docker files, configs). Root files are only the ones every package shares.
Each member adds their folder to the root `workspaces` list when they create it.

### 4.1 Dependency direction (never break this)
```
frontend ──► ui ──► (nothing internal)
frontend ──► shared
backend ──► shared, database
backend/src/worker ──► shared, database
database ──► shared
shared ──► (nothing internal; only zod)
```
`frontend` must **never** import `database`, `backend`, `mongoose`, or any Node-only module.

---

## 5. The contract (the most important section)

The contract lives in **`shared`**. It is the single source of truth for request bodies, response shapes, roles, permissions and error codes. Backend validates with these schemas; Frontend types its client and forms with them; Database aligns model fields with them; UI/UX labels roles and states with them.

### 5.1 `shared` layout
```
shared/src/
  index.ts
  constants.ts        # DEPARTMENTS, YEARS, SEMESTERS, limits (file size, page size), cookie/header names
  roles.ts            # ROLES, PRIVILEGED_ROLES
  permissions.ts      # PERMISSIONS, ROLE_PERMISSIONS, can(), hasPermission()
  errors.ts           # ERROR_CODES + HTTP status map
  schemas/
    common.ts         # objectId, cursor, pagination, audience, isoDate
    auth.ts  user.ts  announcement.ts  event.ts  resource.ts  opening.ts
    bookmark.ts  notification.ts  moderation.ts  admin.ts  search.ts
  dto/                # inferred TS types: export type UserDTO = z.infer<typeof userDto>
```
Build: `tsc` to `dist/` (ESM + `.d.ts`). Root `postinstall` builds it, so a fresh clone works after `npm install`.

### 5.2 Conventions for every endpoint
- Base path **`/api`**. JSON only (`Content-Type: application/json`), except file uploads which go **directly to object storage** via presigned URLs (never through the API).
- IDs are 24-char hex strings in field **`id`** (never expose `_id` or `__v`).
- Dates are **ISO 8601 UTC strings** (`2026-11-20T09:30:00.000Z`).
- Field names **camelCase** in JSON and in MongoDB.
- **Lists:** `GET ?limit=20&cursor=<opaque>` → `{ "items": [...], "nextCursor": "…" | null }`. `limit` max 50. Cursor = base64url of `{ sortValue, id }`. **No offset pagination.**
- **Create** returns `201` + the created DTO. **Update** (`PATCH`, partial) returns `200` + the DTO. **Delete** returns `204` (soft delete for content).
- Unknown body fields are **rejected** (`.strict()` schemas) → `400 VALIDATION_ERROR`.
- Server-owned fields (`id`, `authorId`, `role`, `status` of others, `createdAt`, counters) are never accepted from the client.

### 5.3 Error format
Every non-2xx response:
```json
{ "code": "VALIDATION_ERROR", "message": "Human-readable, safe to show", "requestId": "req_01J…",
  "issues": [ { "path": "email", "message": "Enter a valid email" } ] }
```
`issues` only for `VALIDATION_ERROR`. **Never** include stack traces, SQL/Mongo details, internal IDs of other users, or whether an account exists.

### 5.4 Error codes (final list — add only via §9.4)

| Code | HTTP | Meaning / client action |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Show `issues` on fields |
| `CAPTCHA_REQUIRED` | 400 | Show Turnstile, resubmit with `turnstileToken` |
| `MFA_INVALID` | 400 | Wrong TOTP/recovery code |
| `UNAUTHENTICATED` | 401 | No/invalid session → go to login |
| `ACCESS_TOKEN_EXPIRED` | 401 | Call `POST /api/auth/refresh` once, then retry the request |
| `SESSION_EXPIRED` | 401 | Refresh failed → login (keep return URL) |
| `SESSION_REVOKED` | 401 | Logged out elsewhere / suspended / reuse detected → login |
| `INVALID_CREDENTIALS` | 401 | Generic login failure |
| `EMAIL_NOT_VERIFIED` | 403 | Offer resend verification |
| `ACCOUNT_SUSPENDED` | 403 | Show suspended message (only after correct password) |
| `MFA_ENROLLMENT_REQUIRED` | 403 | Privileged user must set up MFA first → `/mfa/setup` |
| `STEP_UP_REQUIRED` | 403 | Show re-auth dialog, call `/api/auth/reauth`, retry |
| `CSRF_INVALID` | 403 | Fetch new CSRF token, retry once |
| `FORBIDDEN` | 403 | Not allowed (never reveals if the resource exists) |
| `NOT_FOUND` | 404 | Also returned for resources outside the user's visibility scope |
| `CONFLICT` | 409 | Duplicate (e.g., already bookmarked, last admin) |
| `REFRESH_IN_PROGRESS` | 409 | Concurrent refresh from another tab; wait 300 ms and retry the original request |
| `PAYLOAD_TOO_LARGE` | 413 | File/body over limit |
| `UNSUPPORTED_FILE_TYPE` | 415 | Only PDF, DOCX, PPTX |
| `ACCOUNT_LOCKED` | 423 | Temporary lock; `Retry-After` header in seconds |
| `RATE_LIMITED` | 429 | `Retry-After` header in seconds |
| `INTERNAL_ERROR` | 500 | Show `requestId` + retry |
| `SERVICE_UNAVAILABLE` | 503 | Maintenance / dependency down |

### 5.5 Roles and permissions
```ts
// shared/src/roles.ts
export const ROLES = ["student", "faculty", "moderator", "placement_officer", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const PRIVILEGED_ROLES: Role[] = ["faculty", "moderator", "placement_officer", "admin"]; // MFA mandatory
```
Permission strings follow `resource:action[:scope]`.

| Permission | student | faculty | moderator | placement_officer | admin |
|---|:-:|:-:|:-:|:-:|:-:|
| `announcement:read` `event:read` `resource:read` `opening:read` `search:use` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bookmark:manage` `profile:manage` `notification:read` (own only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `event:rsvp` `opening:track` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `resource:submit` (goes to moderation queue) | ✅ | — | — | — | — |
| `announcement:create` `announcement:update:own` `announcement:delete:own` | — | ✅ | ✅ | — | ✅ |
| `event:create` `event:update:own` `event:delete:own` | — | ✅ | ✅ | ✅ | ✅ |
| `resource:create` `resource:update:own` `resource:delete:own` | — | ✅ | ✅ | — | ✅ |
| `opening:create` `opening:update:own` `opening:delete:own` | — | — | — | ✅ | ✅ |
| `*:update:any` `*:delete:any` for announcement/event/resource | — | — | ✅ | — | ✅ |
| `opening:update:any` `opening:delete:any` | — | — | — | — | ✅ |
| `moderation:review` `report:review` | — | — | ✅ | — | ✅ |
| `report:create` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user:read` `user:invite` `user:suspend` `user:role:update` `audit:read` `analytics:read` | — | — | — | — | ✅ |

`ROLE_PERMISSIONS` in `permissions.ts` encodes exactly this table. **Visibility scope** (who sees which content) is enforced in database queries (see `Database.md` §6 audience filter): students see content targeted to their department + year (or to "all"); staff see everything published plus their own drafts.

### 5.6 OpenAPI
`docs/api/openapi.yaml` is **generated** from the Zod schemas (script `npm run openapi -w @scc/shared`, using `zod-openapi` or Zod 4's JSON Schema export). Never hand-edit it. Frontend uses it with MSW mocks; reviewers use it to check contract changes.

### 5.7 Core DTOs (summary — full schemas in `shared`)
```ts
UserDTO        { id, name, email, rollNo?, role, department, year?, section?, status, emailVerified,
                 mfaEnabled, avatarUrl?, createdAt }
SessionDTO     { id, deviceLabel, browser, os, approxLocation?, createdAt, lastUsedAt, current }
AudienceDTO    { departments: Department[] | ["ALL"], years: Year[] | ["ALL"] }
AnnouncementDTO{ id, title, body, audience, status, publishAt?, expiresAt?, pinned, author: AuthorRef,
                 createdAt, updatedAt, bookmarked }
EventDTO       { id, title, description, venue, startsAt, endsAt, capacity?, rsvpCount, myRsvp?: "going"|"waitlisted",
                 audience, status, author, createdAt, updatedAt, bookmarked }
ResourceDTO    { id, title, description?, department, year, semester, subject, file: { name, mimeType, size },
                 status, version, uploadedBy: AuthorRef, createdAt, updatedAt, bookmarked }
OpeningDTO     { id, title, company, type: "job"|"internship", description, location?, compensation?,
                 eligibility: { departments, years, minCgpa? }, closesAt, applyUrl, myTracking?: "interested"|"applied",
                 postedBy: AuthorRef, createdAt, updatedAt, bookmarked }
AuthorRef      { id, name, role }
NotificationDTO{ id, type, title, body, link?, readAt?, createdAt }
AuditLogDTO    { id, actor?: AuthorRef, action, targetType?, targetId?, result: "success"|"denied"|"failure",
                 ip?, createdAt, meta }
```

### 5.8 Endpoint catalogue (owners implement exactly these; details in role files)

**Auth** — `/api/auth/*`
| Method | Path | Body → Response |
|---|---|---|
| GET | `/csrf` | → `200 { csrfToken }` + sets CSRF cookie |
| POST | `/register` | `{ name, email, password, rollNo?, department, year }` → `202 { message }` (same reply whether or not the email exists) |
| POST | `/verify-email` | `{ token }` → `200 { message }` |
| POST | `/resend-verification` | `{ email }` → `202` |
| POST | `/login` | `{ email, password, turnstileToken? }` → `200 { status: "OK", user }` or `200 { status: "MFA_REQUIRED", challengeId }` |
| POST | `/mfa/verify` | `{ challengeId, code? , recoveryCode? }` → `200 { status: "OK", user }` |
| POST | `/mfa/enroll` | → `200 { otpauthUrl, secret }` |
| POST | `/mfa/confirm` | `{ code }` → `200 { recoveryCodes: string[10] }` |
| POST | `/mfa/disable` | (step-up; not allowed for privileged roles) → `204` |
| POST | `/mfa/recovery-codes` | (step-up) → `200 { recoveryCodes }` |
| POST | `/refresh` | → `204` (rotates cookies) |
| POST | `/logout` · `/logout-all` | → `204` |
| POST | `/forgot-password` | `{ email }` → `202` |
| POST | `/reset-password` | `{ token, newPassword }` → `204` |
| POST | `/accept-invite` | `{ token, password }` → `204` |
| POST | `/change-password` | `{ currentPassword, newPassword }` → `204` |
| POST | `/reauth` | `{ password }` or `{ code }` → `204` |
| GET | `/sessions` | → `200 { items: SessionDTO[] }` |
| DELETE | `/sessions/:id` | → `204` |
| GET | `/me` | → `200 { user, permissions: string[], mfa: { enabled, required }, feed: { lastSeenAt } }` |
| GET | `/google` · `/google/callback` | `302` redirects (server-side OIDC) |

**Profile** — `GET /api/profile` · `PATCH /api/profile` `{ name?, phone?, bio? }` · `GET /api/profile/settings` · `PUT /api/profile/settings` `{ emailNotifications, animations }` · `POST /api/profile/feed-seen` → `204` (updates the "new since last visit" marker) · `GET /api/profile/export` (step-up) · `DELETE /api/profile` (step-up) → `204`

**Content** (same pattern for `announcements`, `events`, `resources`, `openings`):
`GET /api/<type>` (filters + cursor) · `GET /api/<type>/:id` · `POST /api/<type>` · `PATCH /api/<type>/:id` · `DELETE /api/<type>/:id`
- Announcements filters: `department, year, status (staff only), q, pinned`
- Events extra: `POST /api/events/:id/rsvp` → `{ myRsvp }` · `DELETE /api/events/:id/rsvp` → `204` · `GET /api/events/:id/ics` → `text/calendar`
- Resources: filters `department, year, semester, subject, q`; upload = `POST /api/resources/upload-url` `{ title, description?, department, year, semester, subject, fileName, mimeType, size }` → `201 { resourceId, uploadUrl, headers, expiresAt }` → client `PUT`s the file to `uploadUrl` → `POST /api/resources/:id/complete` → `202 { status: "pending_scan" }`; download = `GET /api/resources/:id/download` → `200 { url, expiresAt }` (60 s signed URL)
- Openings filters: `type, department, year, closingWithinDays, q`; tracker `PUT /api/openings/:id/track` `{ status: "interested"|"applied"|null }`

**Search** — `GET /api/search?q=&types=announcement,event,resource,opening&limit=5` → `{ announcements: [], events: [], resources: [], openings: [] }` (visibility-scoped)

**Bookmarks** — `GET /api/bookmarks?type=&cursor=` · `POST /api/bookmarks` `{ itemType, itemId }` → `201` · `DELETE /api/bookmarks/:itemType/:itemId` → `204`

**Notifications** — `GET /api/notifications?cursor=` · `POST /api/notifications/:id/read` · `POST /api/notifications/read-all` · `GET /api/notifications/unread-count` → `{ count }`

**Reports & moderation** — `POST /api/reports` `{ itemType, itemId, reason }` · `GET /api/moderation/queue?type=&cursor=` · `POST /api/moderation/:itemType/:id/approve` · `POST /api/moderation/:itemType/:id/reject` `{ reason }`

**Admin** (all require `admin`; ✱ = step-up)
`GET /api/admin/users?role=&status=&department=&q=&cursor=` · `POST /api/admin/users/invite` `{ email, name, role, department }` · `POST /api/admin/users/import/upload-url` (CSV ≤ 2 MB / 5 000 rows) → `201 { jobId, uploadUrl, headers }` → client PUTs the CSV to storage → `POST /api/admin/users/import/:jobId/start` → `202` · `GET /api/admin/jobs/:id` · ✱`PATCH /api/admin/users/:id/role` `{ role }` · ✱`PATCH /api/admin/users/:id/status` `{ status: "active"|"suspended", reason }` · ✱`POST /api/admin/users/:id/revoke-sessions` · `GET /api/admin/audit-logs?actorId=&action=&from=&to=&cursor=` · `GET /api/admin/analytics/summary`

**Public / ops** — `GET /api/public/stats` (cached 5 min) · `GET /api/public/events` · `GET /api/health` (liveness) · `GET /api/ready` (Mongo + Redis)

---

## 6. Cookies, headers, sessions (fixed names)

| Item | Production | Development (`http://localhost`) |
|---|---|---|
| Access token cookie | `__Host-scc_at` — HttpOnly, Secure, SameSite=Lax, Path=/, 15 min | `scc_at` (not Secure) |
| Refresh token cookie | `__Secure-scc_rt` — HttpOnly, Secure, SameSite=Strict, Path=/api/auth, idle 7 d / absolute 30 d (privileged: absolute 8 h) | `scc_rt` |
| CSRF cookie | `__Host-scc_csrf` — Secure, SameSite=Lax, readable by JS | `scc_csrf` |
| CSRF header | `X-CSRF-Token` on every POST/PUT/PATCH/DELETE | same |
| CSRF rotation | Server sends a new token in response header `X-CSRF-Token` after login, refresh, logout; client stores the latest value **in memory** | same |
| Request id | Server returns `X-Request-Id`; client shows it in error screens | same |

**Same-origin deployment is mandatory**: the browser loads the SPA and calls `/api` on the **same origin** (reverse proxy / CDN path routing). In dev, Vite proxies `/api` → `http://localhost:4000`. Never configure the frontend with a different API domain.

Tokens are **never** readable by JavaScript and **never** stored in `localStorage`/`sessionStorage`.

---

## 7. Security rules (every agent, every PR)

1. **Validate every input on the server** with the `@scc/shared` Zod schema for that route. Reject unknown fields.
2. **Authorize every request on the server**: authentication middleware → permission check → object-level policy (ownership/scope). Hiding a button is not security.
3. **Return `NOT_FOUND`** (not `FORBIDDEN`) when a user requests an object outside their visibility scope.
4. **No secrets in code or git.** Use `.env` locally (git-ignored) and the cloud secret manager in production. `gitleaks` runs in CI.
5. **No user content as raw HTML** anywhere (no `dangerouslySetInnerHTML`, no server-side HTML from user input).
6. **No logging of** passwords, tokens, cookies, OTP codes, recovery codes, full emails in auth failures, or file contents. The logger redacts these paths automatically — don't work around it.
7. **Generic auth messages** exactly as defined in §5.4. Never reveal whether an email/account exists.
8. **New dependencies need human approval** and must be actively maintained (release in last 12 months, no critical advisories). Pin via lockfile; install with `npm ci` in CI.
9. **Only sample/anonymised data** in seeds, tests, screenshots, prompts. Never paste real student data or secrets into an AI prompt.
10. **Review every agent-generated diff yourself.** You must be able to explain every line in the viva.
11. Third-party origins allowed in the browser: **none** except Cloudflare Turnstile on the login challenge. Fonts, images, 3D assets are self-hosted.
12. Rate limits, CSP, CORS, cookie flags are configured in one place (Backend) — do not override them in feature code.

---

## 8. Code standards

| Topic | Rule |
|---|---|
| Runtime | **Node.js 22+** everywhere (`engines` field; CI uses Node 22) |
| Language | **TypeScript**, `strict: true`, `noUncheckedIndexedAccess: true`, ESM (`"type": "module"`), no `any` (use `unknown` + narrowing) |
| Package manager | **npm workspaces** only. Commit `package-lock.json`. No yarn/pnpm. |
| Key versions | React 19 · Vite (current) · Express 5 · Mongoose 9 · Zod 4 · BullMQ 6 · ioredis · Vitest 5 · Playwright. The lockfile is the truth; upgrade majors only through an ADR. |
| Style | ESLint (flat config) + `.editorconfig` (2 spaces, LF); `npm run lint` must pass with zero warnings |
| Naming | files `kebab-case.ts`, React components `PascalCase.tsx`, variables/functions `camelCase`, constants `UPPER_SNAKE_CASE`, Mongo collections plural lowercase (`announcements`) |
| Async | `async/await` only; no unhandled promises (`@typescript-eslint/no-floating-promises`) |
| Errors | Throw `AppError(code, message?)` from `backend/src/lib/errors.ts`; never `res.status(500).send(err)` |
| Comments | Explain *why*, not *what*. Every security-relevant decision gets a one-line comment |
| Functions | Small, pure where possible; controllers thin, logic in services |
| Tests | **Vitest** (Jest-compatible API) + Supertest for API; Testing Library + MSW for web; Playwright for e2e. Every new route or component ships with tests |
| Env vars | Declared in `backend/.env.example` with a comment; validated at startup with Zod (`backend/src/config/env.ts`) |

### 8.1 Root scripts (must keep working)
```
npm install            # installs all workspaces, builds @scc/shared
npm run infra:up       # local MongoDB, Redis, Mailpit (backend/docker-compose.yml)
npm run dev            # backend API with hot reload
npm run build          # builds all packages and apps
npm run lint           # eslint
npm run typecheck      # tsc --noEmit across workspaces
npm test               # all unit/integration tests
npm run test:e2e       # Playwright against local stack
npm run db:migrate     # @scc/db migrations
npm run db:seed        # demo data (never runs in production)
npm run openapi        # regenerate docs/api/openapi.yaml
```

### 8.2 Environment variables (`backend/.env.example` is the source; M1 maintains it)
```
NODE_ENV=development
PORT=4000
APP_ORIGIN=http://localhost:5173          # the single public origin (SPA + /api)
TRUST_PROXY=0                             # number of proxy hops in production
MONGO_URI=mongodb://localhost:27017/scc?replicaSet=rs0
REDIS_URL=redis://localhost:6379
JWT_PRIVATE_KEY=                          # Ed25519 PKCS8 PEM, base64 (npm run gen:secrets)
JWT_KEY_ID=
JWT_PREVIOUS_PUBLIC_KEY=                  # optional, during key rotation
CSRF_SECRET=
PASSWORD_PEPPER=
MFA_ENCRYPTION_KEY=                       # 32 bytes base64
ALLOWED_EMAIL_DOMAINS=iem.edu.in          # self-registration + Google SSO
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
HIBP_ENABLED=true
S3_ENDPOINT=http://localhost:9000         # MinIO locally; R2/S3 in production
S3_REGION=auto
S3_BUCKET_QUARANTINE=scc-quarantine
S3_BUCKET_FILES=scc-files                 # private; downloads via short-lived signed URLs
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
SMTP_URL=smtp://localhost:1025            # Mailpit locally
MAIL_FROM="Campus Companion <no-reply@example.edu>"
SENTRY_DSN=
LOG_LEVEL=info
```

---

## 9. Git workflow

### 9.1 Branches
- `main` — always deployable, **protected** (PR + 1 approval + green CI, no direct pushes, no force pushes).
- `dev` — integration branch, protected the same way. Feature PRs target `dev`. M1 merges `dev → main` at each milestone.
- `feature/<area>-<short-task>` — e.g. `feature/backend-auth-login`, `feature/db-announcement-model`, `feature/web-login-page`, `feature/ui-button`.
- `fix/<area>-<short-task>` for bug fixes; `contract/<change>` for `shared` changes.

### 9.2 Commits — Conventional Commits
`feat(api): add refresh token rotation` · `fix(web): keep focus on OTP error` · `test(db): index coverage for feed query` · `docs(agents): clarify upload flow` · `chore(ci): add trivy scan`.
Small commits, one logical change each. **Each member is the sole author of their commits**: no AI co-author lines, no bot commits (no Dependabot PRs).

### 9.3 Pull requests
- One feature per PR, **≤ ~400 changed lines** where possible.
- PR template sections: *What & why · Contract changes (yes/no) · Screenshots (UI) · Tests added · Security checklist · How to test locally*.
- Reviewer: at least **one other member**; CODEOWNERS adds the owner automatically.
- Sync often: `git pull --rebase origin dev` before pushing. Resolve conflicts only in files you own; otherwise ask the owner.

### 9.4 Changing the contract (`shared`, `AGENTS.md`, error codes, endpoint shapes)
1. Open a `contract/<change>` branch with **only** the contract change + regenerated OpenAPI.
2. Describe the change and who is affected in the PR.
3. **All four members approve.** Then merge first, before any feature code that depends on it.
4. Bump `@scc/shared` version (minor for additions, major for breaking changes) and note it in `shared/CHANGELOG.md`.

---

## 10. Working in parallel without blocking each other

| Need | How to proceed without waiting |
|---|---|
| Frontend needs an endpoint that isn't built | Use **MSW mock handlers** generated from `@scc/shared` schemas (`frontend/src/mocks/`). Switch off mocks per route when the API lands. |
| Backend needs a model that isn't merged | Write the service against the `@scc/db` model interface agreed in `Database.md`; use the in-memory test DB. |
| Database needs to know query patterns | Use the query patterns table in `Database.md` §5; Backend adds new patterns there via PR. |
| UI/UX components not ready | Frontend uses plain semantic HTML with tokens, swaps in `@scc/ui` components later — **no custom styling systems**. |
| Contract unclear | Open an issue labelled `contract`, tag everyone, decide within 24 h. |

Daily: 10-minute async stand-up in the team chat — *done / doing / blocked*. Weekly: integrate `dev` and run the full demo walkthrough (§12).

---

## 11. Timeline (today: 14 Oct 2026 → deadline 20 Nov 2026)

| Phase | Dates | M1 Backend | M2 Frontend | M3 Database | M4 UI/UX |
|---|---|---|---|---|---|
| **0 Contracts** | 14–19 Oct | Repo, CI, docker-compose, env, app skeleton | Vite app, router, API client, MSW | All models + indexes + seed v1 | Tokens, Figma foundations, Nova v1 |
| **1 Core** | 20 Oct–2 Nov | Auth + MFA + sessions, RBAC, CRUD ×4, uploads | Auth pages, dashboards, lists, filters | Query helpers, audience filter, search indexes | Components, auth + landing screens |
| **2 Advanced + hardening** | 3–12 Nov | Worker jobs, moderation, admin, rate limits, scans green | Admin, moderation, search palette, security page | Migrations, explain-plan tests, backup plan | Workspace screens, states, a11y pass |
| **3 Prove + ship** | 13–20 Nov | k6 load test, deploy, monitoring | e2e suite, bug fixes | Prod indexes, seed demo, retention jobs | Polish, Lighthouse, final screenshots |

Lab documents (SRS, UML, test plan, defect log, report) live in `docs/lab/` and are updated by the owner of each area.

---

## 12. Definition of Done (every PR)

- [ ] Follows this file and the role file; touches only owned folders (or has the owner's approval).
- [ ] Types pass (`npm run typecheck`), lint passes, tests added and passing in CI.
- [ ] Inputs validated with shared schemas; permissions checked server-side; errors use §5.4 codes.
- [ ] No secrets, no real personal data, no new third-party origins, no new dependency without approval.
- [ ] UI changes: matches Figma, keyboard + screen-reader checked, mobile + desktop screenshots attached.
- [ ] Docs updated (role file, OpenAPI, ADR if a decision changed).
- [ ] The author can explain every line.

### 12.1 Final demo acceptance (run on the live URL before 20 Nov)
1. Student registers with college email, verifies, logs in. 2. Dashboard shows announcements/events for their dept + year. 3. Student finds a resource by dept → year → sem → subject and downloads it. 4. Openings show deadlines and open the correct link via the interstitial. 5. Faculty (with MFA) publishes an announcement, event and resource. 6. Student sees all three. 7. Admin (step-up) suspends a user — that user is logged out instantly — and removes an item. 8. A student calling a faculty endpoint gets 403. 9. One keyword returns mixed result types. 10. Student edits only their own profile. 11. Everything runs on the live URL, behind HTTPS, with security headers passing.

---

## 13. When in doubt
Stop and ask the human. Prefer the simpler option. Never weaken a security rule to make a test pass. Never invent an endpoint, field, role, permission or error code that is not in this file — propose it through §9.4 instead.
