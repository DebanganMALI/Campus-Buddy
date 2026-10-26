# Database.md — Smart Campus Companion
### Role file for the Database owner (M3) and their AI agent

> **Note:** M1 created the first models (`user`, `session`, `auth-token`, `audit-log`) on Day 0 so auth could start. They follow this file; you own them from now on.
>
> **Read `docs/AGENTS.md` first.** It defines the contract, ownership and workflow. This file tells you *how to build the data layer*.
> You own **`database/**`** (`@scc/db`). You do not edit `backend/**`, `frontend/**` or other folders — propose changes via issues.

---

## 0. Agent operating instructions

1. Read `AGENTS.md` → this file → `shared/src/schemas/*` (field names and enums must match exactly).
2. Plan mode first: list the files you will create and the indexes you will add; wait for approval.
3. Build in this order: **connection + base plugins → models (§4) → indexes → query helpers (§6) → migrations (§7) → seed (§8) → tests (§10)**.
4. Every model change ships with: updated index list, a migration if existing data is affected, tests, and an update to this file's tables.
5. Never weaken validation to make a seed or test pass. Never commit real personal data.

### 0.1 What you deliver to the others
| Consumer | What `@scc/db` exports |
|---|---|
| Backend (`backend`, `backend/src/worker`) | `connectDb()`, `disconnectDb()`, all models, `toDTO` mappers, `paginate()`, `audienceFilter()`, `visibleContentFilter()`, `searchAll()`, `feedForUser()`, `withTransaction()`, field crypto helpers, `syncIndexes()` |
| Frontend | Nothing (web never imports `@scc/db`) |
| Everyone | Seed data for local dev and the demo; load-test data generator |

---

## 1. Platform decisions

