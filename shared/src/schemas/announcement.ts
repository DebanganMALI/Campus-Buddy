import { z } from "zod";
import { LIMITS } from "../constants.js";
import { audience, authorRef, department, isoDateString } from "./common.js";

export const announcementStatus = z.enum(["draft", "scheduled", "published", "archived"]);

export const announcementDto = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  audience,
  status: announcementStatus,
  publishAt: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
  pinned: z.boolean(),
  author: authorRef,
  createdAt: z.string(),
  updatedAt: z.string(),
  bookmarked: z.boolean(),
});
export type AnnouncementDTO = z.infer<typeof announcementDto>;

export const announcementInput = z.strictObject({
  title: z.string().trim().min(3).max(LIMITS.titleMax),
  body: z.string().min(1).max(LIMITS.bodyMax),
  audience,
  status: z.enum(["draft", "published"]),
  pinned: z.boolean(),
  expiresAt: isoDateString.nullable().optional(),
});
export type AnnouncementInput = z.infer<typeof announcementInput>;

export const announcementUpdate = announcementInput.partial();
export type AnnouncementUpdate = z.infer<typeof announcementUpdate>;

export const announcementFilters = z.strictObject({
  q: z.string().max(100).optional(),
  department: department.optional(),
  year: z.coerce.number().int().min(1).max(5).optional(),
  pinned: z.stringbool().optional(),
  status: announcementStatus.optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).optional(),
  cursor: z.string().max(200).optional(),
});
