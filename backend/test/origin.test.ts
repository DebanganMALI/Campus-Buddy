import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

// The origin guard trusts APP_ORIGIN and the URL Render assigns (RENDER_EXTERNAL_URL).
let app: Express;
let appOrigin: string;
const renderUrl = "https://campus-buddy-test.onrender.com";

beforeAll(async () => {
  process.env.RENDER_EXTERNAL_URL = renderUrl;
  const mod = await import("../src/app.js");
  appOrigin = (await import("../src/config/env.js")).env.APP_ORIGIN;
  app = mod.createApp();
});

// POST /api/auth/logout with no session needs no database: 204 once both checks pass.
async function logoutFrom(origin: string) {
  const agent = request.agent(app);
  const csrf = await agent.get("/api/auth/csrf");
  return agent.post("/api/auth/logout").set("Origin", origin).set("x-csrf-token", csrf.body.csrfToken);
}

describe("origin guard", () => {
  it("rejects a foreign origin even with a valid CSRF token", async () => {
    const res = await logoutFrom("https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_INVALID");
  });

  it("accepts APP_ORIGIN", async () => {
    expect((await logoutFrom(appOrigin)).status).toBe(204);
  });

  it("accepts the URL Render assigns the service (RENDER_EXTERNAL_URL)", async () => {
    expect((await logoutFrom(renderUrl)).status).toBe(204);
  });
});
