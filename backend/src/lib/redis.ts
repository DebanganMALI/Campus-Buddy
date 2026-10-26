import { Redis } from "ioredis";
import { env } from "../config/env.js";

// Fail fast instead of queueing commands while Redis is down
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: 1_000,
});
