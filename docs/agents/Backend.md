# Backend.md — Smart Campus Companion
### Role file for the Backend owner (M1, also Coordinator) and their AI agent

> **Read `AGENTS.md` first** (contract, ownership, workflow). This file tells you *how to build the API, the worker, security, CI/CD and deployment*.
> You own `apps/api/**`, `apps/worker/**`, `infra/**`, `.github/**` and root config. You consume `@scc/shared` and `@scc/db`; you do not edit them directly (contract changes go through `AGENTS.md` §9.4; model/index changes through the Database owner).

---

## 0. Agent operating instructions

1. Read `AGENTS.md` → this file → `packages/shared/src/**` → `docs/agents/Database.md` §5–§6 (query helpers you must use).
2. Plan mode first. One module per task (e.g., "auth: login + lockout"), with the tests you will write. Wait for approval.
3. **Build order:** §2 skeleton + config → §3 middleware pipeline → §4 auth → §5 RBAC → §6 content modules → §7 uploads → §8 caching → §9 worker → §10 observability → §11 tests → §12 infra/CI.
4. Every route is registered through `defineRoute()` (§3.3) so validation, permission and the permission-matrix test can't be forgotten.
5. Never weaken a security control to pass a test. If something in this file seems wrong, stop and ask.

### 0.1 Allowed dependencies (ask before adding others)
Runtime: `express@5`, `helmet`, `cookie-parser`, `pino`, `pino-http`, `zod` (via `@scc/shared`), `jose` (JWT + Google JWKS), `@node-rs/argon2`, `ioredis`, `rate-limiter-flexible`, `bullmq`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `nodemailer`, `ua-parser-js`, `csv-parse` (import worker), `prom-client` (internal metrics), `@sentry/node` (optional).
Dev: `typescript`, `tsx`, `vitest`, `supertest`, `@types/*`, `mongodb-memory-server`, `ioredis-mock` (unit only), `k6` (installed on the machine, not npm).
**No** `passport`, `express-session`, `jsonwebtoken`, `bcrypt`, `multer` (uploads never pass through the API), `express-mongo-sanitize` (incompatible with Express 5 query getter — we use our own guard + Mongoose `sanitizeFilter`).

---

## 1. Architecture recap

```
Browser ──HTTPS──► Cloudflare (WAF, DDoS, Turnstile, cache static)
                     │
                     ▼
               nginx "web" container (same origin)
               ├── /            → React build (static, immutable cache)
               └── /api/*       → api containers (round-robin)
                                     │
            ┌────────────────────────┼─────────────────────────┐
            ▼                        ▼                         ▼
     MongoDB Atlas (rs)        Redis (cache, sessions,    S3-compatible storage
     via @scc/db               rate limits, BullMQ)      (quarantine + files buckets)
                                     ▲
                                     │
                              worker containers (BullMQ): email, file-scan (ClamAV),
                              scheduler, cleanup, user-import, notifications
```
- **Stateless API**: no in-memory sessions, no local files. Any instance can serve any request → horizontal scaling.
- **Heavy or slow work goes to the worker** (scans, emails, imports, fan-out).
- **Same-origin**: SPA and `/api` share one origin, so cookies are first-party and `SameSite` protects us (AGENTS §6).

### 1.1 Capacity targets (prove with k6, §11.4)
| Scenario | Target |
|---|---|
| Steady browsing | 2 000 req/s, p95 < 300 ms, error rate < 0.5% |
| Spike (results day / placement drive) | 5 000 req/s for 5 min with autoscaling, p95 < 800 ms |
| Login burst | 150 logins/s (Argon2id is CPU-bound: budget ~1 vCPU per 15–20 logins/s; set `UV_THREADPOOL_SIZE=8`) |
| Cache hit ratio on feeds | ≥ 85% |

---

## 2. Project skeleton (`apps/api`)

```
apps/api/
  package.json  tsconfig.json  Dockerfile  vitest.config.ts
  src/
    server.ts                 # starts HTTP server, graceful shutdown
    app.ts                    # createApp(deps) — used by server and tests
    config/env.ts             # Zod-validated env (fails fast)
    config/security.ts        # cookie names/flags, rate-limit table, CSP
    lib/
      errors.ts               # AppError, error codes from @scc/shared
      define-route.ts         # route registry (§3.3)
      redis.ts  cache.ts  storage.ts  mailer.ts  logger.ts  audit.ts  crypto.ts  time.ts
    middleware/
      request-id.ts  reject-dangerous-keys.ts  csrf.ts  authenticate.ts  require-auth.ts
      require-permission.ts  require-recent-auth.ts  rate-limit.ts  error-handler.ts  not-found.ts
    modules/
      auth/        routes.ts  service.ts  tokens.ts  passwords.ts  mfa.ts  google.ts  sessions.ts  lockout.ts
      profile/     routes.ts  service.ts
      announcements/ events/ resources/ openings/   (routes.ts, service.ts, policy.ts each)
      search/  bookmarks/  notifications/  moderation/  reports/  admin/  public/  health/
    jobs/queues.ts            # BullMQ queue producers (shared names with worker)
  test/
    helpers/ (app factory, db, login helpers, csrf helper)
    auth/*.test.ts  rbac/permission-matrix.test.ts  modules/*.test.ts  security/*.test.ts
apps/worker/
  src/ index.ts  queues.ts  processors/ (email.ts file-scan.ts scheduler.ts cleanup.ts user-import.ts notify.ts)
```
Layering: **routes** (HTTP only) → **service** (business rules, transactions) → **@scc/db** (models + helpers). Policies (`policy.ts`) are pure functions: `canEdit(viewer, doc)`.

