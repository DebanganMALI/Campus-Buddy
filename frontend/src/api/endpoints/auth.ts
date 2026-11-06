import { loginResponse, meResponse, type LoginBody, type LoginResponse, type MeResponse } from "@scc/shared";
import { api } from "../client";

export const getMe = (signal?: AbortSignal) => api<MeResponse>("GET", "/auth/me", { signal, schema: meResponse });

export const login = (body: LoginBody) => api<LoginResponse>("POST", "/auth/login", { body, schema: loginResponse });

export const logout = () => api<void>("POST", "/auth/logout");
