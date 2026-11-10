import { z } from "zod";
import { announcementDto } from "./announcement.js";
import { eventDto } from "./event.js";
import { resourceDto } from "./resource.js";
import { openingDto } from "./opening.js";

export const searchQuery = z.strictObject({
  q: z.string().trim().min(2).max(100),
  types: z.string().max(100).optional(), // comma-separated content types
  limit: z.coerce.number().int().min(1).max(20).optional(),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const searchResults = z.object({
  announcements: z.array(announcementDto),
  events: z.array(eventDto),
  resources: z.array(resourceDto),
  openings: z.array(openingDto),
});
export type SearchResults = z.infer<typeof searchResults>;
