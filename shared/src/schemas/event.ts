import { z } from "zod";
import { LIMITS } from "../constants.js";
import { audience, authorRef, isoDateString } from "./common.js";

export const eventStatus = z.enum(["draft", "published", "cancelled"]);

export const eventDto = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  venue: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  capacity: z.number().nullable().optional(),
  rsvpCount: z.number(),
  audience,
  status: eventStatus,
  author: authorRef,
  createdAt: z.string(),
  updatedAt: z.string(),
  bookmarked: z.boolean(),
});
export type EventDTO = z.infer<typeof eventDto>;

const eventBase = z.strictObject({
  title: z.string().trim().min(3).max(LIMITS.titleMax),
  description: z.string().min(1).max(LIMITS.bodyMax),
  venue: z.string().trim().min(1).max(LIMITS.titleMax),
  startsAt: isoDateString,
  endsAt: isoDateString,
  capacity: z.number().int().min(1).max(100_000).nullable().optional(),
  audience,
  status: z.enum(["draft", "published"]),
});

export const eventInput = eventBase.refine((e) => new Date(e.endsAt) > new Date(e.startsAt), {
  message: "endsAt must be after startsAt",
  path: ["endsAt"],
});
export type EventInput = z.infer<typeof eventInput>;

export const eventUpdate = eventBase.partial();
export type EventUpdate = z.infer<typeof eventUpdate>;

export const eventFilters = z.strictObject({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).optional(),
  cursor: z.string().max(200).optional(),
});
