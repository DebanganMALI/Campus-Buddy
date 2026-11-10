/**
 * Only allow returnTo paths on our own site. Blocks open redirects like
 * "//evil.com", "/\evil.com", "https://evil.com" and "javascript:...".
 */
export function safeReturnTo(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    if (url.pathname.startsWith("/login")) return fallback; // never bounce back to login
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
