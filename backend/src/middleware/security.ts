import type { RequestHandler } from "express";
import helmet from "helmet";
import { env, isProd } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const commonHeaders = {
  crossOriginResourcePolicy: { policy: "same-origin" as const },
  referrerPolicy: { policy: "no-referrer" as const },
  strictTransportSecurity: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : (false as const),
};

// API responses are JSON only, so their CSP denies everything.
const apiHeaders = helmet({
  ...commonHeaders,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
});

// The web app (served same-origin when CLIENT_DIR is set) gets a strict document
// CSP: only its own scripts, styles, fonts and API — no inline script, no eval,
// no third-party origins. data: covers the small inline SVG backgrounds in CSS.
const appHeaders = helmet({
  ...commonHeaders,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
      // https only: on http://localhost it would rewrite asset URLs and break the page.
      ...(isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },
});

const servesApp = Boolean(env.CLIENT_DIR);
export const securityHeaders: RequestHandler = (req, res, next) =>
  servesApp && !req.path.startsWith("/api/") ? appHeaders(req, res, next) : apiHeaders(req, res, next);

// Trusted origins: APP_ORIGIN, plus the URL Render assigns the service (it sets
// RENDER_EXTERNAL_URL itself), so a renamed service URL never blocks logins.
const trustedOrigins = new Set(
  [env.APP_ORIGIN, process.env.RENDER_EXTERNAL_URL]
    .filter((o): o is string => Boolean(o))
    .map((o) => o.replace(/\/+$/, "")),
);

// Browsers always send Origin on unsafe requests; a foreign one is a CSRF attempt
export const originGuard: RequestHandler = (req, _res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  const referer = req.get("referer");
  if (origin && !trustedOrigins.has(origin)) throw new AppError("CSRF_INVALID");
  if (!origin && referer && ![...trustedOrigins].some((o) => referer.startsWith(`${o}/`))) {
    throw new AppError("CSRF_INVALID");
  }
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
