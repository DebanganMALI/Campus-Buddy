// A fake backend that runs inside the browser (MSW), following AGENTS.md §5.8.
// It checks permissions the way the real server must (403 / 404), so the UI is tested
// against honest failures. Only loaded in "mock" mode; never in a production build.
import { delay, http, HttpResponse } from "msw";
import {
  DEPARTMENTS,
  ERROR_MESSAGES,
  ERROR_STATUS,
  LIMITS,
  hasPermission,
  loginBody,
  permissionsFor,
  registerBody,
  type ErrorCode,
  type Permission,
} from "@scc/shared";
import type {
  AnnouncementDTO,
  AudienceDTO,
  AuthorRef,
  ContentType,
  EventDTO,
  OpeningDTO,
  ResourceDTO,
} from "../api/types";
import { MOCK_LOCKED_EMAIL, MOCK_PASSWORD, type MockUser } from "./data";
import { db, newId, save } from "./db";

/* ---------- helpers ---------- */
const SESSION_KEY = "scc-mock-session"; // mock-only: the real backend uses httpOnly cookies
let csrfToken: string | null = null;
const newCsrf = () => (csrfToken = `mock-csrf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const csrfOk = (r: Request) => csrfToken !== null && r.headers.get("x-csrf-token") === csrfToken;

type Issue = { path: string; message: string };
function apiError(code: ErrorCode, extra: { issues?: Issue[]; retryAfter?: number; message?: string } = {}) {
  return HttpResponse.json(
    {
      code,
      message: extra.message ?? ERROR_MESSAGES[code],
      requestId: `req_mock_${Date.now().toString(36)}`,
      ...(extra.issues ? { issues: extra.issues } : {}),
    },
    { status: ERROR_STATUS[code], headers: extra.retryAfter ? { "Retry-After": String(extra.retryAfter) } : undefined },
  );
}

function sessionUser(): MockUser | null {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return db.users.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}
function setSession(id: string | null) {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Authentication step that every protected route runs first. */
function requireUser(): MockUser | Response {
  const user = sessionUser();
  if (!user) return apiError("UNAUTHENTICATED");
  // Suspension takes effect on the very next request
  if (user.status === "suspended") {
    setSession(null);
    return apiError("SESSION_REVOKED");
  }
  return user;
}
const can = (u: MockUser, p: Permission) => hasPermission(u.role, p);

/** Students only see content addressed to their department + year (or "ALL"). Staff see everything. */
function visibleTo(u: MockUser, audience: AudienceDTO): boolean {
  if (u.role !== "student") return true;
  const deptOk = (audience.departments as string[]).includes("ALL") || (audience.departments as string[]).includes(u.department);
  const yearOk = (audience.years as Array<number | string>).includes("ALL") || (u.year !== undefined && (audience.years as number[]).includes(u.year));
  return deptOk && yearOk;
}

const ref = (u: MockUser): AuthorRef => ({ id: u.id, name: u.name, role: u.role });
const isBookmarked = (u: MockUser, t: ContentType, id: string) =>
  db.bookmarks.some((b) => b.userId === u.id && b.itemType === t && b.itemId === id);
const alive = (id: string) => !db.deleted.includes(id);

function paginate<T>(rows: T[], cursor: string | null, limit: number) {
  const start = cursor ? Number(atob(cursor)) || 0 : 0;
  const size = Math.min(Math.max(limit || LIMITS.pageSizeDefault, 1), LIMITS.pageSizeMax);
  const items = rows.slice(start, start + size);
  const next = start + size < rows.length ? btoa(String(start + size)) : null;
  return { items, nextCursor: next };
}
const text = (s: string | undefined) => (s ?? "").toLowerCase();
const matches = (q: string, ...fields: Array<string | undefined>) => {
  const needle = q.trim().toLowerCase();
  return !needle || fields.some((f) => text(f).includes(needle));
};

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/* ---------- validation (mirrors what the server must check) ---------- */
function validateAudience(a: unknown, issues: Issue[]): AudienceDTO | null {
  const aud = a as Partial<AudienceDTO> | undefined;
  const depts = Array.isArray(aud?.departments) ? (aud!.departments as string[]) : [];
  const years = Array.isArray(aud?.years) ? (aud!.years as Array<number | string>) : [];
  if (depts.length === 0 || !depts.every((d) => d === "ALL" || (DEPARTMENTS as readonly string[]).includes(d)))
    issues.push({ path: "audience.departments", message: "Choose at least one department." });
  if (years.length === 0 || !years.every((y) => y === "ALL" || [1, 2, 3, 4, 5].includes(Number(y))))
    issues.push({ path: "audience.years", message: "Choose at least one year." });
  return issues.length ? null : (aud as AudienceDTO);
}
function str(b: Record<string, unknown>, key: string, min: number, max: number, issues: Issue[], label: string) {
  const v = typeof b[key] === "string" ? (b[key] as string).trim() : "";
  if (v.length < min) issues.push({ path: key, message: min <= 1 ? `${label} is required.` : `${label} needs at least ${min} characters.` });
  else if (v.length > max) issues.push({ path: key, message: `${label} can be at most ${max} characters.` });
  return v;
}

/* ---------- DTO builders ---------- */
const annDto = (u: MockUser, a: (typeof db.announcements)[number]): AnnouncementDTO => ({ ...a, bookmarked: isBookmarked(u, "announcement", a.id) });
const evtDto = (u: MockUser, e: (typeof db.events)[number]): EventDTO => ({ ...e, bookmarked: isBookmarked(u, "event", e.id) });
const resDto = (u: MockUser, r: (typeof db.resources)[number]): ResourceDTO => ({ ...r, bookmarked: isBookmarked(u, "resource", r.id) });
const opnDto = (u: MockUser, o: (typeof db.openings)[number]): OpeningDTO => ({ ...o, bookmarked: isBookmarked(u, "opening", o.id) });

const visibleAnnouncements = (u: MockUser) =>
  db.announcements
    .filter((a) => alive(a.id) && (a.status === "published" || a.author.id === u.id) && visibleTo(u, a.audience))
    .sort((x, y) => Number(y.pinned) - Number(x.pinned) || (y.publishAt ?? y.createdAt).localeCompare(x.publishAt ?? x.createdAt));
const visibleEvents = (u: MockUser) =>
  db.events
    .filter((e) => alive(e.id) && (e.status === "published" || e.author.id === u.id) && visibleTo(u, e.audience))
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt));
const visibleResources = (u: MockUser) =>
  db.resources
    .filter((r) => alive(r.id) && (r.status === "published" || r.uploadedBy.id === u.id))
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
const visibleOpenings = (u: MockUser) =>
  db.openings
    .filter((o) => alive(o.id) && visibleTo(u, o.eligibility))
    .sort((x, y) => x.closesAt.localeCompare(y.closesAt));

/** Own-or-any rule from shared/permissions.ts */
function mayChange(u: MockUser, kind: "announcement" | "event" | "resource", action: "update" | "delete", ownerId: string) {
  return can(u, `${kind}:${action}:any` as Permission) || (can(u, `${kind}:${action}:own` as Permission) && ownerId === u.id);
}

/* ---------- tiny sample files for downloads ---------- */
function samplePdf(title: string): Uint8Array {
  const safe = title.replace(/[()\\]/g, "");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 20 Tf 60 760 Td (${safe}) Tj 0 -32 Td /F1 12 Tf (Sample file - Smart Campus Companion mock data.) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

/* ---------- handlers ---------- */
export const handlers = [
  /* Auth */
  http.get("/api/auth/csrf", () => {
    const token = newCsrf();
    return HttpResponse.json({ csrfToken: token }, { headers: { "X-CSRF-Token": token } });
  }),

  http.get("/api/auth/me", async () => {
    await delay(150);
    const u = requireUser();
    if (u instanceof Response) return u;
    return HttpResponse.json({
      user: { ...u, phone: undefined, bio: undefined },
      permissions: permissionsFor(u.role),
      mfa: { enabled: false, required: false },
      feed: { lastSeenAt: null },
    });
  }),

  http.post("/api/auth/login", async ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    await delay(450);
    const parsed = loginBody.safeParse(await readJson(request));
    if (!parsed.success)
      return apiError("VALIDATION_ERROR", { issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })) });
    const { email, password } = parsed.data;
    if (email === MOCK_LOCKED_EMAIL) return apiError("ACCOUNT_LOCKED", { retryAfter: 30 });
    const user = db.users.find((u) => u.email === email);
    if (!user || password !== MOCK_PASSWORD) return apiError("INVALID_CREDENTIALS");
    // Suspension is only revealed after a correct password (AGENTS.md §5.4)
    if (user.status === "suspended") return apiError("ACCOUNT_SUSPENDED");
    setSession(user.id);
    const token = newCsrf();
    return HttpResponse.json({ status: "OK", user: { ...user, phone: undefined, bio: undefined } }, { headers: { "X-CSRF-Token": token } });
  }),

  http.post("/api/auth/register", async ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    await delay(500);
    const parsed = registerBody.safeParse(await readJson(request));
    if (!parsed.success)
      return apiError("VALIDATION_ERROR", { issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })) });
    const b = parsed.data;
    // Same reply whether or not the email exists: never reveal accounts
    if (!db.users.some((u) => u.email === b.email)) {
      db.users.push({
        id: newId("f1"), name: b.name, email: b.email, rollNo: b.rollNo, role: "student", department: b.department, year: b.year,
        // The real server sends a verification email first; the mock skips that step
        status: "active", emailVerified: true, mfaEnabled: false, createdAt: new Date().toISOString(),
      });
      save();
    }
    return HttpResponse.json({ message: "If this email can be registered, we've sent a verification link to it." }, { status: 202 });
  }),

  http.post("/api/auth/logout", ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    setSession(null);
    const token = newCsrf();
    return new HttpResponse(null, { status: 204, headers: { "X-CSRF-Token": token } });
  }),

  /* Announcements */
  http.get("/api/announcements", async ({ request }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(250);
    const sp = new URL(request.url).searchParams;
    const q = sp.get("q") ?? "";
    const dept = sp.get("department");
    const pinned = sp.get("pinned");
    const rows = visibleAnnouncements(u).filter(
      (a) =>
        matches(q, a.title, a.body) &&
        (!dept || (a.audience.departments as string[]).includes(dept) || (a.audience.departments as string[]).includes("ALL")) &&
        (pinned === null || String(a.pinned) === pinned),
    );
    const page = paginate(rows, sp.get("cursor"), Number(sp.get("limit")));
    return HttpResponse.json({ items: page.items.map((a) => annDto(u, a)), nextCursor: page.nextCursor });
  }),
  http.get("/api/announcements/:id", async ({ params }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(150);
    const a = visibleAnnouncements(u).find((x) => x.id === params.id);
    return a ? HttpResponse.json(annDto(u, a)) : apiError("NOT_FOUND");
  }),
  http.post("/api/announcements", async ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    if (!can(u, "announcement:create")) return apiError("FORBIDDEN");
    await delay(400);
    const b = (await readJson(request)) ?? {};
    const issues: Issue[] = [];
    const title = str(b, "title", 3, LIMITS.titleMax, issues, "Title");
    const body = str(b, "body", 1, LIMITS.bodyMax, issues, "Message");
    const audience = validateAudience(b.audience, issues);
    if (issues.length || !audience) return apiError("VALIDATION_ERROR", { issues });
    const now = new Date().toISOString();
    const status = b.status === "draft" ? "draft" : "published";
    const row = {
      id: newId("a2"), title, body, audience, status, publishAt: status === "published" ? now : undefined,
      expiresAt: typeof b.expiresAt === "string" && b.expiresAt ? b.expiresAt : null, pinned: b.pinned === true,
      author: ref(u), createdAt: now, updatedAt: now,
    } as (typeof db.announcements)[number];
    db.announcements.push(row);
    save();
    return HttpResponse.json(annDto(u, row), { status: 201 });
  }),
  http.patch("/api/announcements/:id", async ({ request, params }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    const a = visibleAnnouncements(u).find((x) => x.id === params.id);
    if (!a) return apiError("NOT_FOUND");
    if (!mayChange(u, "announcement", "update", a.author.id)) return apiError("FORBIDDEN");
    await delay(400);
    const b = (await readJson(request)) ?? {};
    const issues: Issue[] = [];
    const next = { ...a };
    if ("title" in b) next.title = str(b, "title", 3, LIMITS.titleMax, issues, "Title");
    if ("body" in b) next.body = str(b, "body", 1, LIMITS.bodyMax, issues, "Message");
    if ("audience" in b) next.audience = validateAudience(b.audience, issues) ?? a.audience;
    if ("pinned" in b) next.pinned = b.pinned === true;
    if ("status" in b) next.status = b.status === "draft" ? "draft" : "published";
    if (issues.length) return apiError("VALIDATION_ERROR", { issues });
    next.updatedAt = new Date().toISOString();
    if (next.status === "published" && !next.publishAt) next.publishAt = next.updatedAt;
    Object.assign(a, next);
    save();
    return HttpResponse.json(annDto(u, a));
  }),
  http.delete("/api/announcements/:id", async ({ request, params }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    const a = visibleAnnouncements(u).find((x) => x.id === params.id);
    if (!a) return apiError("NOT_FOUND");
    if (!mayChange(u, "announcement", "delete", a.author.id)) return apiError("FORBIDDEN");
    await delay(300);
    db.deleted.push(a.id); // soft delete, like the real data layer
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  /* Events */
  http.get("/api/events", async ({ request }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(250);
    const sp = new URL(request.url).searchParams;
    const q = sp.get("q") ?? "";
    const rows = visibleEvents(u).filter((e) => matches(q, e.title, e.description, e.venue));
    const page = paginate(rows, sp.get("cursor"), Number(sp.get("limit")) || LIMITS.pageSizeMax);
    return HttpResponse.json({ items: page.items.map((e) => evtDto(u, e)), nextCursor: page.nextCursor });
  }),
  http.get("/api/events/:id", async ({ params }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(150);
    const e = visibleEvents(u).find((x) => x.id === params.id);
    return e ? HttpResponse.json(evtDto(u, e)) : apiError("NOT_FOUND");
  }),
  http.post("/api/events", async ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    if (!can(u, "event:create")) return apiError("FORBIDDEN");
    await delay(400);
    const b = (await readJson(request)) ?? {};
    const issues: Issue[] = [];
    const title = str(b, "title", 3, LIMITS.titleMax, issues, "Title");
    const description = str(b, "description", 1, LIMITS.bodyMax, issues, "Description");
    const venue = str(b, "venue", 2, 140, issues, "Venue");
    const startsAt = typeof b.startsAt === "string" ? b.startsAt : "";
    const endsAt = typeof b.endsAt === "string" ? b.endsAt : "";
    if (!startsAt || Number.isNaN(Date.parse(startsAt))) issues.push({ path: "startsAt", message: "Choose a start time." });
    if (!endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) issues.push({ path: "endsAt", message: "End time must be after the start time." });
    const audience = validateAudience(b.audience, issues);
    if (issues.length || !audience) return apiError("VALIDATION_ERROR", { issues });
    const now = new Date().toISOString();
    const capacity = typeof b.capacity === "number" && b.capacity > 0 ? b.capacity : null;
    const row = {
      id: newId("e2"), title, description, venue, startsAt, endsAt, capacity, rsvpCount: 0, audience,
      status: b.status === "draft" ? "draft" : "published", author: ref(u), createdAt: now, updatedAt: now,
    } as (typeof db.events)[number];
    db.events.push(row);
    save();
    return HttpResponse.json(evtDto(u, row), { status: 201 });
  }),
  http.patch("/api/events/:id", async ({ request, params }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    const e = visibleEvents(u).find((x) => x.id === params.id);
    if (!e) return apiError("NOT_FOUND");
    if (!mayChange(u, "event", "update", e.author.id)) return apiError("FORBIDDEN");
    await delay(400);
    const b = (await readJson(request)) ?? {};
    const issues: Issue[] = [];
    const next = { ...e };
    if ("title" in b) next.title = str(b, "title", 3, LIMITS.titleMax, issues, "Title");
    if ("description" in b) next.description = str(b, "description", 1, LIMITS.bodyMax, issues, "Description");
    if ("venue" in b) next.venue = str(b, "venue", 2, 140, issues, "Venue");
    if (typeof b.startsAt === "string") next.startsAt = b.startsAt;
    if (typeof b.endsAt === "string") next.endsAt = b.endsAt;
    if (Date.parse(next.endsAt) <= Date.parse(next.startsAt)) issues.push({ path: "endsAt", message: "End time must be after the start time." });
    if ("capacity" in b) next.capacity = typeof b.capacity === "number" && b.capacity > 0 ? b.capacity : null;
    if ("audience" in b) next.audience = validateAudience(b.audience, issues) ?? e.audience;
    if (issues.length) return apiError("VALIDATION_ERROR", { issues });
    next.updatedAt = new Date().toISOString();
    Object.assign(e, next);
    save();
    return HttpResponse.json(evtDto(u, e));
  }),
  http.delete("/api/events/:id", async ({ request, params }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    const e = visibleEvents(u).find((x) => x.id === params.id);
    if (!e) return apiError("NOT_FOUND");
    if (!mayChange(u, "event", "delete", e.author.id)) return apiError("FORBIDDEN");
    await delay(300);
    db.deleted.push(e.id);
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  /* Resources */
  http.get("/api/resources", async ({ request }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(250);
    const sp = new URL(request.url).searchParams;
    const q = sp.get("q") ?? "";
    const f = { department: sp.get("department"), year: sp.get("year"), semester: sp.get("semester"), subject: sp.get("subject") };
    const rows = visibleResources(u).filter(
      (r) =>
        r.status === "published" &&
        (!f.department || r.department === f.department) &&
        (!f.year || String(r.year) === f.year) &&
        (!f.semester || String(r.semester) === f.semester) &&
        (!f.subject || r.subject.toLowerCase() === f.subject.toLowerCase()) &&
        matches(q, r.title, r.subject, r.description),
    );
    const page = paginate(rows, sp.get("cursor"), Number(sp.get("limit")) || LIMITS.pageSizeMax);
    return HttpResponse.json({ items: page.items.map((r) => resDto(u, r)), nextCursor: page.nextCursor });
  }),
  http.get("/api/resources/:id", async ({ params }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    const r = visibleResources(u).find((x) => x.id === params.id);
    if (!r) return apiError("NOT_FOUND");
    // The "virus scan" finishes on the next status check (dev scan stub)
    if (r.status === "pending_scan") {
      r.status = can(u, "resource:create") ? "published" : "pending_review";
      save();
    }
    return HttpResponse.json(resDto(u, r));
  }),
  http.post("/api/resources/upload-url", async ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    if (!can(u, "resource:create") && !can(u, "resource:submit")) return apiError("FORBIDDEN");
    await delay(300);
    const b = (await readJson(request)) ?? {};
    const issues: Issue[] = [];
    const title = str(b, "title", 3, LIMITS.titleMax, issues, "Title");
    const subject = str(b, "subject", 2, 80, issues, "Subject");
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (!allowed.includes(String(b.mimeType))) return apiError("UNSUPPORTED_FILE_TYPE");
    if (typeof b.size !== "number" || b.size <= 0 || b.size > LIMITS.fileMaxBytes) return apiError("PAYLOAD_TOO_LARGE");
    if (!(DEPARTMENTS as readonly string[]).includes(String(b.department))) issues.push({ path: "department", message: "Choose a department." });
    if (![1, 2, 3, 4, 5].includes(Number(b.year))) issues.push({ path: "year", message: "Choose a year." });
    if (!(Number(b.semester) >= 1 && Number(b.semester) <= 10)) issues.push({ path: "semester", message: "Choose a semester." });
    if (issues.length) return apiError("VALIDATION_ERROR", { issues });
    const now = new Date().toISOString();
    const id = newId("c2");
    db.resources.push({
      id, title, description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : undefined,
      department: b.department as ResourceDTO["department"], year: Number(b.year) as ResourceDTO["year"], semester: Number(b.semester), subject,
      file: { name: String(b.fileName).slice(0, 200), mimeType: b.mimeType as ResourceDTO["file"]["mimeType"], size: b.size },
      status: "awaiting_upload", version: 1, uploadedBy: ref(u), createdAt: now, updatedAt: now,
    });
    save();
    return HttpResponse.json(
      { resourceId: id, uploadUrl: `/mock-storage/${id}`, headers: { "Content-Type": String(b.mimeType) }, expiresAt: new Date(Date.now() + 600_000).toISOString() },
      { status: 201 },
    );
  }),
  // Stands in for the object-storage host (no cookies, no CSRF, like a real presigned URL)
  http.put("/mock-storage/:id", async () => {
    await delay(600);
    return new HttpResponse(null, { status: 200 });
  }),
  http.post("/api/resources/:id/complete", async ({ request, params }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    const r = db.resources.find((x) => x.id === params.id && x.uploadedBy.id === u.id);
    if (!r) return apiError("NOT_FOUND");
    r.status = "pending_scan";
    save();
    return HttpResponse.json({ status: "pending_scan" }, { status: 202 });
  }),
  http.get("/api/resources/:id/download", async ({ params }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    const r = visibleResources(u).find((x) => x.id === params.id && x.status === "published");
    if (!r) return apiError("NOT_FOUND");
    return HttpResponse.json({ url: `/mock-files/${r.id}`, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  }),
  http.get("/mock-files/:id", ({ params }) => {
    const r = db.resources.find((x) => x.id === params.id);
    if (!r) return new HttpResponse(null, { status: 404 });
    const base = r.file.name.replace(/\.[a-z]+$/, "");
    if (r.file.mimeType === "application/pdf") {
      return new HttpResponse(samplePdf(r.title), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` },
      });
    }
    // DOCX/PPTX can't be faked simply: send a clearly labelled text placeholder instead
    return new HttpResponse(`Sample placeholder for "${r.title}" (${r.file.name}).\nMock data - Smart Campus Companion.\n`, {
      headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="${base}-placeholder.txt"` },
    });
  }),
  http.delete("/api/resources/:id", async ({ request, params }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    const r = visibleResources(u).find((x) => x.id === params.id);
    if (!r) return apiError("NOT_FOUND");
    if (!mayChange(u, "resource", "delete", r.uploadedBy.id)) return apiError("FORBIDDEN");
    db.deleted.push(r.id);
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  /* Openings */
  http.get("/api/openings", async ({ request }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(250);
    const sp = new URL(request.url).searchParams;
    const q = sp.get("q") ?? "";
    const type = sp.get("type");
    const within = Number(sp.get("closingWithinDays")) || 0;
    const now = Date.now();
    const rows = visibleOpenings(u).filter(
      (o) =>
        Date.parse(o.closesAt) > now &&
        (!type || o.type === type) &&
        (!within || Date.parse(o.closesAt) - now <= within * 86_400_000) &&
        matches(q, o.title, o.company, o.description),
    );
    const page = paginate(rows, sp.get("cursor"), Number(sp.get("limit")) || LIMITS.pageSizeMax);
    return HttpResponse.json({ items: page.items.map((o) => opnDto(u, o)), nextCursor: page.nextCursor });
  }),
  http.get("/api/openings/:id", async ({ params }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(150);
    const o = visibleOpenings(u).find((x) => x.id === params.id);
    return o ? HttpResponse.json(opnDto(u, o)) : apiError("NOT_FOUND");
  }),

  /* Search */
  http.get("/api/search", async ({ request }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(300);
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") ?? "").trim();
    if (q.length < 2 || q.length > 100)
      return apiError("VALIDATION_ERROR", { issues: [{ path: "q", message: "Type at least 2 characters." }] });
    const limit = Math.min(Number(sp.get("limit")) || 5, 20);
    return HttpResponse.json({
      announcements: visibleAnnouncements(u).filter((a) => a.status === "published" && matches(q, a.title, a.body)).slice(0, limit).map((a) => annDto(u, a)),
      events: visibleEvents(u).filter((e) => e.status === "published" && matches(q, e.title, e.description, e.venue)).slice(0, limit).map((e) => evtDto(u, e)),
      resources: visibleResources(u).filter((r) => r.status === "published" && matches(q, r.title, r.subject)).slice(0, limit).map((r) => resDto(u, r)),
      openings: visibleOpenings(u).filter((o) => matches(q, o.title, o.company, o.description)).slice(0, limit).map((o) => opnDto(u, o)),
    });
  }),

  /* Bookmarks (own only) */
  http.get("/api/bookmarks", async ({ request }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(200);
    const type = new URL(request.url).searchParams.get("type");
    const items = db.bookmarks
      .filter((b) => b.userId === u.id && (!type || b.itemType === type))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .map((b) => {
        const base = { itemType: b.itemType, itemId: b.itemId, createdAt: b.createdAt };
        if (b.itemType === "announcement") { const a = visibleAnnouncements(u).find((x) => x.id === b.itemId); return a ? { ...base, item: annDto(u, a) } : null; }
        if (b.itemType === "event") { const e = visibleEvents(u).find((x) => x.id === b.itemId); return e ? { ...base, item: evtDto(u, e) } : null; }
        if (b.itemType === "resource") { const r = visibleResources(u).find((x) => x.id === b.itemId); return r ? { ...base, item: resDto(u, r) } : null; }
        const o = visibleOpenings(u).find((x) => x.id === b.itemId);
        return o ? { ...base, item: opnDto(u, o) } : null;
      })
      .filter(Boolean);
    return HttpResponse.json({ items, nextCursor: null });
  }),
  http.post("/api/bookmarks", async ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    const b = (await readJson(request)) ?? {};
    const itemType = b.itemType as ContentType;
    const itemId = String(b.itemId ?? "");
    if (!["announcement", "event", "resource", "opening"].includes(itemType)) return apiError("VALIDATION_ERROR", { issues: [{ path: "itemType", message: "Unknown type." }] });
    if (isBookmarked(u, itemType, itemId)) return apiError("CONFLICT");
    db.bookmarks.push({ userId: u.id, itemType, itemId, createdAt: new Date().toISOString() });
    save();
    return HttpResponse.json({ itemType, itemId }, { status: 201 });
  }),
  http.delete("/api/bookmarks/:type/:id", ({ request, params }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    db.bookmarks = db.bookmarks.filter((b) => !(b.userId === u.id && b.itemType === params.type && b.itemId === params.id));
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  /* Profile (own only — there is no :id, so editing someone else is impossible by design) */
  http.get("/api/profile", async () => {
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(150);
    return HttpResponse.json(u);
  }),
  http.patch("/api/profile", async ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    await delay(350);
    const b = (await readJson(request)) ?? {};
    const allowed = ["name", "phone", "bio"];
    const unknown = Object.keys(b).filter((k) => !allowed.includes(k));
    // Role, department, email, roll no. are server-owned: unknown fields are rejected (AGENTS.md §5.2)
    if (unknown.length) return apiError("VALIDATION_ERROR", { issues: unknown.map((k) => ({ path: k, message: "This field can't be changed here." })) });
    const issues: Issue[] = [];
    if ("name" in b) u.name = str(b, "name", LIMITS.nameMin, LIMITS.nameMax, issues, "Name");
    if ("phone" in b) {
      const p = String(b.phone ?? "").trim();
      if (p && !/^\+?[0-9 -]{8,16}$/.test(p)) issues.push({ path: "phone", message: "Enter a valid phone number." });
      else u.phone = p || undefined;
    }
    if ("bio" in b) {
      const bio = String(b.bio ?? "").trim();
      if (bio.length > 300) issues.push({ path: "bio", message: "Keep your bio under 300 characters." });
      else u.bio = bio || undefined;
    }
    if (issues.length) return apiError("VALIDATION_ERROR", { issues });
    save();
    return HttpResponse.json(u);
  }),

  /* Admin */
  http.get("/api/admin/users", async ({ request }) => {
    const u = requireUser();
    if (u instanceof Response) return u;
    if (!can(u, "user:read")) return apiError("FORBIDDEN");
    await delay(250);
    const sp = new URL(request.url).searchParams;
    const q = sp.get("q") ?? "";
    const role = sp.get("role");
    const status = sp.get("status");
    const rows = db.users.filter((x) => matches(q, x.name, x.email, x.rollNo) && (!role || x.role === role) && (!status || x.status === status));
    return HttpResponse.json({ items: rows.map(({ phone: _p, bio: _b, ...rest }) => rest), nextCursor: null });
  }),
  http.patch("/api/admin/users/:id/status", async ({ request, params }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    const u = requireUser();
    if (u instanceof Response) return u;
    if (!can(u, "user:suspend")) return apiError("FORBIDDEN");
    const target = db.users.find((x) => x.id === params.id);
    if (!target) return apiError("NOT_FOUND");
    if (target.id === u.id) return apiError("CONFLICT", { message: "You can't change your own account status." });
    await delay(400);
    const b = (await readJson(request)) ?? {};
    if (b.status !== "active" && b.status !== "suspended") return apiError("VALIDATION_ERROR", { issues: [{ path: "status", message: "Unknown status." }] });
    const reason = typeof b.reason === "string" ? b.reason.trim() : "";
    if (b.status === "suspended" && reason.length < 3) return apiError("VALIDATION_ERROR", { issues: [{ path: "reason", message: "Give a short reason." }] });
    target.status = b.status;
    save();
    const { phone: _p, bio: _b, ...rest } = target;
    return HttpResponse.json(rest);
  }),
];