### 2.1 Config (`src/config/env.ts`)
- Parse `process.env` with a Zod schema matching `AGENTS.md` §8.2. Crash on startup with a clear message listing missing keys (never print values).
- In `production`: require `REDIS_URL`, JWT keys, `CSRF_SECRET`, `PASSWORD_PEPPER`, `MFA_ENCRYPTION_KEY`, S3 creds; forbid `ALLOWED_EMAIL_DOMAINS` empty; `TRUST_PROXY ≥ 1`.
- `npm run gen:secrets -w apps/api` prints fresh values: Ed25519 keypair (PKCS8 PEM base64), `JWT_KEY_ID`, 32-byte base64 secrets. Developers paste them into their own `.env`.

---

## 3. Request pipeline

### 3.1 Middleware order (`app.ts`)
| # | Middleware | Notes |
|---|---|---|
| 1 | `app.set("trust proxy", env.TRUST_PROXY)` | Correct `req.ip` behind Cloudflare + nginx |
| 2 | `app.disable("x-powered-by")` | |
| 3 | `requestId` | Accept incoming `X-Request-Id` only if it matches `^[A-Za-z0-9_-]{8,64}$`, else generate `req_<ulid>`; echo in response |
| 4 | `pino-http` | Redaction list §10.1 |
| 5 | `helmet` | API responses: `contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }`, HSTS 1 year + preload (prod), `crossOriginResourcePolicy: same-origin`, `referrerPolicy: no-referrer` |
| 6 | Origin guard | For state-changing methods, `Origin` (or `Referer`) must equal `APP_ORIGIN`; else `403 CSRF_INVALID`. **No CORS middleware** (same-origin) |
| 7 | `express.json({ limit: "100kb", strict: true, type: "application/json" })` | Non-JSON bodies on JSON routes → `415` |
| 8 | `rejectDangerousKeys` | Recursively reject keys starting with `$` or containing `.`, and `__proto__`/`constructor`/`prototype` in body and query → `400 VALIDATION_ERROR` |
| 9 | `cookieParser()` | |
| 10 | Global rate limit | Per IP + per user (§3.4) |
| 11 | `csrf` | Signed double-submit for POST/PUT/PATCH/DELETE (§4.6). Exempt list is empty except `GET`s |
| 12 | `authenticate` | Parses access cookie if present; attaches `req.auth` or nothing (never throws) |
| 13 | Routers | Each route adds `requireAuth`, `requirePermission`, `validate`, optional `requireRecentAuth` via `defineRoute` |
| 14 | `notFound` → `errorHandler` | `errorHandler` maps `AppError`, `ZodError`, Mongo duplicate key (`11000 → CONFLICT`), body-parser errors (`413`/`400`), everything else → `500 INTERNAL_ERROR` with `requestId`; logs full error server-side only |

Express 5 forwards rejected promises from async handlers to the error handler — do **not** add try/catch just to call `next(err)`.

