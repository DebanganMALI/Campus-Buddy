import { z } from "zod";
import { DEPARTMENTS, LIMITS, YEARS } from "../constants.js";

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
