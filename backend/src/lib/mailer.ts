import nodemailer from "nodemailer";
import { env, isTest } from "../config/env.js";
import { logger } from "./logger.js";

export interface Mail {
  subject: string;
  text: string;
}

// Captured instead of sent during tests
export const outbox: Array<Mail & { to: string }> = [];

const transport = isTest ? null : nodemailer.createTransport(env.SMTP_URL ?? "smtp://localhost:1025");

// Async on purpose so response timing never reveals whether an email was sent
export function sendMail(to: string, mail: Mail): void {
  if (!transport) {
    outbox.push({ to, ...mail });
    return;
  }
  transport
    .sendMail({ from: env.MAIL_FROM, to, subject: mail.subject, text: mail.text })
    .catch((err: Error) => logger.error({ err: err.message }, "mail send failed"));
}
