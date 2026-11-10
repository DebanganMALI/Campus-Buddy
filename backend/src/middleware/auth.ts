import type { RequestHandler } from "express";
import { Session, User } from "@scc/db";
import type { Role } from "@scc/shared";
import { sessionLifetime } from "../config/security.js";
import { safeEqual, sha256 } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import type { SessionRecord, UserRecord } from "../lib/records.js";
import { readSessionCookie } from "../lib/session.js";

// Verifies the session cookie on every protected route and attaches req.auth.
// Any failure throws a 401-family AppError; the frontend treats those as
// "logged out" and redirects to /login.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const cookie = readSessionCookie(req);
  if (!cookie) throw new AppError("UNAUTHENTICATED");

  const now = new Date();
  const session = await Session.findOne({ _id: cookie.sid, revokedAt: null })
    .select("+refreshHash")
    .lean<SessionRecord | null>();

  if (!session) throw new AppError("SESSION_EXPIRED");
  if (session.expiresAt <= now || session.absoluteExpiresAt <= now) throw new AppError("SESSION_EXPIRED");
  if (!safeEqual(sha256(cookie.secret), session.refreshHash)) throw new AppError("SESSION_REVOKED");

  const user = await User.findById(session.userId).lean<UserRecord | null>();
  if (!user) throw new AppError("SESSION_REVOKED");
  if (user.status === "suspended") throw new AppError("ACCOUNT_SUSPENDED");
  if (user.status !== "active") throw new AppError("UNAUTHENTICATED");

  // Slide the idle window forward, but never past the absolute lifetime.
  const { idleSec } = sessionLifetime(user.role);
  const nextExpiry = new Date(Math.min(now.getTime() + idleSec * 1000, session.absoluteExpiresAt.getTime()));
  await Session.updateOne({ _id: session._id }, { $set: { lastUsedAt: now, expiresAt: nextExpiry } });

  const role: Role = user.role;
  req.auth = {
    userId: String(user._id),
    role,
    sid: session._id,
    authTime: session.authTime.getTime(),
    mfa: "ok",
    department: user.department,
    ...(typeof user.year === "number" ? { year: user.year } : {}),
  };
  next();
};
