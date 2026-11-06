export type FieldErrors = Record<string, string>;

/** Turns validation issues (from Zod in the browser, or from the server) into one message per field. */
export function toFieldErrors(
  issues: ReadonlyArray<{ path: string | ReadonlyArray<PropertyKey>; message: string }>,
): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = typeof issue.path === "string" ? issue.path : issue.path.map(String).join(".");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}
