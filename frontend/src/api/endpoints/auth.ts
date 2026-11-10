import {
  loginResponse,
  meResponse,
  type LoginBody,
  type LoginResponse,
  type MeResponse,
  type RegisterBody,
} from "@scc/shared";
import { api } from "../client";

export const getMe = (signal?: AbortSignal) => api<MeResponse>("GET", "/auth/me", { signal, schema: meResponse });

export const login = (body: LoginBody) => api<LoginResponse>("POST", "/auth/login", { body, schema: loginResponse });

export const logout = () => api<void>("POST", "/auth/logout");

/** Always answers 202 with the same message, whether or not the email exists (no account enumeration). */
export const register = (body: RegisterBody) => api<{ message: string }>("POST", "/auth/register", { body });
