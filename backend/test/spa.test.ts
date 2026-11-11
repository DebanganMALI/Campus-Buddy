import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

// Verifies same-origin SPA serving: static assets and client routes come from
// the app shell, while /api/* still routes to the API. No database needed.

let app: Express;

beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scc-spa-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>SCC</title><div id=root>APP_SHELL</div>");
  fs.writeFileSync(path.join(dir, "app.js"), "console.log('bundle')");
  process.env.CLIENT_DIR = dir;
  // Import after CLIENT_DIR is set so env.ts picks it up.
  const mod = await import("../src/app.js");
  app = mod.createApp();
});

describe("same-origin SPA serving", () => {
  it("serves index.html at the root", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("APP_SHELL");
  });

  it("serves a built static asset", async () => {
    const res = await request(app).get("/app.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain("bundle");
  });

  it("falls back to index.html for a client-side route (deep link / refresh)", async () => {
    const res = await request(app).get("/dashboard/openings");
    expect(res.status).toBe(200);
    expect(res.text).toContain("APP_SHELL");
  });

  it("still routes /api/* to the API, not the SPA", async () => {
    expect((await request(app).get("/api/health")).body.status).toBe("ok");
    // An auth-guarded API route must 401 (JSON), not return the app shell.
    const guarded = await request(app).get("/api/announcements");
    expect(guarded.status).toBe(401);
    expect(guarded.body.code).toBe("UNAUTHENTICATED");
  });
});
