import type { Express } from "express";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, disconnectDb, User } from "@scc/db";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/password.js";

// Covers the account/discovery routes: profile, search, bookmarks, admin.

const PASSWORD = "test-password-123";
type Agent = ReturnType<typeof request.agent>;

let mem: MongoMemoryServer;
let app: Express;

async function login(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const token = (await agent.get("/api/auth/csrf")).body.csrfToken as string;
  const res = await agent.post("/api/auth/login").set("x-csrf-token", token).send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return agent;
}

const csrfOf = async (agent: Agent): Promise<string> =>
  (await agent.get("/api/auth/csrf")).body.csrfToken as string;

async function send(agent: Agent, method: "post" | "patch" | "delete", path: string, body?: object) {
  const token = await csrfOf(agent);
  const req = agent[method](path).set("x-csrf-token", token);
  return body ? req.send(body) : req;
}

const announcement = (departments: string[], years: (number | "ALL")[]) => ({
  title: "Matrix placement drive",
  body: "Details inside",
  audience: { departments, years },
  status: "published" as const,
  pinned: false,
});

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri(), { appName: "scc-test", autoIndex: true });
  app = createApp();
  const passwordHash = await hashPassword(PASSWORD);
  await User.insertMany([
    { email: "admin@iem.edu.in", name: "admin", role: "admin", department: "CSE", status: "active", emailVerified: true, passwordHash },
    { email: "faculty@iem.edu.in", name: "faculty", role: "faculty", department: "CSE", status: "active", emailVerified: true, passwordHash },
    { email: "student@iem.edu.in", name: "student", role: "student", department: "CSE", year: 3, status: "active", emailVerified: true, passwordHash },
  ]);
}, 120_000);

afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe("profile", () => {
  it("returns the viewer's own profile and round-trips edits (phone is encrypted)", async () => {
    const student = await login("student@iem.edu.in");
    const got = await student.get("/api/profile");
    expect(got.status).toBe(200);
    expect(got.body.email).toBe("student@iem.edu.in");

    const patched = await send(student, "patch", "/api/profile", { name: "Student Edited", phone: "9876543210", bio: "CSE '28" });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe("Student Edited");
    expect(patched.body.phone).toBe("9876543210");
    expect(patched.body.bio).toBe("CSE '28");

    // Re-fetch to prove the encrypted phone decrypts back to the same value.
    const again = await student.get("/api/profile");
    expect(again.body.phone).toBe("9876543210");
  });
});

describe("search", () => {
  it("finds an in-scope announcement by title", async () => {
    const faculty = await login("faculty@iem.edu.in");
    await send(faculty, "post", "/api/announcements", announcement(["CSE"], [3]));

    const student = await login("student@iem.edu.in");
    const res = await student.get("/api/search?q=Matrix&types=announcement&limit=6");
    expect(res.status).toBe(200);
    expect(res.body.announcements.length).toBeGreaterThan(0);
    expect(res.body.announcements[0].title).toContain("Matrix");
  });
});

describe("bookmarks", () => {
  it("adds, lists and removes a bookmark", async () => {
    const faculty = await login("faculty@iem.edu.in");
    const created = await send(faculty, "post", "/api/announcements", announcement(["CSE"], [3]));
    const id = created.body.id as string;

    const student = await login("student@iem.edu.in");
    expect((await send(student, "post", "/api/bookmarks", { itemType: "announcement", itemId: id })).status).toBe(201);

    const list = await student.get("/api/bookmarks");
    expect(list.status).toBe(200);
    expect(list.body.items.some((b: { itemId: string }) => b.itemId === id)).toBe(true);

    expect((await send(student, "delete", `/api/bookmarks/announcement/${id}`)).status).toBe(204);
    const after = await student.get("/api/bookmarks");
    expect(after.body.items.some((b: { itemId: string }) => b.itemId === id)).toBe(false);
  });
});

describe("admin", () => {
  it("lists users for an admin and refuses a student", async () => {
    const admin = await login("admin@iem.edu.in");
    const ok = await admin.get("/api/admin/users");
    expect(ok.status).toBe(200);
    expect(ok.body.items.length).toBeGreaterThanOrEqual(3);

    const student = await login("student@iem.edu.in");
    expect((await student.get("/api/admin/users")).status).toBe(403);
  });

  it("suspends a user and cuts their active sessions", async () => {
    const victim = await login("student@iem.edu.in");
    expect((await victim.get("/api/auth/me")).status).toBe(200);
    const id = String((await User.findOne({ email: "student@iem.edu.in" }).lean<{ _id: unknown } | null>())?._id);

    const admin = await login("admin@iem.edu.in");
    const out = await send(admin, "patch", `/api/admin/users/${id}/status`, { status: "suspended", reason: "policy" });
    expect(out.status).toBe(200);
    expect(out.body.status).toBe("suspended");

    // The suspended user's existing session is now rejected.
    expect((await victim.get("/api/auth/me")).status).toBe(401);
  });
});
