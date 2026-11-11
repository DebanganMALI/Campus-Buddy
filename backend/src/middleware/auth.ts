import type { RequestHandler } from "express";
import { Session, User } from "@scc/db";
import type { Role } from "@scc/shared";
import { SESSION_ROTATION, sessionLifetime } from "../config/security.js";
import { audit } from "../lib/audit.js";
import { safeEqual, sha256 } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import type { SessionRecord, UserRecord } from "../lib/records.js";
import { readSessionCookie, revokeSession, rotateSecret } from "../lib/session.js";

// Verifies the session cookie on every protected route and attaches req.auth.
// Any failure throws a 401-family AppError; the frontend treats those as
// "logged out" and redirects to /login.
export const requireAuth: RequestHandler = async (req, res, next) => {
  const cookie = readSessionCookie(req);
  if (!cookie) throw new AppError("UNAUTHENTICATED");

  const now = new Date();
  const session = await Session.findOne({ _id: cookie.sid, revokedAt: null })
    .select("+refreshHash +prevRefreshHash")
    .lean<SessionRecord | null>();

  if (!session) throw new AppError("SESSION_EXPIRED");
  if (session.expiresAt <= now || session.absoluteExpiresAt <= now) throw new AppError("SESSION_EXPIRED");

  const presented = sha256(cookie.secret);
  const matchesCurrent = safeEqual(presented, session.refreshHash);
  const matchesPrev = !!session.prevRefreshHash && safeEqual(presented, session.prevRefreshHash);
  if (!matchesCurrent && !matchesPrev) throw new AppError("SESSION_REVOKED");

  // Reuse detection: the previous secret is tolerated only briefly after a
  // rotation. Presented after the grace window it means the cookie was cloned —
  // revoke the whole session so a stolen cookie can't outlive the theft.
  const rotatedMs = session.rotatedAt ? session.rotatedAt.getTime() : 0;
  if (matchesPrev && now.getTime() - rotatedMs > SESSION_ROTATION.graceSec * 1000) {
    await revokeSession(session._id, "refresh_reuse");
    audit(req, { action: "auth.session.reuse_detected", result: "denied", actorId: String(session.userId) });
    throw new AppError("SESSION_REVOKED");
  }

  const user = await User.findById(session.userId).lean<UserRecord | null>();
  if (!user) throw new AppError("SESSION_REVOKED");
  if (user.status === "suspended") throw new AppError("ACCOUNT_SUSPENDED");
  if (user.status !== "active") throw new AppError("UNAUTHENTICATED");

  // Slide the idle window forward, but never past the absolute lifetime.
  const { idleSec } = sessionLifetime(user.role);
  const nextExpiry = new Date(Math.min(now.getTime() + idleSec * 1000, session.absoluteExpiresAt.getTime()));
  const update: Record<string, unknown> = { lastUsedAt: now, expiresAt: nextExpiry };

  // Rotate the secret at most once per interval, and only when the client
  // presented the current secret (never while it is catching up on the previous
  // one). The sid is unchanged, so the bound CSRF token stays valid.
  if (matchesCurrent && now.getTime() - rotatedMs > SESSION_ROTATION.rotateAfterSec * 1000) {
    Object.assign(update, rotateSecret(res, session));
  }

  await Session.updateOne({ _id: session._id }, { $set: update });

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
