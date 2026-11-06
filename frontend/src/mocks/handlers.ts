// A fake backend that runs inside the browser (MSW). It follows AGENTS.md §5.8 so the
// pages behave the same when we switch to the real API. Only loaded in "mock" mode.
import { delay, http, HttpResponse } from "msw";
import { ERROR_MESSAGES, ERROR_STATUS, loginBody, permissionsFor, type ErrorCode, type UserDTO } from "@scc/shared";
import { MOCK_LOCKED_EMAIL, MOCK_PASSWORD, mockUsers } from "./data";

// Mock-only shortcut: the real backend uses httpOnly cookies, never sessionStorage
const SESSION_KEY = "scc-mock-session";
let csrfToken: string | null = null;

function newCsrf(): string {
  csrfToken = `mock-csrf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return csrfToken;
}

function apiError(code: ErrorCode, extra: { issues?: unknown[]; retryAfter?: number } = {}) {
  return HttpResponse.json(
    {
      code,
      message: ERROR_MESSAGES[code],
      requestId: `req_mock_${Date.now().toString(36)}`,
      ...(extra.issues ? { issues: extra.issues } : {}),
    },
    {
      status: ERROR_STATUS[code],
      headers: extra.retryAfter ? { "Retry-After": String(extra.retryAfter) } : undefined,
    },
  );
}

function sessionUser(): UserDTO | null {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return mockUsers.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

function setSession(id: string | null) {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked: the mock just forgets the login on reload */
  }
}

// Same double-submit check as the real backend: header must match the issued token
const csrfOk = (request: Request) => csrfToken !== null && request.headers.get("x-csrf-token") === csrfToken;

export const handlers = [
  http.get("/api/auth/csrf", () => {
    const token = newCsrf();
    return HttpResponse.json({ csrfToken: token }, { headers: { "X-CSRF-Token": token } });
  }),

  http.get("/api/auth/me", async () => {
    await delay(200);
    const user = sessionUser();
    if (!user) return apiError("UNAUTHENTICATED");
    return HttpResponse.json({
      user,
      permissions: permissionsFor(user.role),
      mfa: { enabled: false, required: false },
      feed: { lastSeenAt: null },
    });
  }),

  http.post("/api/auth/login", async ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    await delay(400);

    const parsed = loginBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
      return apiError("VALIDATION_ERROR", { issues });
    }
    const { email, password } = parsed.data;
    if (email === MOCK_LOCKED_EMAIL) return apiError("ACCOUNT_LOCKED", { retryAfter: 30 });

    const user = mockUsers.find((u) => u.email === email);
    if (!user || password !== MOCK_PASSWORD) return apiError("INVALID_CREDENTIALS");

    setSession(user.id);
    const token = newCsrf(); // rotate after login, like the real server
    return HttpResponse.json({ status: "OK", user }, { headers: { "X-CSRF-Token": token } });
  }),

  http.post("/api/auth/logout", ({ request }) => {
    if (!csrfOk(request)) return apiError("CSRF_INVALID");
    setSession(null);
    const token = newCsrf();
    return new HttpResponse(null, { status: 204, headers: { "X-CSRF-Token": token } });
  }),
];
