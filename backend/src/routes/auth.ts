import { Router } from "express";
import {
  isPrivileged,
  loginBody,
  loginResponse,
  meResponse,
  permissionsFor,
  registerBody,
} from "@scc/shared";
import { User } from "@scc/db";
import { env } from "../config/env.js";
import { csrfBinding, issueCsrf } from "../middleware/csrf.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import type { UserRecord } from "../lib/records.js";
import { clearSessionCookie, createSession, readSessionCookie, revokeSession } from "../lib/session.js";
import { toUserDto } from "../lib/user-dto.js";

// Same reply whether or not the email is free, so an attacker can't learn which
// emails are registered.
const REGISTER_MESSAGE = "If this email can be registered, we've sent a verification link to it.";

const emailDomainAllowed = (email: string): boolean => {
  const domains = env.ALLOWED_EMAIL_DOMAINS;
  return domains.length === 0 || domains.some((d) => email.endsWith(`@${d}`));
};

export const authRouter: Router = Router();

// GET /api/auth/csrf — hand the SPA a CSRF token (and set the matching cookie).
authRouter.get("/csrf", (req, res) => {
  const token = issueCsrf(res, csrfBinding(req));
  res.json({ csrfToken: token });
});

// POST /api/auth/register — always 202, no account enumeration.
authRouter.post("/register", async (req, res) => {
  const body = registerBody.parse(req.body);
  const existing = await User.findOne({ email: body.email }).select("_id").lean();

  if (emailDomainAllowed(body.email) && !existing) {
    const passwordHash = await hashPassword(body.password);
    await User.create({
      email: body.email,
      name: body.name,
      rollNo: body.rollNo,
      department: body.department,
      year: body.year,
      role: "student",
      // Option A skips the email-verification step: new accounts are active at once.
      status: "active",
      emailVerified: true,
      passwordHash,
    });
  }

  res.status(202).json({ message: REGISTER_MESSAGE });
});

// POST /api/auth/login — password check, then issue a session + rotate CSRF.
authRouter.post("/login", async (req, res) => {
  const body = loginBody.parse(req.body);
  const user = await User.findOne({ email: body.email }).select("+passwordHash").lean<UserRecord | null>();

  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, body.password) : false;
  if (!user || !ok) throw new AppError("INVALID_CREDENTIALS");
  if (user.status === "suspended") throw new AppError("ACCOUNT_SUSPENDED");
  if (user.status !== "active") throw new AppError("INVALID_CREDENTIALS");

  const sid = await createSession(res, req, { _id: user._id, role: user.role });
  await User.updateOne({ _id: user._id }, { $set: { "security.lastLoginAt": new Date() } });
  issueCsrf(res, sid); // bind the new CSRF token to the new session

  res.json(loginResponse.parse({ status: "OK", user: toUserDto(user) }));
});

// POST /api/auth/logout — revoke the session and clear the cookie.
authRouter.post("/logout", async (req, res) => {
  const cookie = readSessionCookie(req);
  if (cookie) await revokeSession(cookie.sid, "logout");
  clearSessionCookie(res);
  issueCsrf(res, "anon");
  res.status(204).end();
});

// GET /api/auth/me — who am I? The answer comes from the cookie, never from JS.
authRouter.get("/me", requireAuth, async (req, res) => {
  const auth = req.auth;
  if (!auth) throw new AppError("UNAUTHENTICATED");

  const user = await User.findById(auth.userId).lean<UserRecord | null>();
  if (!user) throw new AppError("SESSION_REVOKED");

  res.json(
    meResponse.parse({
      user: toUserDto(user),
      permissions: permissionsFor(user.role),
      mfa: { enabled: user.mfa?.enabled ?? false, required: isPrivileged(user.role) },
      feed: { lastSeenAt: user.lastFeedSeenAt ? user.lastFeedSeenAt.toISOString() : null },
    }),
  );
});