### 3.2 Express settings
`app.set("query parser", "simple")` (no nested objects in query strings). `app.set("json spaces", 0)`. Set `server.headersTimeout = 65_000`, `server.keepAliveTimeout = 61_000` (above the load balancer's idle timeout), `server.requestTimeout = 30_000`.

### 3.3 Route registry — `defineRoute()`
```ts
// src/lib/define-route.ts
import type { RequestHandler, Router } from "express";
import type { ZodType } from "zod";
import type { Permission } from "@scc/shared";

export interface RouteDef<B = unknown, Q = unknown, P = unknown> {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;                         // e.g. "/api/announcements/:id"
  auth: "public" | "user";              // "user" = must be logged in (and MFA enrolment satisfied)
  permission?: Permission;              // checked after auth
  recentAuth?: boolean;                 // step-up within 5 minutes
  rateLimit?: keyof typeof RATE_LIMITS; // named bucket (§3.4)
  body?: ZodType<B>; query?: ZodType<Q>; params?: ZodType<P>;
  handler: (ctx: { req: Express.Request; body: B; query: Q; params: P; viewer?: Viewer }) => Promise<HandlerResult>;
}

export const ROUTES: RouteDef[] = [];   // the permission-matrix test iterates this list

export function defineRoute<B, Q, P>(router: Router, def: RouteDef<B, Q, P>) {
  ROUTES.push(def as RouteDef);
  const chain: RequestHandler[] = [];
  if (def.rateLimit) chain.push(rateLimit(def.rateLimit));
  if (def.auth === "user") chain.push(requireAuth);
  if (def.permission) chain.push(requirePermission(def.permission));
  if (def.recentAuth) chain.push(requireRecentAuth(5 * 60));
  chain.push(async (req, res) => {
    const body = def.body ? def.body.parse(req.body) : (undefined as B);   // ZodError → 400
    const query = def.query ? def.query.parse(req.query) : (undefined as Q);
    const params = def.params ? def.params.parse(req.params) : (undefined as P);
    const result = await def.handler({ req, body, query, params, viewer: req.auth?.viewer });
    sendResult(res, result);              // { status, json?, headers?, cookies? }
  });
  router[def.method](def.path, ...chain);
}
```

### 3.4 Rate limits (`config/security.ts`, Redis-backed via `rate-limiter-flexible`)
| Bucket | Key | Limit | On exceed |
|---|---|---|---|
| `global` | IP | 600 / min | 429 |
| `globalUser` | userId | 300 / min | 429 |
| `login` | IP | 10 / min | 429 |
| `loginAccount` | email hash | progressive lockout (§4.4) | 423 |
| `register` | IP | 5 / hour | 429 |
| `forgot` | email hash + IP | 3 / hour per email, 10 / hour per IP | 202 (silent) / 429 |
| `mfaVerify` | challengeId | 5 attempts total | challenge invalidated |
| `refresh` | sid | 30 / min | 429 |
| `reauth` | userId | 5 / 15 min | 429 |
| `search` | userId | 60 / min | 429 |
| `uploadUrl` | userId | 20 / hour | 429 |
| `download` | userId | 120 / hour | 429 |
| `write` (any content create/update) | userId | 60 / hour | 429 |
| `adminSensitive` | userId | 30 / hour | 429 |

Always send `Retry-After` (seconds) and `RateLimit-*` headers. Cloudflare adds an edge rule for `/api/auth/*` (e.g., 30/min per IP) as a first line of defence.

---

## 4. Authentication (implement exactly)

### 4.1 Passwords (`modules/auth/passwords.ts`)
- Hash: **Argon2id**, `memoryCost: 19456` (KiB), `timeCost: 2`, `parallelism: 1`, output 32 bytes, via `@node-rs/argon2`. Input = `HMAC-SHA256(PASSWORD_PEPPER, password)` (base64) — pepper stays in the secret manager.
- Policy (shared Zod schema enforces length; server enforces the rest): 12–128 chars; reject if it contains the email local-part, any name part ≥ 4 chars, or roll number (case-insensitive); reject the built-in top-1000 common list; reject if **Have I Been Pwned** range API reports it (SHA-1 prefix, `Add-Padding: true`, 1.5 s timeout, fail-open with a warning log when `HIBP_ENABLED=true` and the API is unreachable).
- `needsRehash()` check on login → rehash transparently when parameters change.

### 4.2 Registration (students only)
1. Validate body (`registerSchema`). Email domain must be in `ALLOWED_EMAIL_DOMAINS`.
2. If email already exists → send "someone tried to register with your email" mail (rate-limited) and return the **same** `202` response.
3. Else create user `status: "pending"`, `role: "student"`, hash password, create `email_verify` token (32 random bytes, base64url; store SHA-256; expires 24 h), enqueue email with link `${APP_ORIGIN}/verify-email?token=…`.
4. `POST /verify-email`: hash token, find unused + unexpired, mark used, set `emailVerified: true`, `status: "active"`. Audit `auth.email.verified`.

### 4.3 Login
```
1. rateLimit("login") by IP
2. normalise email; load user .select("+passwordHash")
3. if no user or no passwordHash → verify against DUMMY_HASH (equal timing) → 401 INVALID_CREDENTIALS
4. if security.lockUntil > now → 423 ACCOUNT_LOCKED (+Retry-After)
5. if failures ≥ 3 for this account or IP has ≥ 5 recent failures → require turnstileToken (else 400 CAPTCHA_REQUIRED); verify with Cloudflare siteverify (2 s timeout; fail closed)
6. verify Argon2 → on failure: lockout.recordFailure(user) → 401 INVALID_CREDENTIALS
7. lockout.reset(user)
8. status checks (only now, after correct password): pending/unverified → 403 EMAIL_NOT_VERIFIED; suspended → 403 ACCOUNT_SUSPENDED
9. if user.mfa.enabled → create mfa_challenge token (5 min, 5 attempts) → 200 { status: "MFA_REQUIRED", challengeId }
10. else createSession(user, { mfaPending: isPrivileged(user.role) }) → set cookies → 200 { status: "OK", user }
11. audit auth.login.success / auth.login.failure (with reason, no password), new-device email if device fingerprint unseen
```
`DUMMY_HASH` is computed once at startup with the real parameters.

### 4.4 Lockout (`lockout.ts`)
Per account: failures counted in Redis (`lf:<userId>`, 24 h TTL) and mirrored to `user.security.failedLogins`.
- 5 failures → `lockUntil = now + 30 s`, doubling per additional failure (30 s, 60 s, 120 s…) capped at 15 min.
- 10 failures → 15 min lock + "suspicious attempts on your account" email (once per hour).
- Never lock permanently (prevents lock-out-the-victim DoS). Successful password reset clears the lock.

### 4.5 Tokens and sessions (`tokens.ts`, `sessions.ts`)
**Access token** (JWT, `jose`, alg **EdDSA**, header `kid`): claims `sub` (userId), `role`, `sid`, `tv` (tokenVersion), `at` (authTime, epoch s), `mfa` (`"ok"` | `"enroll"`), `iss: "scc-api"`, `aud: "scc-web"`, `iat`, `exp = iat + 15 min`. No PII. Verify with `jwtVerify(token, keyFor(kid), { algorithms: ["EdDSA"], issuer, audience, clockTolerance: 5 })`.

**Session** (`sessions` collection via `@scc/db`): `_id` = 16 random bytes hex. Refresh cookie value = `<sid>.<secret>` where `secret` = 32 random bytes base64url; DB stores `refreshHash = sha256(secret)`.
- Lifetimes: students idle 7 d / absolute 30 d; privileged roles idle 2 h / absolute 8 h.
- Redis cache of live sessions: `sess:<sid>` → `"<userId>:<tokenVersion>"`, TTL = remaining idle time.

**Per-request check (`authenticate` + `requireAuth`):**
1. Read access cookie → verify JWT. Expired → `401 ACCESS_TOKEN_EXPIRED`. Invalid → `401 UNAUTHENTICATED`.
2. `GET sess:<sid>`; on miss, load session from Mongo (`revokedAt: null`, not expired) and re-cache; missing → `401 SESSION_REVOKED`.
3. Compare cached `tokenVersion` with claim `tv`; mismatch → `401 SESSION_REVOKED`.
4. If claim `mfa === "enroll"` and route is not in `{ /api/auth/me, /api/auth/mfa/enroll, /api/auth/mfa/confirm, /api/auth/logout, /api/auth/csrf }` → `403 MFA_ENROLLMENT_REQUIRED`.
5. Attach `req.auth = { userId, role, sid, authTime, viewer }` (viewer = `{ id, role, department, year }` from a 60 s Redis user cache).

**Refresh (`POST /api/auth/refresh`):**
1. Parse `<sid>.<secret>`; load session `+refreshHash +prevRefreshHash`.
2. `timingSafeEqual(sha256(secret), refreshHash)` → OK: rotate (new secret, `prevRefreshHash = old`, `rotatedAt = now`), extend idle expiry (capped by absolute), issue new access token + CSRF token, `204`.
3. Matches `prevRefreshHash` and `rotatedAt` < 15 s ago → `409 REFRESH_IN_PROGRESS` (another tab won the race; browser already has the new cookie). **No revoke.**
4. Any other mismatch (old token replayed later, or forged) → **reuse detected**: revoke this session, audit `auth.refresh.reuse_detected`, email the user → `401 SESSION_REVOKED`.
5. Session expired/revoked → `401 SESSION_EXPIRED`.

**Revocation:** `revokeSession(sid, reason)` sets `revokedAt` + deletes `sess:<sid>`. `revokeAllSessions(userId, { except? })` does it for every live session **and** increments `user.tokenVersion` (refresh user cache). Called on: logout-all, password change/reset, suspension, role change, MFA disable, refresh reuse.

### 4.6 Cookies and CSRF (`config/security.ts`, `middleware/csrf.ts`)
Cookie names/flags exactly per `AGENTS.md` §6 (prefixed names only when `NODE_ENV=production`).
CSRF token = `<random 16 bytes b64url>.<HMAC-SHA256(CSRF_SECRET, random + "|" + (sid ?? "anon"))>`.
- `GET /api/auth/csrf` issues one (cookie + JSON body + `X-CSRF-Token` header).
- Every state-changing request must send header `X-CSRF-Token` equal to the cookie **and** with a valid HMAC for the current `sid` (or `anon` before login). Fail → `403 CSRF_INVALID`.
- Rotate on login, MFA verify, refresh, logout (send new value in `X-CSRF-Token` response header).

### 4.7 MFA (`mfa.ts`)
- **TOTP (RFC 6238)** implemented in-house with `node:crypto` (HMAC-SHA1, 30 s step, 6 digits, ±1 step window). Secret = 20 random bytes, base32. Store `secretEnc` with AES-256-GCM (`MFA_ENCRYPTION_KEY`) via `@scc/db` `encryptField`.
- **Replay protection:** accept a code only if its time step `> mfa.lastUsedStep`, then store it.
- Enrol: `POST /mfa/enroll` creates a pending secret (stored encrypted on the user with `enabled: false`), returns `otpauth://totp/Campus%20Companion:<email>?secret=…&issuer=Campus%20Companion&algorithm=SHA1&digits=6&period=30`. The QR is rendered **in the browser** — never send the secret to a third-party QR service.
- Confirm: verify code → `enabled: true`, generate 10 recovery codes (`xxxx-xxxx-xx`, 50 bits each), store `HMAC(PASSWORD_PEPPER, code)` hashes, return plaintext once. If the session had `mfaPending`, rotate the session to `mfa: "ok"`.
- Verify (login): challenge token lookup (hash), attempts++ (max 5 → invalidate), accept TOTP or unused recovery code (mark used, warn by email when ≤ 3 remain).
- Disable: step-up required; **forbidden for privileged roles** (`403 FORBIDDEN`); revokes other sessions.

### 4.8 Step-up (`require-recent-auth.ts`)
Routes with `recentAuth: true` require `now - at ≤ 300 s`, else `403 STEP_UP_REQUIRED`. `POST /api/auth/reauth` accepts `{ password }` or `{ code }` (TOTP; required instead of password if MFA enabled), updates `session.authTime`, issues a fresh access token. Rate-limited (`reauth`).

### 4.9 Password reset, change, invite
- Forgot: always `202`. If the user exists and is active → `password_reset` token (15 min, single use), email link. Rate limits per email and IP.
- Reset: validate token, enforce policy, set new hash, clear lockout, `revokeAllSessions`, mark token used, email "your password was changed".
- Change: requires `currentPassword`; then `revokeAllSessions(userId, { except: currentSid })`.
- Invite (admin): create user `status: "pending"` with `role` from the request; `invite` token (72 h). Accept: set password (policy), `emailVerified: true`, `status: "active"`. First login forces MFA enrolment (privileged roles).

### 4.10 Google sign-in (`google.ts`, server-side OIDC, no SDK)
1. `GET /api/auth/google`: create `state` (32 B), `nonce` (32 B), PKCE `code_verifier` (32 B) → store hashes + verifier (encrypted) in an `oauth_state` authToken (10 min); set short cookie `scc_oauth=<state>` (HttpOnly, Secure, SameSite=Lax, Path=/api/auth/google, 10 min); redirect to `https://accounts.google.com/o/oauth2/v2/auth` with `response_type=code`, `scope=openid email profile`, `code_challenge_method=S256`, `prompt=select_account`, `hd=<first allowed domain>`.
2. `GET /api/auth/google/callback`: compare `state` param with cookie and stored hash (timing-safe); exchange `code` at `https://oauth2.googleapis.com/token` (server-to-server `fetch`, 5 s timeout) with the verifier; verify `id_token` using `createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))`, `issuer: ["https://accounts.google.com", "accounts.google.com"]`, `audience: GOOGLE_CLIENT_ID`; check `nonce`, `email_verified === true`, email domain ∈ `ALLOWED_EMAIL_DOMAINS` **and** `hd` claim matches.
3. Account resolution: match by `authProviders(google, sub)` → else by email: existing **verified** password account → link automatically only if the email is verified on both sides; staff accounts must already exist (invited) — Google never creates staff; otherwise create an active student (department/year collected on a first-login "complete profile" step).
4. Create session exactly like password login (MFA rules still apply: if MFA enabled → redirect to `/login/mfa?challenge=…`; privileged without MFA → `mfaPending`). Redirect to `${APP_ORIGIN}/dashboard` or `/login?error=sso_failed` (never echo provider errors).

### 4.11 Session/device listing
`GET /api/auth/sessions` → parse UA with `ua-parser-js` → `deviceLabel` (e.g., "Chrome on Android"), approx location from Cloudflare `CF-IPCountry`/city headers if present (no third-party geo APIs), `current: sid === req.auth.sid`. Store only `ipHash = HMAC(PASSWORD_PEPPER, ip)`.

---

## 5. Authorization

- `requirePermission(p)` uses `hasPermission(role, p)` from `@scc/shared` (single source of truth).
- **Ownership/scope** checks live in each module's `policy.ts`:
  ```ts
  export function canModify(viewer: Viewer, doc: { authorId: ObjectId }, kind: "announcement" | "event" | "resource") {
    if (hasPermission(viewer.role, `${kind}:update:any`)) return true;
    return hasPermission(viewer.role, `${kind}:update:own`) && doc.authorId.equals(viewer.id);
  }
  ```
- **Load-then-authorize pattern**: fetch the document **with the visibility filter** (`visibleContentFilter(viewer)` or "own drafts"), return `404 NOT_FOUND` if absent, then call the policy → `403 FORBIDDEN` if not allowed. Never fetch by id alone for user-facing reads.
- **Mass-assignment:** body schemas are `.strict()` and never contain `authorId`, `status` for non-staff, counters, `role`. Services set `authorId = viewer.id`.
- **Admin guard rails:** cannot change own role; cannot suspend self; the last active admin cannot be demoted/suspended (`409 CONFLICT`); role changes and suspensions call `revokeAllSessions(target)` so the effect is immediate.
- Every denied authorization writes an audit entry `authz.denied` (rate-limited per user to avoid log floods).

---

## 6. Feature modules (business rules)

### 6.1 Announcements
- Create: staff with permission; `status` ∈ `draft | scheduled | published`; `scheduled` requires `publishAt > now + 1 min`; `expiresAt > publishAt`.
- Body is stored as plain text/Markdown; **no HTML rendering on the server**.
- On publish: bump cache version `cver:announcements`; no per-user notification fan-out for broadcast posts (clients use `lastFeedSeenAt`), except `pinned` posts which create an email digest entry.

### 6.2 Events
- RSVP via `@scc/db` `rsvpToEvent()` (transactional; no overbooking). Cancel promotes the oldest waitlisted user and notifies them (`notifications` + email job).
- `GET /:id/ics`: build an RFC 5545 VEVENT (escape text fields, UTC times, `UID: <eventId>@<domain>`), `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment`.

### 6.3 Resources — upload pipeline
```
POST /api/resources/upload-url   (faculty+: resource:create | student: resource:submit)
  validate metadata + fileName/mimeType/size against shared limits (PDF/DOCX/PPTX, ≤ 10 MB)
  create Resource { status: "awaiting_upload", file.key = "q/<yyyy>/<mm>/<resourceId>/<uuid>" }
  presign PUT to QUARANTINE bucket with signed ContentType + ContentLength, expires 10 min
  → 201 { resourceId, uploadUrl, headers: { "Content-Type", "Content-Length" }, expiresAt }

browser PUTs the file directly to storage (the API never handles file bytes)

POST /api/resources/:id/complete   (uploader only)
  HeadObject → size and content-type must equal the signed values, else delete + 400
  status → "pending_scan"; enqueue file-scan job (jobId = resourceId, idempotent) → 202

worker file-scan:
  stream object → check magic bytes (PDF "%PDF-"; DOCX/PPTX = ZIP with [Content_Types].xml
  declaring word/ or ppt/ main part; reject macro-enabled types) → ClamAV INSTREAM scan
  → compute sha256
  clean:   copy to FILES bucket key "f/<resourceId>/<sha256>", delete quarantine object,
           status = staff ? "published" : "pending_review"
  infected or invalid: status = "infected"/"rejected", keep evidence 30 days, notify uploader + audit

GET /api/resources/:id/download   (visible to viewer, status published)
  presign GET on FILES bucket, 60 s, ResponseContentDisposition = attachment; filename*=UTF-8''<safe name>,
  ResponseContentType = stored mimeType → 200 { url, expiresAt }; $inc downloadCount (async)
```
Storage buckets are **private**; no public-read objects anywhere. Bucket CORS allows only `PUT` from `APP_ORIGIN` with `Content-Type`/`Content-Length` headers. Cleanup job deletes `awaiting_upload` older than 24 h.

### 6.4 Openings
- `applyUrl` must be `https:`, no credentials in URL, hostname not an IP literal, length ≤ 500; stored as given, rendered client-side through the interstitial.
- Eligibility filter for students uses `eligibilityKeys` + optional `minCgpa` (we don't store CGPA: `minCgpa` is shown as information only — never ask students for CGPA in this phase).
- Scheduler closes openings past `closesAt` (`status: "closed"`).

### 6.5 Search
`GET /api/search` → `@scc/db` `searchAll()` (visibility-scoped). `q` 2–100 chars. Results limited per type (default 5, max 10). Cache 30 s per `(q normalised, viewerKeys hash)`.

### 6.6 Bookmarks, notifications, reports, moderation
- Bookmark create checks the item is visible to the viewer (`404` otherwise); duplicate → `409 CONFLICT`.
- Notifications are per-user only for **targeted** events (RSVP promotion, moderation result, security alerts, invite accepted). `unread-count` cached 30 s.
- Reports: one per user per item; 3+ open reports on an item auto-flag it (`moderation.state = "flagged"`) for the queue.
- Moderation approve/reject updates status, records `review`, notifies author, audits.

### 6.7 Admin
- Users list: filters + admin search (`users` search index); returns `UserDTO` (never hashes, never MFA secrets).
- Import CSV: upload via the same presigned-PUT pattern to quarantine (`text/csv`, ≤ 2 MB) → `user-import` job parses with `csv-parse` (stream), validates each row with the shared schema, creates `pending` users + invite tokens, writes an error report CSV to storage, updates `importJobs`.
- Analytics summary: counts from Redis-cached aggregations (refreshed every 5 min by the scheduler), never ad-hoc heavy aggregations per request.

### 6.8 Profile
- `PATCH /api/profile` allow-list: `name`, `phone` (stored encrypted), `bio`. Role/department/rollNo are admin-only.
- Export (step-up): JSON of the user's own data (profile, bookmarks, RSVPs, tracking, notifications, sessions metadata) generated synchronously if small, else via job + signed download URL.
- Delete (step-up + `confirm: "DELETE"` in body): soft delete, revoke sessions; anonymisation after 30 days (worker).

---

## 7. Caching (Redis)

| Key pattern | Content | TTL | Invalidation |
|---|---|---|---|
| `sess:<sid>` | `userId:tokenVersion` | idle remaining | delete on revoke |
| `user:<id>` | viewer profile (`role, department, year, status`) | 60 s | delete on profile/role/status change |
| `feed:<type>:v<ver>:<viewerKeysHash>:first` | first page of a feed (DTO list, viewer-agnostic fields only) | 60 s | version bump `cver:<type>` on any write |
| `res:v<ver>:<dept>:<year>:<sem>:<subject>:first` | first page of a resource filter | 120 s | version bump `cver:resources` |
| `search:<hash>` | search result ids | 30 s | expires |
| `stats:public`, `stats:admin` | counters | 5 min | scheduler refresh |
| `rl:*` | rate-limit counters | per bucket | — |

Rules: cache **only viewer-agnostic** data; add viewer-specific fields (`bookmarked`, `myRsvp`) after the cache read with one batched query. Use `SET … EX … NX` + short lock to prevent stampedes on hot keys. Redis outage: fail **open** for caches (read DB), fail **closed** for session checks only if Mongo is also unreachable; rate limiter falls back to an in-memory limiter per instance with stricter limits and logs an alert.

---

## 8. Worker (`apps/worker`, BullMQ)

| Queue | Jobs | Notes |
|---|---|---|
| `email` | transactional mails | Retries 5× exponential (30 s base); idempotency key per message; templates in `apps/worker/src/templates/*.ts` (plain text + minimal escaped HTML) |
| `file-scan` | resource + CSV scans | Concurrency 2 per worker (CPU/IO heavy); `jobId = resourceId` |
| `notify` | targeted notifications, digests | Batches of 1 000 inserts |
| `scheduler` | repeatable every 60 s: publish due announcements, expire, close openings; every 5 min: stats | Use BullMQ repeatable jobs with a fixed `jobId` so only one runs cluster-wide |
| `cleanup` | daily 02:30 IST: stuck uploads, rejected/infected files (30 d), anonymise users (30 d) | Logs counts |
| `user-import` | CSV import | Progress in `importJobs` |

All processors: validate job payloads with Zod, never trust queue data blindly, log `jobId` + duration, send failures to the dead-letter queue after max attempts, expose metrics.

### 8.1 Email
`nodemailer` with `SMTP_URL` (Mailpit locally; a transactional provider in production — choose one whose free tier fits, and set **SPF, DKIM, DMARC** on the sending domain). Never put tokens in subjects; links use `APP_ORIGIN`. Emails: verify, reset, invite, password changed, new-device sign-in, lockout warning, MFA enabled/disabled, low recovery codes, refresh reuse alert, RSVP promotion, moderation results.

---

## 9. Security checklist specific to the backend

- [ ] All routes via `defineRoute`; no route without explicit `auth`.
- [ ] Zod `.strict()` for bodies; params/query validated (ObjectId regex, enums, limits).
- [ ] Mongoose `sanitizeFilter` on + `rejectDangerousKeys` middleware.
- [ ] No user-controlled regex (`new RegExp(userInput)`) — escape or use search indexes.
- [ ] Outbound HTTP only to an allow-list: Google OAuth endpoints, Cloudflare Turnstile, HIBP, S3 endpoint, SMTP. No user-supplied URLs fetched server-side (SSRF prevention).
- [ ] Constant-time comparisons for tokens/hashes (`crypto.timingSafeEqual`).
- [ ] Secrets only from env/secret manager; JWT key rotation documented (`kid` + previous public key accepted for 24 h).
- [ ] `npm audit --audit-level=high` clean; Dependabot on.
- [ ] Error handler never leaks internals; `NODE_ENV=production` set in containers.
- [ ] Containers run as non-root, read-only filesystem, no shell tools in the runtime image.

---

## 10. Observability

### 10.1 Logging (`pino`)
JSON logs to stdout; fields `time, level, requestId, userId?, route, status, durationMs`. **Redact**: `req.headers.cookie`, `req.headers.authorization`, `req.headers["x-csrf-token"]`, `res.headers["set-cookie"]`, `*.password`, `*.newPassword`, `*.currentPassword`, `*.code`, `*.recoveryCode`, `*.token`, `*.secret`, `*.challengeId`. Log level `info` in prod, `debug` locally.

### 10.2 Audit events (write via `lib/audit.ts` → `auditLogs`)
`auth.register`, `auth.email.verified`, `auth.login.success|failure`, `auth.lockout`, `auth.mfa.enrolled|disabled|verify_failed`, `auth.recovery_code.used`, `auth.refresh.reuse_detected`, `auth.password.changed|reset`, `auth.session.revoked`, `auth.logout_all`, `auth.stepup`, `authz.denied`, `admin.user.invite|role_change|suspend|activate|revoke_sessions|import`, `content.create|update|delete` (staff), `moderation.approve|reject`, `profile.export|delete`, `file.infected`.

### 10.3 Metrics and alerts
`prom-client` on an **internal** port (`:9464`, not exposed publicly): HTTP latency histogram by route, error counts by code, login success/failure rates, rate-limit hits, queue depth, cache hit ratio, Mongo pool usage. Alerts (Grafana Cloud free tier or provider alerts): p95 > 800 ms for 5 min, 5xx > 1%, login failures spike (> 5× baseline), refresh-reuse events > 0, queue depth > 1 000, infected file found. Optional Sentry for exceptions (scrub PII).

---

## 11. Testing

### 11.1 Setup
Vitest + Supertest against `createApp()` with real Mongo (`mongodb-memory-server` replica set, or `MONGO_TEST_URI`) and real Redis in CI (service container; `ioredis-mock` only for pure unit tests). Helpers: `agent()` with cookie jar, `getCsrf()`, `loginAs(role, { mfa })`, `seedMinimal()`.

### 11.2 Required suites
| Suite | Must cover |
|---|---|
| `auth/register` | domain allow-list, same response for existing email, verification token single-use + expiry |
| `auth/login` | wrong password generic, unknown email same timing envelope (assert both > 0.8× Argon2 time), lockout progression, CAPTCHA requirement, suspended/unverified only after correct password |
| `auth/mfa` | enrol/confirm, replay rejected, recovery code single-use, privileged MFA enforcement (`MFA_ENROLLMENT_REQUIRED` everywhere except allow-list), disable forbidden for staff |
| `auth/refresh` | rotation, race → `REFRESH_IN_PROGRESS`, reuse → revoke + `SESSION_REVOKED`, absolute expiry |
| `auth/sessions` | logout-all, revoke one, suspension logs out instantly (next request 401) |
| `auth/csrf` | missing/invalid/wrong-sid token → 403; Origin mismatch → 403 |
| `auth/google` | state mismatch, nonce mismatch, wrong domain, unverified email (mock token endpoint + JWKS) |
| `rbac/permission-matrix` | **Generated** from `ROUTES × ROLES`: expected allow/deny computed from `ROLE_PERMISSIONS`; asserts 2xx/4xx accordingly. Fails if any route lacks `auth` |
| `rbac/object-level` | student can't read another dept's targeted item (404), faculty can't edit another faculty's post (403), moderator can, admin can |
| `modules/*` | CRUD happy paths, validation errors, pagination, RSVP capacity, ICS output |
| `uploads` | type/size rejection at upload-url, HeadObject mismatch, scan outcomes (mock ClamAV), download only when published + visible |
| `security/headers` | helmet headers present, no `x-powered-by`, error bodies have no stack |
| `security/injection` | `$ne`/`$gt` in body/query rejected, prototype-pollution keys rejected |
| `security/rate-limits` | each bucket returns 429 with `Retry-After` |

Coverage target `apps/api` ≥ **80% lines**, 100% of `modules/auth`.

### 11.3 Contract tests
Response bodies are validated against `@scc/shared` DTO schemas in tests (`expect(userDto.parse(res.body.user))`). A contract change without matching tests fails CI.

### 11.4 Load tests (`infra/k6/`)
Scenarios: `browse.js` (80%: feed, lists, details), `search.js` (10%), `login.js` (5%, with pre-seeded users and MFA disabled test accounts), `download.js` (4%), `publish.js` (1%, faculty). Run against a **staging** deployment seeded with `db:seed:load` (1 lakh users). Thresholds: `http_req_duration{p(95)}<300`, `http_req_failed<0.005`. Save the report to `docs/lab/load-test-report.md` (needed for the demo).

---

## 12. Infrastructure, CI/CD, deployment

### 12.1 Local (`docker-compose.yml`)
Services: `mongo` (replica set `rs0`, healthcheck runs `rs.initiate` once), `redis`, `minio` (+ bucket init job creating `scc-quarantine`, `scc-files` with CORS for `http://localhost:5173`), `mailpit` (SMTP 1025, UI 8025), `clamav` (port 3310; optional profile `scan` because it's heavy — when off, the worker uses a dev stub that marks files clean **only when `NODE_ENV=development`**).
`npm run dev` = `docker compose up -d` + `concurrently` (api via `tsx watch`, worker, web via Vite).

### 12.2 Containers
- `infra/docker/api.Dockerfile`: multi-stage (`node:22-alpine` build → runtime with only `dist` + prod deps), `USER node`, `NODE_ENV=production`, `HEALTHCHECK` hitting `/api/health`, read-only root FS compatible.
- `infra/docker/worker.Dockerfile`: same pattern.
- `infra/docker/web.Dockerfile`: build SPA → `nginx:alpine` serving `/` and proxying `/api` to the API service.

### 12.3 nginx (`infra/nginx/default.conf`) — same origin + browser security headers
```nginx
server {
  listen 8080;
  server_tokens off;
  client_max_body_size 200k;              # API bodies are small; files go to storage directly
  root /usr/share/nginx/html;

  add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<storage-host>; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
  add_header Cross-Origin-Opener-Policy "same-origin" always;
  add_header Cross-Origin-Resource-Policy "same-origin" always;

  location /api/ {
    proxy_pass http://api:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id $request_id;
    proxy_read_timeout 30s;
  }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; }
  location / { add_header Cache-Control "no-cache"; try_files $uri /index.html; }
}
```
(`add_header` inside `location` blocks overrides server-level headers in nginx — repeat the security headers in those blocks or use an `include` snippet; test with `curl -I`.) React sets inline styles via the DOM style API, which CSP `style-src 'self'` allows; do not add `'unsafe-inline'`. `connect-src` must include the storage host for direct uploads.

### 12.4 Hosting (zero-budget demo → paid scale)
| Layer | Demo / student credits | Scale-up path |
|---|---|---|
| Edge | Cloudflare (free plan): DNS proxy, TLS, WAF managed rules available on the plan, Turnstile, cache static | Paid WAF rules, bot management |
| Containers | One of: Azure Container Apps (Azure for Students credit), Google Cloud Run, Render, Railway, or a single small VM with Docker Compose | Autoscaled container service, min 2 API replicas, separate worker scaling |
| MongoDB | Atlas (dedicated tier only during load test/launch) | Larger tier → read secondaries → sharding (Database.md §2) |
| Redis | Managed Redis free tier (check limits) or a container on the VM | Managed Redis with replicas |
| Storage | Cloudflare R2 or S3-compatible (check free tier) | Same, with lifecycle rules |
| Email | Transactional provider free tier | Paid tier |

Always check each provider's current pricing and free-tier limits before committing — they change. **Warm up** sleeping free instances before the demo.

### 12.5 GitHub Actions (`.github/workflows/`)
| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | PR + push to `dev`/`main` | `npm ci` → lint → typecheck → unit/integration tests (services: mongo replica set, redis) → build → upload coverage |
| `security.yml` | PR + weekly | `npm audit --audit-level=high`, gitleaks, CodeQL (javascript-typescript), Trivy scan of built images (fail on HIGH/CRITICAL with fix available) |
| `e2e.yml` | PR to `main` | `docker compose up` → seed → Playwright (from `apps/web`) → upload traces on failure |
| `lighthouse.yml` | PR touching `apps/web` | Lighthouse CI with `apps/web/lighthouse-budget.json` (config supplied by Frontend/UI) |
| `deploy.yml` | push to `main` (+ manual) | Build + push images to GHCR (tag = git SHA) → run `db:migrate` + `db:sync-indexes` (migrator credentials) → deploy api/worker/web → smoke test `/api/ready` + login of a canary test account → notify team |
Plus `dependabot.yml` (npm weekly, actions monthly), `CODEOWNERS`, PR template, issue templates (`bug`, `change-request`, `contract`). Branch protection on `main` and `dev`: required checks `ci`, `security`, 1 approval, CODEOWNERS review.

### 12.6 Runtime behaviour
- Graceful shutdown on `SIGTERM`: stop accepting connections, finish in-flight requests (≤ 25 s), close Mongo/Redis/queues.
- `/api/health` = process alive (no dependencies). `/api/ready` = Mongo ping + Redis ping (≤ 1 s each) → used by the load balancer.
- Autoscale API on CPU ≥ 60% or concurrency ≥ 80 per instance; min 2 instances in production.

---

## 13. Day-0 coordinator checklist (M1)
- [ ] Create the GitHub repo/org, add the 3 members, enable branch protection on `main` and `dev`.
- [ ] Push the skeleton: root configs, workspaces, `packages/shared` skeleton with roles/permissions/errors from `AGENTS.md`, empty `packages/db`, `packages/ui`, `apps/*`, `docs/agents/*.md`, `CLAUDE.md`, `.cursor/rules/agents.mdc`, `.env.example`, `docker-compose.yml`, CI workflows, CODEOWNERS with real usernames.
- [ ] Verify a fresh clone works: `npm install && npm run dev` brings up the stack and `/api/health` returns 200.
- [ ] Create the GitHub Project board with columns *Backlog / In progress / Review / Done* and the Phase 0–3 issues from `AGENTS.md` §11.
- [ ] Set up Atlas project, Cloudflare account, storage bucket, email provider; store secrets in the hosting provider's secret manager (never in the repo).

---

## 14. Definition of Done (Backend)
- [ ] Route registered with `defineRoute` (auth, permission, schemas, rate limit as needed).
- [ ] Permission-matrix and object-level tests pass; new route appears in the matrix automatically.
- [ ] Contract DTO validation in tests; OpenAPI regenerated if the contract changed.
- [ ] Audit events written for security-relevant actions; logs redact secrets.
- [ ] No new dependency without approval; `npm audit` clean; CI green.
- [ ] Docs updated (this file / ADR) when behaviour or architecture changes.
