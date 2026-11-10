import { z } from "zod";
import { DEPARTMENTS, LIMITS, YEARS } from "../constants.js";
import { ROLES } from "../roles.js";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
export const email = z
  .email("Enter a valid email")
  .max(LIMITS.emailMax)
  .transform((v) => v.trim().toLowerCase());
export const password = z
  .string()
  .min(LIMITS.passwordMin, `Use at least ${LIMITS.passwordMin} characters`)
  .max(LIMITS.passwordMax);
export const name = z.string().trim().min(LIMITS.nameMin).max(LIMITS.nameMax);
export const department = z.enum(DEPARTMENTS);
export const year = z.literal([...YEARS]);
export const opaqueToken = z
  .string()
  .min(20)
  .max(200)
  .regex(/^[A-Za-z0-9_.-]+$/);
export const totpCode = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export const pageQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).default(LIMITS.pageSizeDefault),
  cursor: z.string().max(200).optional(),
});

// ---- Content contract additions ----

/** ISO-8601 UTC timestamp string (AGENTS.md §5.2). */
export const isoDateString = z.iso.datetime();

/** Minimal author reference embedded in content DTOs. */
export const authorRef = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
});
export type AuthorRef = z.infer<typeof authorRef>;

/** Who a piece of content targets: specific departments/years, or "ALL". */
export const audience = z.strictObject({
  departments: z.array(z.union([department, z.literal("ALL")])).min(1).max(30),
  years: z.array(z.union([year, z.literal("ALL")])).min(1).max(YEARS.length),
});
export type Audience = z.infer<typeof audience>;

export const contentType = z.enum(["announcement", "event", "resource", "opening"]);
export type ContentType = z.infer<typeof contentType>;

/** Wraps a DTO schema into the standard `{ items, nextCursor }` list shape. */
export const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });
