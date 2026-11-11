import type { Types } from "mongoose";
import type { Department, Role, Year } from "@scc/shared";
import {
  Announcement,
  AuditLog,
  AuthToken,
  Bookmark,
  Event,
  EventRsvp,
  Opening,
  OpeningTracking,
  Resource,
  Session,
  User,
} from "@scc/db";
import { hashPassword } from "../lib/password.js";

// Demo-data seeding logic, shared by the CLI (seed.ts) and the integration test.
// Idempotent: a user is created only if its email is new, and each content
// collection is seeded only while it is empty, so re-running never duplicates or
// overwrites real data. All people, companies and links are fictional.

let log: (msg: string) => void = (msg) => console.log(msg);

// Campus times are India time (UTC+05:30), whatever timezone the server runs in.
const IST_OFFSET_MS = 330 * 60_000;
/** `days` from today, at hour:minute India time. */
const atIst = (days: number, hour: number, minute = 0): Date => {
  const ist = new Date(Date.now() + IST_OFFSET_MS); // today's date as seen in India
  const asUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days, hour, minute);
  return new Date(asUtc - IST_OFFSET_MS);
};

interface SeedUser {
  key: string;
  email: string;
  name: string;
  role: Role;
  department: Department;
  year?: Year;
}

export const USERS: readonly SeedUser[] = [
  { key: "admin", email: "demo.admin@iem.edu.in", name: "Demo Admin", role: "admin", department: "CSE" },
  { key: "faculty", email: "demo.faculty@iem.edu.in", name: "Demo Faculty", role: "faculty", department: "CSE" },
  { key: "moderator", email: "demo.moderator@iem.edu.in", name: "Demo Moderator", role: "moderator", department: "CSE" },
  { key: "placement", email: "demo.placement@iem.edu.in", name: "Demo Placement Officer", role: "placement_officer", department: "CSE" },
  { key: "student", email: "demo.student@iem.edu.in", name: "Demo Student CSE", role: "student", department: "CSE", year: 3 },
  { key: "studentEce", email: "demo.ece@iem.edu.in", name: "Demo Student ECE", role: "student", department: "ECE", year: 2 },
  { key: "studentIt", email: "demo.it@iem.edu.in", name: "Demo Student IT", role: "student", department: "IT", year: 1 },
];

async function ensureIndexes(): Promise<void> {
  // Production runs with autoIndex off, so create every declared index here.
  const models = [User, Session, AuthToken, AuditLog, Announcement, Event, EventRsvp, Resource, Opening, OpeningTracking, Bookmark];
  for (const m of models) await m.createIndexes();
  log(`indexes: ensured on ${models.length} collections`);
}

async function seedUsers(password: string): Promise<Map<string, Types.ObjectId>> {
  const ids = new Map<string, Types.ObjectId>();
  let created = 0;
  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email }).select("_id").lean<{ _id: Types.ObjectId } | null>();
    if (existing) {
      ids.set(u.key, existing._id);
      continue;
    }
    const doc = await User.create({
      email: u.email,
      name: u.name,
      role: u.role,
      department: u.department,
      ...(u.year ? { year: u.year } : {}),
      status: "active",
      emailVerified: true,
      passwordHash: await hashPassword(password),
    });
    ids.set(u.key, doc._id);
    created += 1;
  }
  log(`users: +${created} (${USERS.length - created} already existed)`);
  return ids;
}

