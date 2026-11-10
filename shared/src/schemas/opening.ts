import { z } from "zod";
import { LIMITS } from "../constants.js";
import { authorRef, department, isoDateString, year } from "./common.js";

export const openingType = z.enum(["job", "internship"]);
export const openingStatus = z.enum(["draft", "published", "closed"]);

export const eligibility = z.strictObject({
  departments: z.array(z.union([department, z.literal("ALL")])).min(1).max(30),
  years: z.array(z.union([year, z.literal("ALL")])).min(1).max(5),
  minCgpa: z.number().min(0).max(10).nullable().optional(),
});

export const openingDto = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  type: openingType,
  description: z.string(),
  location: z.string().optional(),
  compensation: z.string().optional(),
  eligibility,
  closesAt: z.string(),
  applyUrl: z.string(),
  postedBy: authorRef,
  createdAt: z.string(),
  updatedAt: z.string(),
  bookmarked: z.boolean(),
});
export type OpeningDTO = z.infer<typeof openingDto>;

const openingBase = z.strictObject({
  title: z.string().trim().min(3).max(LIMITS.titleMax),
  company: z.string().trim().min(1).max(100),
  type: openingType,
  description: z.string().min(1).max(LIMITS.bodyMax),
  location: z.string().max(100).optional(),
  compensation: z.string().max(100).optional(),
  eligibility,
  closesAt: isoDateString,
  applyUrl: z.url().max(500).refine((u) => u.startsWith("https://"), "Must be an https link"),
});

export const openingInput = openingBase;
export type OpeningInput = z.infer<typeof openingInput>;

export const openingUpdate = openingBase.partial();
export type OpeningUpdate = z.infer<typeof openingUpdate>;

export const openingFilters = z.strictObject({
  type: z.union([openingType, z.literal("")]).optional(),
  department: department.optional(),
  year: z.coerce.number().int().min(1).max(5).optional(),
  closingWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).optional(),
  cursor: z.string().max(200).optional(),
});
