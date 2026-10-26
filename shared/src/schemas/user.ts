import { z } from "zod";
import { ROLES } from "../roles.js";
import { DEPARTMENTS } from "../constants.js";

export const userStatus = z.enum(["pending", "active", "suspended", "deleted"]);

export const userDto = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  rollNo: z.string().optional(),
  role: z.enum(ROLES),
  department: z.enum(DEPARTMENTS),
  year: z.number().optional(),
  section: z.string().optional(),
  status: userStatus,
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  avatarUrl: z.string().optional(),
  createdAt: z.string(),
});
export type UserDTO = z.infer<typeof userDto>;

export const sessionDto = z.object({
  id: z.string(),
  deviceLabel: z.string(),
  browser: z.string(),
  os: z.string(),
  approxLocation: z.string().optional(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  current: z.boolean(),
});
export type SessionDTO = z.infer<typeof sessionDto>;
