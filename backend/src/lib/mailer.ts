import nodemailer from "nodemailer";
import { env, isProd, isTest } from "../config/env.js";
import { logger } from "./logger.js";

export interface Mail {
  subject: string;
  text: string;
}

// Captured instead of sent during tests
export const outbox: Array<Mail & { to: string }> = [];

// Development defaults to the local Mailpit container. Production without
// SMTP_URL runs with email disabled rather than pointing at a dev server.
const smtpUrl = env.SMTP_URL ?? (isProd ? undefined : "smtp://localhost:1025");
const transport = isTest || !smtpUrl ? null : nodemailer.createTransport(smtpUrl);

// Async on purpose so response timing never reveals whether an email was sent
export function sendMail(to: string, mail: Mail): void {
  if (isTest) {
    outbox.push({ to, ...mail });
    return;
  }
  if (!transport) {
    // Subject only: recipient addresses never go to the logs.
    logger.warn({ subject: mail.subject }, "email disabled (no SMTP_URL); message not sent");
    return;
  }
  transport
    .sendMail({ from: env.MAIL_FROM, to, subject: mail.subject, text: mail.text })
    .catch((err: Error) => logger.error({ err: err.message }, "mail send failed"));
}
