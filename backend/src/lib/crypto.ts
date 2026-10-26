import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");
export const randomHex = (bytes = 16): string => randomBytes(bytes).toString("hex");
export const sha256 = (value: string): string => createHash("sha256").update(value).digest("base64url");
export const hmac = (key: string, value: string): string =>
  createHmac("sha256", key).update(value).digest("base64url");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// IPs are personal data, so only a keyed hash is stored
export const hashIp = (ip: string): string => hmac(env.PASSWORD_PEPPER, `ip:${ip}`);