async function seedContent(id: (key: string) => Types.ObjectId): Promise<{ firstAnnouncement?: Types.ObjectId; firstOpening?: Types.ObjectId }> {
  const out: { firstAnnouncement?: Types.ObjectId; firstOpening?: Types.ObjectId } = {};

  if ((await Announcement.estimatedDocumentCount()) === 0) {
    const docs = await Announcement.create([
      {
        title: "Mid-semester exam schedule released",
        body: "The mid-semester timetable for all CSE years is now available on the notice board and in the department office. Check your slots and report clashes by Friday.",
        audience: { departments: ["CSE"], years: ["ALL"] },
        status: "published",
        pinned: true,
        authorId: id("faculty"),
      },
      {
        title: "Campus hackathon: TSSD Build Night",
        body: "A 12-hour build night open to every department and year. Form teams of up to four and register at the student activity centre.",
        audience: { departments: ["ALL"], years: ["ALL"] },
        status: "published",
        authorId: id("admin"),
      },
      {
        title: "ECE lab timings changed for this week",
        body: "Second-year ECE practical sessions move to the afternoon slot (2 PM to 5 PM) for this week only.",
        audience: { departments: ["ECE"], years: [2] },
        status: "published",
        authorId: id("faculty"),
      },
      {
        title: "Library extended hours during exams",
        body: "The central library stays open until 10 PM on weekdays for the next three weeks. Carry your ID card.",
        audience: { departments: ["ALL"], years: ["ALL"] },
        status: "published",
        authorId: id("admin"),
      },
      {
        title: "Guest lecture: secure coding with OWASP",
        body: "An invited talk on the OWASP Top 10 and writing secure web APIs, for CSE and IT students from second year onward.",
        audience: { departments: ["CSE", "IT"], years: [2, 3, 4] },
        status: "published",
        authorId: id("faculty"),
      },
    ]);
    out.firstAnnouncement = docs[0]?._id;
    log(`announcements: +${docs.length}`);
  } else log("announcements: already has data, skipped");

  if ((await Event.estimatedDocumentCount()) === 0) {
    const docs = await Event.create([
      {
        title: "Tech Fest opening ceremony",
        description: "Kick-off for the annual tech fest with keynotes, project showcases and club stalls.",
        venue: "Main Auditorium",
        startsAt: atIst(7, 10),
        endsAt: atIst(7, 13),
        capacity: 500,
        audience: { departments: ["ALL"], years: ["ALL"] },
        status: "published",
        isPublic: true,
        authorId: id("admin"),
      },
      {
        title: "Resume building workshop",
        description: "A hands-on session on writing a one-page technical resume, with live reviews.",
        venue: "Seminar Hall 2",
        startsAt: atIst(3, 14),
        endsAt: atIst(3, 16),
        capacity: 60,
        audience: { departments: ["CSE", "IT"], years: [3, 4] },
        status: "published",
        authorId: id("placement"),
      },
      {
        title: "Robotics club demo day",
        description: "Line followers, a robotic arm and a drone show from the robotics club.",
        venue: "Electronics Block Lawn",
        startsAt: atIst(10, 11),
        endsAt: atIst(10, 15),
        audience: { departments: ["ECE", "EE"], years: ["ALL"] },
        status: "published",
        authorId: id("faculty"),
      },
      {
        title: "Alumni talk: from campus to cloud",
        description: "Alumni share how they moved from campus projects into cloud and security roles.",
        venue: "Main Auditorium",
        startsAt: atIst(14, 16, 30),
        endsAt: atIst(14, 18),
        audience: { departments: ["ALL"], years: ["ALL"] },
        status: "published",
        authorId: id("admin"),
      },
    ]);
    log(`events: +${docs.length}`);
  } else log("events: already has data, skipped");

  if ((await Resource.estimatedDocumentCount()) === 0) {
    const pdf = "application/pdf";
    const pptx = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const by = id("faculty");
    const docs = await Resource.create([
      { title: "Data Structures: unit 1 notes", department: "CSE", year: 2, semester: 3, subject: "Data Structures", file: { name: "ds-unit1.pdf", mimeType: pdf, size: 812_000 }, status: "published", uploadedBy: by },
      { title: "Operating Systems: process scheduling slides", department: "CSE", year: 3, semester: 5, subject: "Operating Systems", file: { name: "os-scheduling.pptx", mimeType: pptx, size: 2_400_000 }, status: "published", uploadedBy: by },
      { title: "Computer Networks: previous year papers", department: "CSE", year: 3, semester: 5, subject: "Computer Networks", file: { name: "cn-pyq.pdf", mimeType: pdf, size: 1_150_000 }, status: "published", uploadedBy: by },
      { title: "Signals and Systems: formula sheet", department: "ECE", year: 2, semester: 3, subject: "Signals and Systems", file: { name: "ss-formulas.pdf", mimeType: pdf, size: 320_000 }, status: "published", uploadedBy: by },
      { title: "DBMS: normalization cheat sheet", department: "IT", year: 2, semester: 4, subject: "Database Management Systems", file: { name: "dbms-normalization.docx", mimeType: docx, size: 96_000 }, status: "published", uploadedBy: by },
    ]);
    log(`resources: +${docs.length}`);
  } else log("resources: already has data, skipped");

  if ((await Opening.estimatedDocumentCount()) === 0) {
    const po = id("placement");
    const docs = await Opening.create([
      {
        title: "Software Engineer Intern",
        company: "Acme Cloud",
        type: "internship",
        description: "Six-month internship on a backend platform team. TypeScript, Node.js and MongoDB.",
        location: "Kolkata (hybrid)",
        compensation: "₹40,000 / month",
        eligibility: { departments: ["CSE", "IT", "CSE-AIML"], years: [3, 4], minCgpa: 7 },
        closesAt: atIst(21, 23, 59),
        applyUrl: "https://example.com/careers/sde-intern",
        status: "published",
        postedBy: po,
      },
      {
        title: "Graduate Security Analyst",
        company: "Northwind Security",
        type: "job",
        description: "Join the security operations team: monitoring, triage and incident response.",
        location: "Bengaluru",
        compensation: "₹9 LPA",
        eligibility: { departments: ["CSE", "IT"], years: [4] },
        closesAt: atIst(30, 23, 59),
        applyUrl: "https://example.com/careers/security-analyst",
        status: "published",
        postedBy: po,
      },
      {
        title: "Embedded Systems Intern",
        company: "Contoso Devices",
        type: "internship",
        description: "Firmware and hardware bring-up on ARM microcontrollers.",
        location: "Pune",
        eligibility: { departments: ["ECE", "EE"], years: [3, 4] },
        closesAt: atIst(14, 23, 59),
        applyUrl: "https://example.com/careers/embedded-intern",
        status: "published",
        postedBy: po,
      },
      {
        title: "Summer Research Internship",
        company: "Fabrikam Labs",
        type: "internship",
        description: "An eight-week summer research programme open to all branches.",
        location: "Remote",
        eligibility: { departments: ["ALL"], years: [2, 3] },
        closesAt: atIst(18, 23, 59),
        applyUrl: "https://example.com/careers/summer-research",
        status: "published",
        postedBy: po,
      },
    ]);
    out.firstOpening = docs[0]?._id;
    log(`openings: +${docs.length}`);
  } else log("openings: already has data, skipped");

  return out;
}

async function seedBookmarks(student: Types.ObjectId, refs: { firstAnnouncement?: Types.ObjectId; firstOpening?: Types.ObjectId }): Promise<void> {
  if ((await Bookmark.estimatedDocumentCount()) > 0 || !refs.firstAnnouncement || !refs.firstOpening) {
    log("bookmarks: skipped");
    return;
  }
  await Bookmark.create([
    { userId: student, itemType: "announcement", itemId: refs.firstAnnouncement },
    { userId: student, itemType: "opening", itemId: refs.firstOpening },
  ]);
  log("bookmarks: +2 (for the demo student)");
}

export interface SeedOptions {
  /** Where progress lines go; pass a no-op to keep tests quiet. */
  log?: (msg: string) => void;
}

/** Ensure indexes, then seed users, content and demo bookmarks. Needs an open connection. */
export async function runSeed(password: string, opts: SeedOptions = {}): Promise<void> {
  if (opts.log) log = opts.log;
  await ensureIndexes();
  const ids = await seedUsers(password);
  const id = (key: string): Types.ObjectId => {
    const v = ids.get(key);
    if (!v) throw new Error(`seed user missing: ${key}`);
    return v;
  };
  const refs = await seedContent(id);
  await seedBookmarks(id("student"), refs);
}
