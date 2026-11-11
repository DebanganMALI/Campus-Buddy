import type { Express } from "express";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Announcement, Bookmark, Event, Opening, Resource, User, connectDb, disconnectDb } from "@scc/db";
import { createApp } from "../src/app.js";
import { USERS, runSeed } from "../src/scripts/seed-data.js";

// Proves the demo seed: it fills every collection, is safe to re-run, creates
// indexes itself (production runs with autoIndex off), and its accounts can sign
// in and see audience-targeted content.

const PASSWORD = "CampusDemo@2026";
const quiet = { log: (): void => undefined };

let mem: MongoMemoryServer;
let app: Express;

async function login(email: string): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const token = (await agent.get("/api/auth/csrf")).body.csrfToken as string;
  const res = await agent.post("/api/auth/login").set("x-csrf-token", token).send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

const counts = async () => ({
  users: await User.countDocuments(),
  announcements: await Announcement.countDocuments(),
  events: await Event.countDocuments(),
  resources: await Resource.countDocuments(),
  openings: await Opening.countDocuments(),
  bookmarks: await Bookmark.countDocuments(),
});

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  // autoIndex off, like production, so the seed itself must create the indexes.
  await connectDb(mem.getUri(), { appName: "scc-test", autoIndex: false });
  app = createApp();
  await runSeed(PASSWORD, quiet);
}, 120_000);

afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe("demo seed", () => {
  it("fills every collection with the demo set", async () => {
    expect(await counts()).toEqual({ users: 7, announcements: 5, events: 4, resources: 5, openings: 4, bookmarks: 2 });
  });

  it("creates the declared indexes itself", async () => {
    const names = (await Announcement.collection.indexes()).map((i) => i.name);
    expect(names).toContain("feed");
    const userIdx = await User.collection.indexes();
    expect(userIdx.some((i) => i.unique && JSON.stringify(i.key) === JSON.stringify({ email: 1 }))).toBe(true);
  });

  it("is idempotent: a second run changes nothing", async () => {
    const before = await counts();
    await runSeed(PASSWORD, quiet);
    expect(await counts()).toEqual(before);
  });

  it("lets every demo account sign in with the seed password", async () => {
    for (const u of USERS) await login(u.email); // throws on any non-200
  });

  it("targets announcements and openings by department and year", async () => {
    const cse3 = await login("demo.student@iem.edu.in");
    const ece2 = await login("demo.ece@iem.edu.in");
    const it1 = await login("demo.it@iem.edu.in");

    expect((await cse3.get("/api/announcements")).body.items).toHaveLength(4);
    expect((await ece2.get("/api/announcements")).body.items).toHaveLength(3);
    expect((await it1.get("/api/announcements")).body.items).toHaveLength(2);
    expect((await cse3.get("/api/openings")).body.items).toHaveLength(2);
  });

  it("gives the demo student starter bookmarks", async () => {
    const cse3 = await login("demo.student@iem.edu.in");
    expect((await cse3.get("/api/bookmarks")).body.items).toHaveLength(2);
  });
});
