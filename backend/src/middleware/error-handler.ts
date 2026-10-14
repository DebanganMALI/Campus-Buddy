import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../lib/errors.js";

interface ZodLike {
  name: string;
  issues: Array<{ path: PropertyKey[]; message: string }>;
}

const isZodError = (e: unknown): e is ZodLike =>
  e instanceof Error && e.name === "ZodError" && Array.isArray((e as Partial<ZodLike>).issues);

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isZodError(err)) {
    const issues = err.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
    return new AppError("VALIDATION_ERROR", undefined, { issues });
  }
  const type = (err as { type?: string } | null)?.type;
  if (type === "entity.too.large") return new AppError("PAYLOAD_TOO_LARGE");
  if (type === "entity.parse.failed" || type === "encoding.unsupported")
    return new AppError("VALIDATION_ERROR", "Malformed request body.");
  if ((err as { code?: number } | null)?.code === 11000) return new AppError("CONFLICT");
  return new AppError("INTERNAL_ERROR");
}

export const notFound: RequestHandler = () => {
  throw new AppError("NOT_FOUND");
};

// Never leaks stack traces or internals; full error stays in server logs
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express needs 4 args to detect an error handler
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const e = toAppError(err);
  if (e.status >= 500) req.log?.error({ err }, "request failed");
  if (e.extra.retryAfter) res.setHeader("Retry-After", String(e.extra.retryAfter));
  res.status(e.status).json({
    code: e.code,
    message: e.message,
    requestId: req.id,
    ...(e.extra.issues ? { issues: e.extra.issues } : {}),
  });
};
