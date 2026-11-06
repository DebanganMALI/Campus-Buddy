import type { ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";
import type { Role } from "@scc/shared";
import { ForbiddenState, FullScreenLoading, ServerErrorState } from "../components/states";
import { useAuth } from "./auth-context";
import { safeReturnTo } from "./return-url";

/** Logged-in users only. Others go to /login and come back here afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state, refetchMe } = useAuth();
  const location = useLocation();

  if (state.status === "loading") return <FullScreenLoading />;
  if (state.status === "error") return <ServerErrorState message={state.message} onRetry={refetchMe} />;
  if (state.status === "anonymous") {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}

/**
 * Hides pages from the wrong role. This is a UI convenience only:
 * the server must still refuse the API call (403), which the demo proves with Postman.
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { state } = useAuth();
  if (state.status !== "authenticated" || !roles.includes(state.user.role)) return <ForbiddenState />;
  return <>{children}</>;
}

/** Login/register pages: a logged-in user is sent on to where they were going. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const [params] = useSearchParams();

  if (state.status === "loading") return <FullScreenLoading />;
  if (state.status === "authenticated") return <Navigate to={safeReturnTo(params.get("returnTo"))} replace />;
  return <>{children}</>;
}
