import type { Permission } from "@scc/shared";
import { useAuth } from "./auth-context";

/**
 * Mirrors the own/any rule in shared/permissions.ts so we only SHOW edit/delete
 * where the server would allow it. The server still decides on every request.
 */
export function useCanChange(kind: "announcement" | "event" | "resource", ownerId: string | undefined) {
  const { state, can } = useAuth();
  const me = state.status === "authenticated" ? state.user.id : null;
  const own = (action: "update" | "delete") =>
    can(`${kind}:${action}:any` as Permission) || (can(`${kind}:${action}:own` as Permission) && ownerId === me);
  return { canEdit: own("update"), canDelete: own("delete") };
}
