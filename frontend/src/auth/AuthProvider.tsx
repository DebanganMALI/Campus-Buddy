import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission, type Permission } from "@scc/shared";
import { csrf } from "../api/csrf";
import { getMe, logout as logoutRequest } from "../api/endpoints/auth";
import { isApiError } from "../api/errors";
import { AuthContext, type AuthState } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const queryClient = useQueryClient();

  // Ask the server who we are. The answer comes from the httpOnly cookie, not from JS storage.
  const refetchMe = useCallback(async () => {
    try {
      const me = await getMe();
      setState({ status: "authenticated", user: me.user, permissions: me.permissions });
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        setState({ status: "anonymous" });
        return;
      }
      setState({ status: "error", message: isApiError(e) ? e.message : "Something went wrong." });
    }
  }, []);

  useEffect(() => {
    void refetchMe();
  }, [refetchMe]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // Clear everything personal from memory even if the request failed
      queryClient.clear();
      csrf.clear();
      setState({ status: "anonymous" });
    }
  }, [queryClient]);

  const can = useCallback(
    (permission: Permission) => state.status === "authenticated" && hasPermission(state.user.role, permission),
    [state],
  );

  const value = useMemo(() => ({ state, can, refetchMe, logout }), [state, can, refetchMe, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
