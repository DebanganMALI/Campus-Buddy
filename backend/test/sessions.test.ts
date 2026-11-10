import type { Express } from "express";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, disconnectDb, Session, User } from "@scc/db";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/password.js";
import { SESSION_ROTATION } from "../src/config/security.js";

// Proves refresh-secret rotation, cloned-cookie reuse detection, and
// "log out everywhere" (OWASP session-management hardening).

const PASSWORD = "test-password-123";
const EMAIL = "rot@iem.edu.in";

let mem: MongoMemoryServer;
let app: Express;

// Pull the scc_rt cookie value ("<sid>.<secret>") out of a Set-Cookie header.
function refreshCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const line = (raw ?? []).find((c) => c.startsWith("scc_rt="));
  if (!line) throw new Error("no refresh cookie was set");
  const first = line.split(";")[0] ?? "";
  return decodeURIComponent(first.slice("scc_rt=".length));
}

const sidOf = (cookie: string): string => cookie.split(".")[0] ?? "";

async function loginRaw(): Promise<{ agent: ReturnType<typeof request.agent>; csrf: string; cookie: string }> {
  const agent = request.agent(app);
  const csrfRes = await agent.get("/api/auth/csrf");
  const csrf = csrfRes.body.csrfToken as string;
  const res = await agent.post("/api/auth/login").set("x-csrf-token", csrf).send({ email: EMAIL, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  // Login rebinds CSRF to the new session, returning the fresh token in a header.
  return { agent, csrf: (res.headers["x-csrf-token"] as string) ?? csrf, cookie: refreshCookie(res) };
}

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri(), { appName: "scc-test", autoIndex: true });
  app = createApp();
  const passwordHash = await hashPassword(PASSWORD);
  await User.create({
    email: EMAIL,
    name: "rot",
    role: "student",
    department: "CSE",
    year: 3,
    status: "active",
    emailVerified: true,
    passwordHash,
  });
}, 120_000);

afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe("session rotation + revocation", () => {
  it("rotates the session secret on first authenticated use, keeping the same sid", async () => {
    const { agent, cookie } = await loginRaw();
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    const rotated = refreshCookie(res);
    expect(rotated).not.toBe(cookie); // a fresh secret was issued
    expect(sidOf(rotated)).toBe(sidOf(cookie)); // but the session id is unchanged
  });

  it("revokes the session when a superseded secret is replayed after the grace window", async () => {
    const { agent, cookie } = await loginRaw();
    const sid = sidOf(cookie);
    await agent.get("/api/auth/me"); // rotates; `cookie` is now the previous secret
    // Age the rotation beyond the grace window so the old secret reads as a replay.
    await Session.updateOne(
      { _id: sid },
      { $set: { rotatedAt: new Date(Date.now() - (SESSION_ROTATION.graceSec + 5) * 1000) } },
    );
    const replay = await request(app).get("/api/auth/me").set("Cookie", `scc_rt=${cookie}`);
    expect(replay.status).toBe(401);
    const doc = await Session.findById(sid).lean<{ revokedAt?: Date | null } | null>();
    expect(doc?.revokedAt).toBeTruthy(); // the whole session was killed
  });

  it("logs out every active session for the user", async () => {
    const a = await loginRaw();
    const b = await loginRaw();
    expect((await a.agent.get("/api/auth/me")).status).toBe(200);
    expect((await b.agent.get("/api/auth/me")).status).toBe(200);

    const out = await a.agent.post("/api/auth/logout-all").set("x-csrf-token", a.csrf);
    expect(out.status).toBe(200);

    expect((await a.agent.get("/api/auth/me")).status).toBe(401);
    expect((await b.agent.get("/api/auth/me")).status).toBe(401);
  });
});
