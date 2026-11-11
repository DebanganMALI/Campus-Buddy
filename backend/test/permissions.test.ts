import type { Express } from "express";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, disconnectDb, User } from "@scc/db";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/password.js";

// Integration test for the permission matrix: log in as each role and assert
// each one is allowed or refused on each endpoint. This is what proves there is
// no broken object/function-level authorization (OWASP API #1 / #5).

const PASSWORD = "test-password-123";

interface Seed {
  key: string;
  email: string;
  role: "student" | "faculty" | "moderator" | "placement_officer" | "admin";
  department: string;
  year?: number;
}

const SEEDS: Seed[] = [
  { key: "student", email: "student@iem.edu.in", role: "student", department: "CSE", year: 3 },
  { key: "studentEce", email: "ece@iem.edu.in", role: "student", department: "ECE", year: 2 },
  { key: "faculty", email: "faculty@iem.edu.in", role: "faculty", department: "CSE" },
  { key: "faculty2", email: "faculty2@iem.edu.in", role: "faculty", department: "CSE" },
  { key: "placement", email: "po@iem.edu.in", role: "placement_officer", department: "CSE" },
  { key: "admin", email: "admin@iem.edu.in", role: "admin", department: "CSE" },
];

interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
}

let mem: MongoMemoryServer;
let app: Express;
const sessions = new Map<string, Session>();

const S = (key: string): Session => {
  const s = sessions.get(key);
  if (!s) throw new Error(`no session for ${key}`);
  return s;
};

async function login(email: string): Promise<Session> {
  const agent = request.agent(app);
  const csrfRes = await agent.get("/api/auth/csrf");
  const token = csrfRes.body.csrfToken as string;
  const res = await agent.post("/api/auth/login").set("x-csrf-token", token).send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: (res.headers["x-csrf-token"] as string) ?? token };
}

const announcement = (departments: string[], years: (number | "ALL")[]) => ({
  title: "Matrix test announcement",
  body: "body",
  audience: { departments, years },
  status: "published" as const,
  pinned: false,
});

const opening = () => ({
  title: "SDE Internship",
  company: "Acme",
  type: "internship" as const,
  description: "Join the team",
  eligibility: { departments: ["ALL"], years: ["ALL"] },
  closesAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  applyUrl: "https://example.com/apply",
});

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri(), { appName: "scc-test", autoIndex: true });
  app = createApp();

  const passwordHash = await hashPassword(PASSWORD);
  await User.insertMany(
    SEEDS.map((u) => ({
      email: u.email,
      name: u.key,
      role: u.role,
      department: u.department,
      year: u.year,
      status: "active",
      emailVerified: true,
      passwordHash,
    })),
  );

  for (const u of SEEDS) sessions.set(u.key, await login(u.email));
}, 120_000);

afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe("authentication", () => {
  it("refuses anonymous reads and writes", async () => {
    // A read with no session is rejected by requireAuth (401). A write with no
    // session is rejected even earlier, by CSRF (403) — either way it's refused.
    expect((await request(app).get("/api/announcements")).status).toBe(401);
    expect([401, 403]).toContain(
      (await request(app).post("/api/announcements").send(announcement(["CSE"], [3]))).status,
    );
  });

  it("lets a logged-in student read", async () => {
    const res = await S("student").agent.get("/api/announcements");
    expect(res.status).toBe(200);
  });
});

describe("create permissions (function-level authorization)", () => {
  const post = (key: string, path: string, body: object) =>
    S(key).agent.post(path).set("x-csrf-token", S(key).csrf).send(body);

  it("students cannot create content", async () => {
    expect((await post("student", "/api/announcements", announcement(["CSE"], [3]))).status).toBe(403);
    expect((await post("student", "/api/openings", opening())).status).toBe(403);
  });

  it("faculty can create announcements but not openings", async () => {
    expect((await post("faculty", "/api/announcements", announcement(["CSE"], [3]))).status).toBe(201);
    expect((await post("faculty", "/api/openings", opening())).status).toBe(403);
  });

  it("placement officers can create openings but not announcements", async () => {
    expect((await post("placement", "/api/openings", opening())).status).toBe(201);
    expect((await post("placement", "/api/announcements", announcement(["CSE"], [3]))).status).toBe(403);
  });

  it("admins can create anything", async () => {
    expect((await post("admin", "/api/announcements", announcement(["CSE"], [3]))).status).toBe(201);
    expect((await post("admin", "/api/openings", opening())).status).toBe(201);
  });
});

describe("visibility scoping (object-level authorization)", () => {
  const post = (key: string, path: string, body: object) =>
    S(key).agent.post(path).set("x-csrf-token", S(key).csrf).send(body);

  it("hides out-of-scope content from a student as 404", async () => {
    // An ECE year-2 announcement should be invisible to a CSE year-3 student.
    const created = await post("admin", "/api/announcements", announcement(["ECE"], [2]));
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    expect((await S("student").agent.get(`/api/announcements/${id}`)).status).toBe(404);
    expect((await S("studentEce").agent.get(`/api/announcements/${id}`)).status).toBe(200);
  });

  it("shows in-scope content to a student", async () => {
    const created = await post("admin", "/api/announcements", announcement(["CSE"], [3]));
    const id = created.body.id as string;
    expect((await S("student").agent.get(`/api/announcements/${id}`)).status).toBe(200);
  });
});

describe("ownership (edit/delete)", () => {
  const post = (key: string, path: string, body: object) =>
    S(key).agent.post(path).set("x-csrf-token", S(key).csrf).send(body);
  const patch = (key: string, path: string, body: object) =>
    S(key).agent.patch(path).set("x-csrf-token", S(key).csrf).send(body);

  it("only the owner or an admin can edit an item", async () => {
    const created = await post("faculty", "/api/announcements", announcement(["CSE"], [3]));
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    expect((await patch("faculty2", `/api/announcements/${id}`, { title: "hijacked" })).status).toBe(403);
    expect((await patch("admin", `/api/announcements/${id}`, { title: "by admin" })).status).toBe(200);
    expect((await patch("faculty", `/api/announcements/${id}`, { title: "by owner" })).status).toBe(200);
  });
});