| Topic | Decision |
|---|---|
| Database | **MongoDB 7+**. Production: **MongoDB Atlas** (dedicated tier for the load test and launch; free M0 only for early development — check Atlas's current tier limits). Local: Docker `mongo` single-node **replica set** `rs0` (transactions need a replica set). |
| ODM | **Mongoose 9**, TypeScript, models typed from `@scc/shared` DTO types where possible |
| Global Mongoose settings | `strictQuery: true`, `sanitizeFilter: true` (neutralises `$`-operator injection in filters), `autoIndex: false` in production (indexes are created by `npm run db:sync-indexes` during deploy), `id` virtual on, `versionKey: false` in JSON output |
| Search | **Atlas Search** in production (`SEARCH_MODE=atlas`); **MongoDB text indexes** as local/dev fallback (`SEARCH_MODE=text`). Both behind one helper `searchAll()`. |
| Time | Store `Date` in UTC; never store formatted strings |
| IDs | `ObjectId` in DB, exposed as `id` hex string via `toDTO` |
| Deletes | **Soft delete** (`deletedAt`) for user-generated content and users; hard delete only by retention jobs |
| Tenant readiness | Do **not** add `tenantId` now; keep all queries going through helpers so adding it later is one change |

### 1.1 Connection settings (`database/src/connect.ts`)
```ts
await mongoose.connect(env.MONGO_URI, {
  maxPoolSize: 50,              // per API instance; tune with load test
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5_000,
  socketTimeoutMS: 45_000,
  retryWrites: true,
  w: "majority",                // durability for auth/session writes
  readPreference: "primary",    // default; specific read helpers opt into secondaries (§6.5)
  appName: "scc-api",
});
```
Expose `pingDb()` for `/api/ready`. Log connection events (no credentials in logs).

---

## 2. Capacity model (why the indexes look like this)

Planning assumptions for **1 lakh registered users** (re-check after the load test):

| Collection | Est. docs at launch | Growth driver | Notes |
|---|---|---|---|
| users | 100 000 | enrolment | ~1 KB each |
| sessions | ~150 000 active | logins | TTL-expired automatically |
| announcements / events / openings | 10 000s | staff posts | small, read-heavy, cached by API |
| resources | ~50 000 | uploads | metadata only; files live in object storage |
| bookmarks | ~2 000 000 | students | per-user queries |
| notifications | ~5 000 000 | fan-out | TTL 90 days |
| eventRsvps / openingTracking | ~1 000 000 | students | per-user + per-item |
| auditLogs | ~3 000 000/yr | security events | TTL 365 days |

**Read pattern:** feeds and lists dominate (≥ 90% reads). **Hot path:** "what's new for my department + year" — designed for an index-only bounded scan + Redis cache in the API.

**Sharding plan (for 10–20 lakh users, not now):** content collections stay unsharded (small). Shard the per-user, high-volume collections by **hashed `userId`**: `notifications`, `bookmarks`, `eventRsvps`, `openingTracking`, `sessions`; `auditLogs` by hashed `actorId`. Keep `userId` in every one of those documents and in every query on them **now**, so sharding later needs no code change.

---

## 3. Shared model conventions

- Every collection: `createdAt`, `updatedAt` (`timestamps: true`).
- Content collections: `authorId` (ref users), `status`, `deletedAt: Date | null`.
- A base plugin `basePlugin` adds: `toJSON` transform (`_id → id`, drop `__v`, drop fields marked `select: false`), `deletedAt` default `null`.
- **Sensitive fields** use `select: false` (`passwordHash`, `mfa.secretEnc`, `mfa.recoveryCodes`, `refreshHash`, `tokenHash`) so they never leak by accident; services must explicitly `.select('+passwordHash')`.
- **Enums come from `@scc/shared`** (`ROLES`, `DEPARTMENTS`, `YEARS`, statuses). Never duplicate the arrays.
- **Strings:** `trim: true`; max lengths match the shared Zod schemas.
- **Arrays:** cap sizes with validators (e.g., audience departments ≤ 30).
- `toDTO(doc, viewer)` mappers live in `database/src/mappers/` and add viewer-specific fields (`bookmarked`, `myRsvp`, `myTracking`) only when the caller passes them.

---

## 4. Collections and schemas

Notation: `field: Type (rules)`. **R** = required. Indexes are listed per collection; the reason for each index is in §5.

### 4.1 `users`
```
email: String R (lowercase, trim, unique, max 254)
emailVerified: Boolean (default false)
name: String R (2–80)
rollNo: String (unique, sparse, uppercase, max 30)
role: enum ROLES R (default "student")
department: enum DEPARTMENTS R
year: Number (1–5)            # students only
section: String (max 5)
status: enum ["pending","active","suspended","deleted"] R (default "pending")
passwordHash: String (select:false)            # null for SSO-only users
authProviders: [{ provider: "google", subject: String }]
mfa: { enabled: Boolean, secretEnc: String (select:false), lastUsedStep: Number,
       recoveryCodes: [{ hash: String, usedAt: Date|null }] (select:false), enrolledAt: Date }
tokenVersion: Number (default 0)               # bump to invalidate all tokens
security: { failedLogins: Number, lockUntil: Date|null, lastLoginAt: Date, lastLoginIpHash: String }
profile: { phoneEnc: String (select:false), bio: String (max 300), avatarKey: String }
settings: { emailNotifications: Boolean (default true), animations: Boolean (default true) }
lastFeedSeenAt: Date            # "new since last visit" badge for broadcast content (no per-user fan-out)
deletedAt: Date|null
anonymizedAt: Date|null
```
Indexes: `{ email: 1 }` unique · `{ rollNo: 1 }` unique sparse · `{ "authProviders.provider": 1, "authProviders.subject": 1 }` unique sparse · `{ role: 1, status: 1, createdAt: -1 }` · `{ department: 1, year: 1, status: 1 }` · text/search on `name, email` (admin search).

### 4.2 `sessions`
```
_id: String R                  # 128-bit random hex sid (NOT ObjectId — unguessable)
userId: ObjectId R
refreshHash: String R (select:false)          # SHA-256 of current refresh secret
prevRefreshHash: String (select:false)
rotatedAt: Date
userAgent: String (max 300), deviceLabel: String, ipHash: String, approxLocation: String
mfaPending: Boolean            # privileged user must enrol MFA before using the app
authTime: Date                 # last full authentication (for step-up)
createdAt, lastUsedAt: Date
expiresAt: Date R              # idle expiry, capped by absoluteExpiresAt
absoluteExpiresAt: Date R
revokedAt: Date|null, revokeReason: String
```
Indexes: `{ userId: 1, revokedAt: 1, lastUsedAt: -1 }` · TTL `{ expiresAt: 1 }, expireAfterSeconds: 0`.

### 4.3 `authTokens` (email verify, password reset, invite, MFA challenge, OAuth state)
```
userId: ObjectId (R except oauth_state)
type: enum ["email_verify","password_reset","invite","mfa_challenge","oauth_state"] R
tokenHash: String R (unique, select:false)    # SHA-256 of the raw token; raw token never stored
attempts: Number (default 0)   # mfa_challenge max 5
meta: Mixed (small: e.g., invite role, pkce verifier hash)
expiresAt: Date R
usedAt: Date|null
```
Indexes: `{ tokenHash: 1 }` unique · `{ userId: 1, type: 1, usedAt: 1 }` · TTL `{ expiresAt: 1 }`.

### 4.4 `announcements`
```
title: String R (3–140)
body: String R (1–10 000)       # plain text / Markdown; never HTML
audience: { departments: [String] R (["ALL"] or DEPARTMENTS), years: [Number|"ALL"] R }
audienceKeys: [String] R (derived in pre-validate hook, select:false) # see note below
status: enum ["draft","scheduled","published","archived"] R
publishAt: Date                 # = createdAt when published immediately
expiresAt: Date|null
pinned: Boolean (default false)
authorId: ObjectId R
moderation: { state: enum ["none","flagged","removed"], reason: String, by: ObjectId, at: Date }
deletedAt: Date|null
```
Indexes: `{ status: 1, audienceKeys: 1, publishAt: -1, _id: -1 }` (feed, partial `{ deletedAt: null }`) · `{ authorId: 1, createdAt: -1 }` · `{ status: 1, publishAt: 1 }` (scheduler) · `{ expiresAt: 1 }` partial `status: "published"` (expiry job) · search index (title^3, body).

> **Why `audienceKeys`:** a compound index can't include two fields that are both arrays in the same document. `audience.departments` and `audience.years` are both arrays, so instead we index one flattened array, e.g. `["CSE:3", "CSE:ALL", "ALL:3", "ALL:ALL"]`, computed from `audience` in a `pre('validate')` hook (§6.1). Clients never send it. Events use the same pattern; openings use `eligibilityKeys`.

### 4.5 `events`
```
title R (3–140), description R (≤ 10 000), venue R (≤ 140)
startsAt: Date R, endsAt: Date R (> startsAt)
capacity: Number|null (1–100 000)
rsvpCount: Number (default 0), waitlistCount: Number (default 0)
audience + audienceKeys (as announcements)
status: enum ["draft","published","cancelled"] R
isPublic: Boolean (default false)   # shown on landing page
authorId R, moderation, deletedAt
```
Indexes: `{ status: 1, audienceKeys: 1, startsAt: 1, _id: 1 }` · `{ isPublic: 1, status: 1, startsAt: 1 }` · `{ authorId: 1, createdAt: -1 }` · search index.

### 4.6 `eventRsvps`
```
eventId: ObjectId R, userId: ObjectId R
status: enum ["going","waitlisted","cancelled"] R
checkedInAt: Date|null
```
Indexes: `{ eventId: 1, userId: 1 }` unique · `{ userId: 1, status: 1, createdAt: -1 }` · `{ eventId: 1, status: 1, createdAt: 1 }` (waitlist promotion order).

**Atomic capacity rule** (helper `rsvpToEvent()` in §6): inside a transaction, `findOneAndUpdate({ _id, status: "published", $expr: { $lt: ["$rsvpCount", "$capacity"] } }, { $inc: { rsvpCount: 1 } })`; if null → waitlist (`$inc waitlistCount`). Cancelling promotes the oldest waitlisted RSVP in the same transaction. **No overbooking under concurrency** — this is tested (§10).

### 4.7 `resources`
```
title R (3–140), description (≤ 2 000)
department: enum R, year: Number R (1–5), semester: Number R (1–10), subject: String R (2–80, trim)
subjectKey: String R          # normalised lowercase subject for exact filtering
file: { key: String R, name: String R (≤ 200), mimeType: enum ["application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"] R,
        size: Number R (≤ 10 485 760), sha256: String }
status: enum ["awaiting_upload","pending_scan","pending_review","published","rejected","infected"] R
version: Number (default 1), previousVersionId: ObjectId|null
uploadedBy: ObjectId R
review: { by: ObjectId, at: Date, reason: String }
downloadCount: Number (default 0)
deletedAt
```
Indexes: `{ status: 1, department: 1, year: 1, semester: 1, subjectKey: 1, createdAt: -1, _id: -1 }` (the dept → year → sem → subject flow) · `{ uploadedBy: 1, createdAt: -1 }` · `{ status: 1, createdAt: 1 }` (moderation queue + stuck-upload cleanup) · search index (title^3, subject^2, description).

### 4.8 `openings`
```
title R, company R (≤ 100), type: enum ["job","internship"] R
description R (≤ 10 000), location (≤ 100), compensation (≤ 100)
eligibility: { departments: [..] | ["ALL"], years: [..] | ["ALL"], minCgpa: Number|null (0–10) }
eligibilityKeys: [String]       # flattened like audienceKeys
closesAt: Date R
applyUrl: String R (https only, ≤ 500)
status: enum ["draft","published","closed"] R
postedBy R, moderation, deletedAt
```
Indexes: `{ status: 1, eligibilityKeys: 1, closesAt: 1, _id: 1 }` · `{ status: 1, type: 1, closesAt: 1 }` · `{ postedBy: 1, createdAt: -1 }` · search index.

### 4.9 `openingTracking`
`openingId R, userId R, status: enum ["interested","applied"] R` · Indexes `{ userId: 1, openingId: 1 }` unique · `{ openingId: 1, status: 1 }`.

### 4.10 `bookmarks`
`userId R, itemType: enum ["announcement","event","resource","opening"] R, itemId R` · Indexes `{ userId: 1, itemType: 1, itemId: 1 }` unique · `{ userId: 1, createdAt: -1, _id: -1 }`.

### 4.11 `notifications`
`userId R, type: enum [...] R, title R (≤ 140), body (≤ 500), link (relative path only), readAt: Date|null, expiresAt R (createdAt + 90 d)` · Indexes `{ userId: 1, readAt: 1, createdAt: -1 }` · TTL `{ expiresAt: 1 }`.

### 4.12 `reports`
`reporterId R, itemType R, itemId R, reason: enum ["spam","abuse","copyright","wrong_info","other"] R, note (≤ 500), state: enum ["open","actioned","dismissed"] R, handledBy, handledAt` · Indexes `{ state: 1, createdAt: 1 }` · `{ itemType: 1, itemId: 1, reporterId: 1 }` unique (one report per user per item).

### 4.13 `auditLogs` (append-only)
```
actorId: ObjectId|null, actorRole: String
action: String R            # e.g. "auth.login.success", "admin.user.suspend", "content.delete"
targetType: String, targetId: String
result: enum ["success","denied","failure"] R
ipHash: String, userAgent: String (≤ 300), requestId: String
meta: Mixed (≤ 4 KB, no secrets, no tokens)
createdAt: Date R
expiresAt: Date R (createdAt + 365 d)
```
Indexes: `{ createdAt: -1 }` · `{ actorId: 1, createdAt: -1 }` · `{ action: 1, createdAt: -1 }` · `{ targetType: 1, targetId: 1, createdAt: -1 }` · TTL `{ expiresAt: 1 }`.
The app DB user can only **insert and find** here (§9). The model disables `updateOne/deleteOne` methods via schema `pre` hooks that throw.

### 4.14 `importJobs`
`createdBy R, type: "user_import", status: enum ["queued","running","done","failed"], totals: { rows, created, skipped, errors }, errorReportKey, createdAt, finishedAt` · Index `{ createdBy: 1, createdAt: -1 }`.

### 4.15 `migrations` and `migrationLock`
Managed by the runner (§7). Do not touch by hand.

---

## 5. Query patterns → indexes

Every query used by the API must appear here with its index. Backend adds new rows via PR; you add the index.

| # | Query (who) | Filter + sort | Index used |
|---|---|---|---|
| Q1 | Student feed: announcements | `status=published, audienceKeys ∈ viewerKeys, publishAt ≤ now, (expiresAt null or > now), deletedAt null` sort `publishAt -1, _id -1` | announcements feed index |
| Q2 | Upcoming events for viewer | `status=published, audienceKeys ∈ viewerKeys, startsAt ≥ now` sort `startsAt 1` | events feed index |
| Q3 | Resources filter | `status=published, department, year, semester, subjectKey` sort `createdAt -1` | resources compound |
| Q4 | Openings for viewer, closing soon | `status=published, eligibilityKeys ∈ viewerKeys, closesAt ≥ now` sort `closesAt 1` | openings index |
| Q5 | My posts (staff) | `authorId` sort `createdAt -1` | `{ authorId, createdAt }` |
| Q6 | Login by email | `email` | unique email |
| Q7 | Active sessions for user | `userId, revokedAt null` sort `lastUsedAt -1` | sessions index |
| Q8 | My bookmarks | `userId` (+ `itemType`) sort `createdAt -1` | bookmarks indexes |
| Q9 | Unread notifications | `userId, readAt null` sort `createdAt -1` | notifications index |
| Q10 | Moderation queue | `status=pending_review` sort `createdAt 1` (resources) / reports `state=open` | status/createdAt |
| Q11 | Admin user list | `role?, status?, department?` sort `createdAt -1`; search by name/email | users indexes / search |
| Q12 | Audit log view | `actorId? / action? / date range` sort `createdAt -1` | audit indexes |
| Q13 | Scheduler: due announcements | `status=scheduled, publishAt ≤ now` | `{ status, publishAt }` |
| Q14 | Expiry job | `status=published, expiresAt ≤ now` | expiry partial index |
| Q15 | Waitlist promotion | `eventId, status=waitlisted` sort `createdAt 1` | eventRsvps index |

`viewerKeys` for a student in CSE year 3 = `["CSE:3","CSE:ALL","ALL:3","ALL:ALL"]`. Staff see all published (`audienceKeys` filter omitted).

---

## 6. Query helpers (`database/src/queries/`)

The backend uses these instead of hand-writing complex queries.

### 6.1 Audience keys
```ts
// database/src/queries/audience.ts
import type { Audience } from "@scc/shared";

/** Flattens an audience into index-friendly keys ("DEPT:YEAR"), including ALL wildcards. */
export function audienceToKeys(a: Audience): string[] {
  const depts = a.departments.includes("ALL") ? ["ALL"] : a.departments;
  const years = a.years.includes("ALL") ? ["ALL"] : a.years.map(String);
  const keys: string[] = [];
  for (const d of depts) for (const y of years) keys.push(`${d}:${y}`);
  return keys;
}

/** Keys a viewer matches: their exact dept/year plus every wildcard combination. */
export function viewerKeys(department: string, year?: number): string[] {
  const y = year ? String(year) : "ALL";
  return Array.from(new Set([`${department}:${y}`, `${department}:ALL`, `ALL:${y}`, "ALL:ALL"]));
}
```
`audienceToKeys` runs in a `pre('validate')` hook on announcements/events/openings. Max keys per doc: 30 depts × 5 years = 150 (validator enforces).

### 6.2 Visibility filter
```ts
export function visibleContentFilter(viewer: { role: Role; department: string; year?: number }, now = new Date()) {
  const base = { deletedAt: null, status: "published" as const };
  if (viewer.role !== "student") return base;                 // staff see all published
  return { ...base, audienceKeys: { $in: viewerKeys(viewer.department, viewer.year) } };
}
```
Announcements add `publishAt: { $lte: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]`.

### 6.3 Cursor pagination
```ts
// Keyset pagination: stable, index-friendly, no skip().
export async function paginate<T>(model: Model<T>, filter: object, opts: {
  sortField: string; direction: 1 | -1; limit: number; cursor?: string | null;
}) {
  const limit = Math.min(Math.max(opts.limit, 1), 50);
  const q: any = { ...filter };
  if (opts.cursor) {
    const { v, id } = decodeCursor(opts.cursor);              // base64url JSON; validate shape!
    const op = opts.direction === -1 ? "$lt" : "$gt";
    q.$or = [{ [opts.sortField]: { [op]: v } }, { [opts.sortField]: v, _id: { [op]: id } }];
  }
  const docs = await model.find(q).sort({ [opts.sortField]: opts.direction, _id: opts.direction })
    .limit(limit + 1).lean();
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const last = items.at(-1) as any;
  return { items, nextCursor: hasMore && last ? encodeCursor({ v: last[opts.sortField], id: last._id }) : null };
}
```
`decodeCursor` must validate with Zod and throw `VALIDATION_ERROR` on garbage. Combine `$or` with existing `$or` via `$and` (handle in code).

### 6.4 Search
`searchAll(q, viewer, { types, limit })` returns `{ announcements, events, resources, openings }`, each item a DTO, each list **already filtered by `visibleContentFilter`**.
- `atlas` mode: one `$search` per collection with `compound: { must: [text], filter: [equals/in on status, audienceKeys] }`, `autocomplete` on title, fuzzy `maxEdits: 1`, run the 4 aggregations in parallel, limit each.
- `text` mode: `$text: { $search: q }` + visibility filter, sort by `textScore`.
- Escape/limit input: `q` 2–100 chars (shared schema).

Atlas Search index definitions live in `database/search-indexes/*.json` and are applied by `npm run db:sync-search` (Atlas Admin API or Atlas CLI). Example:
```json
{ "name": "announcements_search", "mappings": { "dynamic": false, "fields": {
  "title": [{ "type": "string", "analyzer": "lucene.standard" }, { "type": "autocomplete" }],
  "body": { "type": "string", "analyzer": "lucene.standard" },
  "status": { "type": "token" }, "audienceKeys": { "type": "token" },
  "deletedAt": { "type": "date" }, "publishAt": { "type": "date" } } } }
```

### 6.5 Read preferences
- Feeds, lists, search for **other people's content**: `readPreference("secondaryPreferred")` with `maxStalenessSeconds: 90`.
- Anything just written by the same user (my posts, my RSVP, my bookmarks, auth, sessions): **primary**.
- Helpers take an option `{ fresh: boolean }`; default `fresh: true` (primary) — be explicit when choosing secondaries.

### 6.6 Other helpers
`feedForUser(viewer, cursor)` (Q1+Q2 merged view used by dashboard), `rsvpToEvent()` / `cancelRsvp()` (transactional, §4.6), `withTransaction(fn)` (session + retries on `TransientTransactionError`), `incrementDownload(resourceId)` (fire-and-forget `$inc`), `toDTO` mappers, `encryptField()/decryptField()` (AES-256-GCM, key from env, format `v1:<iv>:<tag>:<ciphertext>` base64 — used for `profile.phoneEnc` and by Backend for `mfa.secretEnc`).

---

## 7. Migrations

- Location: `database/migrations/NNNN-description.ts`, each exporting `up(db)` and `down(db)`.
- Runner: `database/src/migrate.ts` (no extra dependency): acquires a lock document (`migrationLock`, `findOneAndUpdate` with `lockedUntil`), applies pending migrations in order, records `{ name, appliedAt, checksum }` in `migrations`.
- Commands: `npm run db:migrate`, `npm run db:migrate:down -- --to 0003`, `npm run db:migrate:status`.
- `npm run db:sync-indexes` calls `Model.syncIndexes()` for every model (creates missing, **drops indexes not in the schema** — review the diff output before running in production; run with `--dry-run` first).
- Rules: migrations are **idempotent**, work on batches of ≤ 1 000 docs, never load a whole collection into memory, and are tested up → down → up on seed data.
- Initial migrations: `0001-init-collections` (create collections with JSON-schema validators mirroring critical fields as a second safety net), `0002-indexes`, `0003-audit-role` (documents the custom role; applied by an Atlas admin, not the app).

---

## 8. Seed and test data

### 8.1 Demo seed (`npm run db:seed`)
- **Refuses to run when `NODE_ENV=production`** or when `MONGO_URI` host is not in an allowlist (`localhost`, `127.0.0.1`, staging host).
- Deterministic: `faker.seed(2026)`.
- Creates: 1 admin, 1 moderator, 1 placement officer, 3 faculty (different departments), 60 students across departments/years; ~40 announcements (mixed audiences, some scheduled, some expired), ~15 events (some full with waitlists), ~80 resources across dept/year/sem/subject (status published, with placeholder PDF objects uploaded to MinIO), ~20 openings (some closing within 3 days), bookmarks, notifications, a few reports, audit entries.
- Passwords come from `SEED_PASSWORD` env (required, ≥ 12 chars). Staff accounts are seeded **with MFA disabled but `mfaPending` flow active** so the demo shows enrolment; optionally `SEED_MFA_SECRET` to pre-enrol for automated e2e tests.
- Prints the demo logins at the end (emails only, never passwords).
- Idempotent: running twice doesn't duplicate (upsert by email / natural keys) or offers `--reset` (drops seeded collections — local only).

### 8.2 Load-test data (`npm run db:seed:load -- --users 100000`)
- Generates 1 lakh users (one precomputed Argon2id hash reused for all — compute once with the real parameters), realistic dept/year distribution, 10 000 announcements, 2 000 events, 50 000 resources, 3 000 openings, 1 000 000 bookmarks.
- `insertMany` in batches of 1 000 with `ordered: false`; build indexes **after** bulk load for speed, then verify with explain tests.
- Writes `backend/infra/k6/data/users.csv` (email list for k6) — git-ignored.

---

## 9. Security of the data layer

| Control | Implementation |
|---|---|
| Network | Atlas: private endpoint / VPC peering, or IP access list limited to the API/worker egress IPs; **never `0.0.0.0/0`** in production. TLS required. |
| DB users (least privilege) | `scc_app` — readWrite on `scc` collections **except** `auditLogs` where a custom role grants only `find` + `insert`. `scc_migrator` — `dbAdmin` + `readWrite`, used only by the deploy job. `scc_readonly` — `read`, for analytics/backups. Passwords in the secret manager, rotated each term. |
| Injection | `sanitizeFilter: true`; helpers accept typed parameters only; never build filters from raw `req.query` objects; never use `$where`, `$function` or `mapReduce`. |
| Sensitive fields | `select: false`; hashes not plaintext (passwords Argon2id by Backend; tokens SHA-256); `profile.phoneEnc` + `mfa.secretEnc` encrypted with AES-256-GCM. |
| Encryption at rest | Atlas default (storage encryption). Backups encrypted. |
| PII minimisation (DPDP Act) | Store only what features need. No date of birth, no addresses, no Aadhaar/IDs — **ever**. |
| Retention | TTL: sessions (expiry), authTokens (expiry), notifications (90 d), auditLogs (365 d). Worker jobs: delete `rejected`/`infected` resources + objects after 30 d; **anonymise** users soft-deleted ≥ 30 d (name → "Former user", email → `deleted+<id>@invalid`, clear rollNo/profile/providers, keep content attribution as "Former user"). |
| Backups | Production: Atlas cloud backups (continuous/snapshot per tier), 7-day point-in-time minimum. Without a backup tier: nightly `mongodump --gzip` by a scheduled job to a **private, encrypted** bucket, 7 daily + 4 weekly copies. **Restore drill** documented in `database/RESTORE.md` and practised once before 20 Nov. |
| Audit | Admin and auth actions are written to `auditLogs` by Backend; your job is to make the collection append-only and indexed. |

---

## 10. Tests (Vitest)

Test DB: `mongodb-memory-server` **replica set** mode by default; if `MONGO_TEST_URI` is set, use it instead (CI uses a MongoDB service container).

| Suite | What it proves |
|---|---|
| `models/*.test.ts` | Required fields, enums from `@scc/shared`, max lengths, `audienceKeys` computation, `select:false` fields absent from `toJSON` |
| `queries/visibility.test.ts` | A CSE-3 student never receives ECE-only or year-2-only items; staff see all published; drafts/deleted never leak |
| `queries/paginate.test.ts` | Stable ordering with equal timestamps, no duplicates/gaps across pages, garbage cursor → validation error |
| `queries/rsvp.concurrency.test.ts` | 200 parallel RSVPs on capacity 50 → exactly 50 going, 150 waitlisted; cancel promotes the oldest |
| `indexes/explain.test.ts` | For every Q1–Q15, `explain("executionStats")` shows `IXSCAN` (no `COLLSCAN`) and `totalDocsExamined ≤ 2 × nReturned + 50` on seeded data |
| `audit/append-only.test.ts` | Update/delete on `auditLogs` throws |
| `migrations/*.test.ts` | up → down → up leaves the same state |
| `seed/seed.test.ts` | Seed is idempotent and refuses production |

Coverage target for `database`: **≥ 85% lines**.

---

## 11. Package layout
```
database/
  package.json  tsconfig.json  RESTORE.md  CHANGELOG.md
  src/
    index.ts
    connect.ts  env.ts  crypto.ts  transaction.ts
    plugins/base.ts
    models/  user.ts session.ts auth-token.ts announcement.ts event.ts event-rsvp.ts resource.ts
             opening.ts opening-tracking.ts bookmark.ts notification.ts report.ts audit-log.ts import-job.ts
    mappers/ user.ts content.ts session.ts notification.ts audit.ts
    queries/ audience.ts visibility.ts paginate.ts search.ts feed.ts rsvp.ts
    migrate.ts  sync-indexes.ts
  migrations/0001-init-collections.ts 0002-indexes.ts ...
  search-indexes/*.json
  seed/ demo.ts load.ts fixtures/
  test/ (mirrors src)
```

### 11.1 Example model (reference quality bar)
```ts
// database/src/models/announcement.ts
import { Schema, model, type InferSchemaType } from "mongoose";
import { DEPARTMENTS, YEARS, LIMITS } from "@scc/shared";
import { basePlugin } from "../plugins/base.js";
import { audienceToKeys } from "../queries/audience.js";

const audienceSchema = new Schema({
  departments: { type: [String], enum: [...DEPARTMENTS, "ALL"], required: true,
                 validate: (v: string[]) => v.length >= 1 && v.length <= 30 },
  years: { type: [Schema.Types.Mixed], required: true,
           validate: (v: unknown[]) => v.length >= 1 && v.every((y) => y === "ALL" || YEARS.includes(y as never)) },
}, { _id: false });

const announcementSchema = new Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: LIMITS.titleMax },
  body: { type: String, required: true, maxlength: LIMITS.bodyMax },
  audience: { type: audienceSchema, required: true },
  audienceKeys: { type: [String], required: true, select: false },
  status: { type: String, enum: ["draft", "scheduled", "published", "archived"], required: true },
  publishAt: { type: Date },
  expiresAt: { type: Date, default: null },
  pinned: { type: Boolean, default: false },
  authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  moderation: { state: { type: String, enum: ["none", "flagged", "removed"], default: "none" },
                reason: String, by: Schema.Types.ObjectId, at: Date },
  deletedAt: { type: Date, default: null },
}, { timestamps: true, collection: "announcements" });

announcementSchema.plugin(basePlugin);

// Index keys are derived, never sent by clients.
announcementSchema.pre("validate", function () {
  this.audienceKeys = audienceToKeys(this.audience as never);
  if (this.status === "published" && !this.publishAt) this.publishAt = new Date();
});

announcementSchema.index({ status: 1, audienceKeys: 1, publishAt: -1, _id: -1 },
  { partialFilterExpression: { deletedAt: null }, name: "feed" });
announcementSchema.index({ authorId: 1, createdAt: -1 }, { name: "by_author" });
announcementSchema.index({ status: 1, publishAt: 1 }, { name: "scheduler" });
announcementSchema.index({ expiresAt: 1 }, { partialFilterExpression: { status: "published" }, name: "expiry" });
announcementSchema.index({ title: "text", body: "text" }, { weights: { title: 3, body: 1 }, name: "text_fallback" });

export type AnnouncementDoc = InferSchemaType<typeof announcementSchema>;
export const Announcement = model("Announcement", announcementSchema);
```
> Partial indexes with `deletedAt: null`: MongoDB partial filters support equality to `null` only in recent versions — verify on the target MongoDB version; if unsupported, use `{ deletedAt: { $exists: false } }` and unset the field instead of setting `null`. Document whichever you choose in an ADR.

---

## 12. Definition of Done (Database)
- [ ] Field names/enums match `@scc/shared` exactly; DTO mappers covered by tests.
- [ ] Every query in §5 has an index and passes the explain test.
- [ ] Migrations idempotent and reversible; `db:sync-indexes --dry-run` output reviewed in the PR.
- [ ] Seed runs locally in < 60 s and refuses production.
- [ ] No sensitive field leaks in `toJSON`; append-only audit enforced.
- [ ] `RESTORE.md` written and the drill done once.
- [ ] This file updated for any schema/index change.
