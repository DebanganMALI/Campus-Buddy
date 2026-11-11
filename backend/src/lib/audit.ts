import type { Request } from "express";
import { AuditLog } from "@scc/db";
import { hashIp } from "./crypto.js";
import { logger } from "./logger.js";

interface AuditInput {
  action: string; // e.g. "auth.login", "admin.user.suspend"
  result: "success" | "denied" | "failure";
  actorId?: string | null;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

// Fire-and-forget audit write. It never blocks the request and never throws —
// a failed audit is logged but must not break the user-facing operation. The
// collection is append-only (enforced in the model) and IPs are stored only as
// a keyed hash, never in the clear.
export function audit(req: Request, input: AuditInput): void {
  const entry = {
    action: input.action,
    result: input.result,
    actorId: input.actorId ?? req.auth?.userId ?? null,
    actorRole: input.actorRole ?? req.auth?.role,
    targetType: input.targetType,
    targetId: input.targetId,
    ipHash: hashIp(req.ip ?? "unknown"),
    userAgent: req.get("user-agent")?.slice(0, 300),
    requestId: String(req.id),
    meta: input.meta,
  };
  void AuditLog.create(entry).catch((err: unknown) => {
    logger.warn({ err, action: input.action }, "audit write failed");
  });
}
