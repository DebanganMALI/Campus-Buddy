import type { Request, RequestHandler } from "express";
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import { RATE_LIMITS, type RateLimitName } from "../config/security.js";
import { AppError } from "./errors.js";
import { redis } from "./redis.js";

const limiters = new Map<RateLimitName, RateLimiterRedis>();

export function limiter(name: RateLimitName): RateLimiterRedis {
  let l = limiters.get(name);
  if (!l) {
    const { points, duration } = RATE_LIMITS[name];
    l = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: `rl:${name}`,
      points,
      duration,
      // Stricter per-instance fallback when Redis is unreachable
      insuranceLimiter: new RateLimiterMemory({ points: Math.max(1, Math.floor(points / 2)), duration }),
    });
    limiters.set(name, l);
  }
  return l;
}

export async function consume(name: RateLimitName, key: string): Promise<void> {
  try {
    await limiter(name).consume(key);
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      throw new AppError("RATE_LIMITED", undefined, { retryAfter: Math.ceil(err.msBeforeNext / 1000) });
    }
    throw err;
  }
}

export const clientIp = (req: Request): string => req.ip ?? "unknown";

export const rateLimit =
  (name: RateLimitName, key: (req: Request) => string = clientIp): RequestHandler =>
  async (req, _res, next) => {
    await consume(name, key(req));
    next();
  };
