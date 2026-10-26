import { z } from "zod";

const csv = z.string().transform((s) =>
  s
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean),
);
const base64Bytes = (n: number) =>
  z.string().refine((v) => Buffer.from(v, "base64").length === n, `must be ${n} bytes, base64-encoded`);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_ORIGIN: z.url(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    MONGO_URI: z.string().startsWith("mongodb"),
    REDIS_URL: z.string().startsWith("redis"),
    JWT_PRIVATE_KEY: z.string().min(1),
    JWT_KEY_ID: z.string().min(1).max(64),
    JWT_PREVIOUS_PUBLIC_KEY: z.string().optional(),
    JWT_PREVIOUS_KEY_ID: z.string().optional(),
    CSRF_SECRET: z.string().min(32),
    PASSWORD_PEPPER: z.string().min(32),
    MFA_ENCRYPTION_KEY: base64Bytes(32),
    ALLOWED_EMAIL_DOMAINS: csv.default([]),
    HIBP_ENABLED: z.stringbool().default(true),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default("Campus Buddy <no-reply@campus-buddy.local>"),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== "production") return;
    const need = (ok: boolean, path: string, message: string) =>
      ok || ctx.addIssue({ code: "custom", path: [path], message });
    need(e.APP_ORIGIN.startsWith("https://"), "APP_ORIGIN", "must be https in production");
    need(e.TRUST_PROXY >= 1, "TRUST_PROXY", "set the proxy hop count in production");
    need(e.ALLOWED_EMAIL_DOMAINS.length > 0, "ALLOWED_EMAIL_DOMAINS", "required in production");
    need(Boolean(e.SMTP_URL), "SMTP_URL", "required in production");
  });

// Treat empty strings from .env files as unset
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${lines}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
