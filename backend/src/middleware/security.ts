import type { RequestHandler } from "express";
import helmet from "helmet";
import { env, isProd } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// The API only serves JSON, so the CSP denies everything
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "no-referrer" },
  strictTransportSecurity: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
});

// Browsers always send Origin on unsafe requests; a foreign one is a CSRF attempt
export const originGuard: RequestHandler = (req, _res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  const referer = req.get("referer");
  if (origin && origin !== env.APP_ORIGIN) throw new AppError("CSRF_INVALID");
  if (!origin && referer && !referer.startsWith(`${env.APP_ORIGIN}/`)) throw new AppError("CSRF_INVALID");
  next();
};

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const isBadKey = (k: string) => k.includes("$") || k.includes(".") || FORBIDDEN_KEYS.has(k);

function hasBadKey(value: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (Array.isArray(value)) return value.some((v) => hasBadKey(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.keys(value).some(
      (k) => isBadKey(k) || hasBadKey((value as Record<string, unknown>)[k], depth + 1),
    );
  }
  return false;
}

// Blocks NoSQL operator injection and prototype pollution before any handler runs
export const rejectDangerousKeys: RequestHandler = (req, _res, next) => {
  if (hasBadKey(req.body) || hasBadKey(req.query))
    throw new AppError("VALIDATION_ERROR", "Request contains forbidden keys.");
  next();
};
