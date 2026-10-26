import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode } from "@scc/shared";

export interface Issue {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly extra: { retryAfter?: number; issues?: Issue[] } = {},
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.status = ERROR_STATUS[code];
  }
}

export const fieldError = (path: string, message: string): AppError =>
  new AppError("VALIDATION_ERROR", message, { issues: [{ path, message }] });
