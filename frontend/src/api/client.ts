import { ERROR_MESSAGES, HEADERS, type ErrorCode } from "@scc/shared";
import { csrf } from "./csrf";
import { ApiError, type FieldIssue } from "./errors";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const UNSAFE = new Set<Method>(["POST", "PUT", "PATCH", "DELETE"]);
const TIMEOUT_MS = 15_000;

interface Schema<T> {
  parse: (value: unknown) => T;
}

async function send(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = csrf.get();
  // Changing requests carry the CSRF token; the server compares it with its cookie
  if (UNSAFE.has(method) && token) headers[HEADERS.csrf] = token;

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: "same-origin", // auth cookies are httpOnly; JS never sees the tokens
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (e) {
    if (signal?.aborted) throw e; // the caller cancelled on purpose
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }

  // The server rotates the CSRF token after login, logout and refresh
  const next = res.headers.get(HEADERS.csrf);
  if (next) csrf.set(next);
  return res;
}

async function toError(res: Response): Promise<ApiError> {
  const data = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
    requestId?: string;
    issues?: FieldIssue[];
  };
  // No error code means the reply did not come from our API (e.g. the backend is not running)
  if (!data.code) {
    return new ApiError(res.status, "INTERNAL_ERROR", `The server sent an unexpected reply (HTTP ${res.status}). Is the API running?`, {
      requestId: res.headers.get(HEADERS.requestId) ?? undefined,
    });
  }
  const code = data.code as ErrorCode;
  return new ApiError(res.status, code, data.message ?? ERROR_MESSAGES[code] ?? "Something went wrong.", {
    requestId: data.requestId ?? res.headers.get(HEADERS.requestId) ?? undefined,
    issues: data.issues,
    retryAfter: Number(res.headers.get("Retry-After")) || undefined,
  });
}

export async function fetchCsrf(): Promise<void> {
  const res = await send("GET", "/auth/csrf");
  if (!res.ok) throw await toError(res);
  const data = (await res.json().catch(() => null)) as { csrfToken?: string } | null;
  if (data?.csrfToken) csrf.set(data.csrfToken);
}

/**
 * The only way pages talk to the backend.
 * In development, responses are checked against the shared schema to catch contract drift early.
 */
export async function api<T>(
  method: Method,
  path: string,
  opts: { body?: unknown; signal?: AbortSignal; schema?: Schema<T> } = {},
  retried = false,
): Promise<T> {
  if (UNSAFE.has(method) && !csrf.get()) await fetchCsrf();

  const res = await send(method, path, opts.body, opts.signal);
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const json: unknown = await res.json().catch(() => undefined);
    return import.meta.env.DEV && opts.schema ? opts.schema.parse(json) : (json as T);
  }

  const err = await toError(res);
  // The token may have expired or rotated in another tab: get a fresh one and retry once
  if (err.code === "CSRF_INVALID" && !retried) {
    csrf.clear();
    await fetchCsrf();
    return api<T>(method, path, opts, true);
  }
  throw err;
}
