import { z } from "zod";
import { ROLES } from "../roles.js";
import { department } from "./common.js";
import { userStatus } from "./user.js";

export const userFilters = z.strictObject({
  q: z.string().max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: userStatus.optional(),
  department: department.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().max(200).optional(),
});
export type UserFilters = z.infer<typeof userFilters>;

export const setUserStatusBody = z.strictObject({
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(1).max(500),
});
export type SetUserStatusBody = z.infer<typeof setUserStatusBody>;
