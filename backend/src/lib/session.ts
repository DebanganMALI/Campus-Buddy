import type { CookieOptions, Request, Response } from "express";
import type { Types } from "mongoose";
import { Session } from "@scc/db";
import type { Role } from "@scc/shared";
import { isProd } from "../config/env.js";
import { COOKIES, sessionLifetime } from "../config/security.js";
import { randomHex, randomToken, sha256 } from "./crypto.js";

// The session cookie carries "<sid>.<secret>":
//   - sid    = the Session document's _id (32 hex chars)
//   - secret = a random value we only ever store hashed (sha256) in the session
// So a stolen database row cannot be turned back into a valid cookie.
const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/",
};

export const readSessionCookie = (req: Request): { sid: string; secret: string } | null => {
  const raw: unknown = req.cookies?.[COOKIES.refresh];
  if (typeof raw !== "string") return null;
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot >= raw.length - 1) return null;
  return { sid: raw.slice(0, dot), secret: raw.slice(dot + 1) };
};

export async function createSession(
  res: Response,
  req: Request,
  user: { _id: Types.ObjectId; role: Role },
): Promise<string> {
  const sid = randomHex(16); // 32 hex characters -> Session._id
  const secret = randomToken(32); // base64url, never contains "."
  const now = new Date();
  const { idleSec, absoluteSec } = sessionLifetime(user.role);

  await Session.create({
    _id: sid,
    userId: user._id,
    refreshHash: sha256(secret),
    authTime: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + idleSec * 1000),
    absoluteExpiresAt: new Date(now.getTime() + absoluteSec * 1000),
    userAgent: req.get("user-agent")?.slice(0, 300),
  });

  res.cookie(COOKIES.refresh, `${sid}.${secret}`, { ...cookieBase, maxAge: absoluteSec * 1000 });
  return sid;
}

export async function revokeSession(sid: string, reason: string): Promise<void> {
  await Session.updateOne({ _id: sid, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: reason } });
}

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(COOKIES.refresh, cookieBase);
};
