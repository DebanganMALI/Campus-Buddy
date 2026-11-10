import type { Request, RequestHandler } from "express";
import { hasPermission, type Permission, type Role } from "@scc/shared";
import { AppError } from "../lib/errors.js";

type Auth = NonNullable<Request["auth"]>;

/** Returns the authenticated principal, or throws 401 (use after requireAuth). */
export function getAuth(req: Request): Auth {
  if (!req.auth) throw new AppError("UNAUTHENTICATED");
  return req.auth;
}

/** Route guard: the viewer's role must hold `permission`, else 403. */
export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    const auth = getAuth(req);
    if (!hasPermission(auth.role, permission)) throw new AppError("FORBIDDEN");
    next();
  };

/**
 * Object-level check for edit/delete: `:any` lets a role touch anyone's item,
 * `:own` only their own. Throws 403 otherwise. The caller first confirms the
 * item exists (404), so this never reveals the existence of a hidden item.
 */
export function assertCanModify(
  role: Role,
  kind: "announcement" | "event" | "resource" | "opening",
  action: "update" | "delete",
  ownerId: string,
  userId: string,
): void {
  if (hasPermission(role, `${kind}:${action}:any` as Permission)) return;
  if (ownerId === userId && hasPermission(role, `${kind}:${action}:own` as Permission)) return;
  throw new AppError("FORBIDDEN");
}
