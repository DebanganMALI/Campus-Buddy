import { isPrivileged, type Role } from "@scc/shared";
import { isProd } from "./env.js";

const HOUR = 3600;
const DAY = 24 * HOUR;

// __Host-/__Secure- prefixes need HTTPS, so plain names are used in development
export const COOKIES = {
  access: isProd ? "__Host-scc_at" : "scc_at",
  refresh: isProd ? "__Secure-scc_rt" : "scc_rt",
  csrf: isProd ? "__Host-scc_csrf" : "scc_csrf",
} as const;

export const REFRESH_COOKIE_PATH = "/api/auth";

export const TTL = {
  accessSec: 15 * 60,
  stepUpSec: 5 * 60,
  refreshRaceSec: 15,
  mfaChallengeSec: 5 * 60,
  mfaChallengeAttempts: 5,
  verifyEmailSec: DAY,
  resetPasswordSec: 15 * 60,
  inviteSec: 3 * DAY,
} as const;

export const sessionLifetime = (role: Role) =>
  isPrivileged(role)
    ? { idleSec: 2 * HOUR, absoluteSec: 8 * HOUR }
    : { idleSec: 7 * DAY, absoluteSec: 30 * DAY };

export const RATE_LIMITS = {
  global: { points: 600, duration: 60 },
  login: { points: 10, duration: 60 },
  loginFailIp: { points: 5, duration: 15 * 60 },
  register: { points: 5, duration: HOUR },
  emailAction: { points: 3, duration: HOUR },
  emailActionIp: { points: 10, duration: HOUR },
  tokenSubmit: { points: 20, duration: HOUR },
  mfaVerify: { points: 10, duration: 5 * 60 },
  refresh: { points: 30, duration: 60 },
  reauth: { points: 5, duration: 15 * 60 },
  sensitive: { points: 30, duration: HOUR },
} as const;
export type RateLimitName = keyof typeof RATE_LIMITS;

export const LOCKOUT = {
  captchaAfter: 3,
  lockAfter: 5,
  hardLockAfter: 10,
  baseLockSec: 30,
  maxLockSec: 15 * 60,
  resetAfterSec: DAY,
} as const;
