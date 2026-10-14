import { pino } from "pino";
import { env, isTest } from "../config/env.js";

export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  base: { service: "scc-backend" },
  redact: {
    censor: "[redacted]",
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      "*.password",
      "*.newPassword",
      "*.currentPassword",
      "*.code",
      "*.recoveryCode",
      "*.token",
      "*.secret",
      "*.challengeId",
      "*.turnstileToken",
    ],
  },
});
