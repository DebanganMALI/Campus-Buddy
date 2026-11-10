import { createContext, useContext } from "react";
import type { Permission, UserDTO } from "@scc/shared";

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "error"; message: string }
  | { status: "authenticated"; user: UserDTO; permissions: string[] };

export interface AuthContextValue {
  state: AuthState;
  /** UI convenience only (hide buttons). The server still checks every request. */
  can: (permission: Permission) => boolean;
  refetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
