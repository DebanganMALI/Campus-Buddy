import { z } from "zod";
import { LIMITS } from "../constants.js";
import { authorRef, department, year } from "./common.js";

export const resourceMime = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const resourceStatus = z.enum([
  "awaiting_upload",
  "pending_scan",
  "pending_review",
  "published",
  "rejected",
  "infected",
]);

export const resourceDto = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  department,
  year,
  semester: z.number(),
  subject: z.string(),
  file: z.object({ name: z.string(), mimeType: resourceMime, size: z.number() }),
  status: resourceStatus,
  version: z.number(),
  uploadedBy: authorRef,
  createdAt: z.string(),
  updatedAt: z.string(),
  bookmarked: z.boolean(),
});
export type ResourceDTO = z.infer<typeof resourceDto>;

export const uploadUrlInput = z.strictObject({
  title: z.string().trim().min(3).max(LIMITS.titleMax),
  description: z.string().max(2000).optional(),
  department,
  year,
  semester: z.number().int().min(1).max(10),
  subject: z.string().trim().min(2).max(80),
  fileName: z.string().min(1).max(200),
  mimeType: resourceMime,
  size: z.number().int().min(1).max(LIMITS.fileMaxBytes),
});
export type UploadUrlInput = z.infer<typeof uploadUrlInput>;

export const uploadUrlResponse = z.object({
  resourceId: z.string(),
  uploadUrl: z.string(),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
});
export type UploadUrlResponse = z.infer<typeof uploadUrlResponse>;

export const resourceFilters = z.strictObject({
  department: department.optional(),
  year: z.coerce.number().int().min(1).max(5).optional(),
  semester: z.coerce.number().int().min(1).max(10).optional(),
  subject: z.string().max(80).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).optional(),
  cursor: z.string().max(200).optional(),
});
