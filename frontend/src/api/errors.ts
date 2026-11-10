import type { ErrorCode } from "@scc/shared";

export interface FieldIssue {
  path: string;
  message: string;
}

/** Every failed API call becomes one of these, so pages handle errors in one way. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | "NETWORK_ERROR";
  readonly requestId: string | undefined;
  readonly issues: FieldIssue[] | undefined;
  readonly retryAfter: number | undefined;

  constructor(
    status: number,
    code: ErrorCode | "NETWORK_ERROR",
    message: string,
    extra: { requestId?: string; issues?: FieldIssue[]; retryAfter?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = extra.requestId;
    this.issues = extra.issues;
    this.retryAfter = extra.retryAfter;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
