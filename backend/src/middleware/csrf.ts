import type { Request, RequestHandler, Response } from "express";
import { isProd, env } from "../config/env.js";
import { COOKIES } from "../config/security.js";
import { hmac, randomToken, safeEqual } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { UNSAFE_METHODS } from "./security.js";

const CSRF_COOKIE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const sign = (nonce: string, binding: string) => hmac(env.CSRF_SECRET, `${nonce}|${binding}`);

export const sidFromRefreshCookie = (req: Request): string | undefined => {
  const raw: unknown = req.cookies?.[COOKIES.refresh];
  return typeof raw === "string" ? raw.split(".")[0] : undefined;
};

// Token is bound to the session id (or "anon") so a leaked token is useless elsewhere
export const csrfBinding = (req: Request): string => {
  if (req.token && !("invalid" in req.token)) return req.token.claims.sid;
  return sidFromRefreshCookie(req) ?? "anon";
};

export function issueCsrf(res: Response, binding: string): string {
  const nonce = randomToken(16);
  const token = `${nonce}.${sign(nonce, binding)}`;
  res.cookie(COOKIES.csrf, token, {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: CSRF_COOKIE_MAX_AGE_MS,
  });
  res.setHeader("X-CSRF-Token", token);
  return token;
}

export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  const header = req.get("x-csrf-token");
  const cookie: unknown = req.cookies?.[COOKIES.csrf];
  if (!header || typeof cookie !== "string" || !safeEqual(header, cookie)) throw new AppError("CSRF_INVALID");
  const [nonce, mac] = header.split(".");
  if (!nonce || !mac || !safeEqual(mac, sign(nonce, csrfBinding(req)))) throw new AppError("CSRF_INVALID");
  next();
};
