import { z } from "zod";
import { contentType, objectId } from "./common.js";
import { announcementDto } from "./announcement.js";
import { eventDto } from "./event.js";
import { resourceDto } from "./resource.js";
import { openingDto } from "./opening.js";

export const bookmarkBody = z.strictObject({
  itemType: contentType,
  itemId: objectId,
});
export type BookmarkBody = z.infer<typeof bookmarkBody>;

// A saved item carries the kind, the id, when it was saved, and the item itself.
export const bookmarkItem = z.discriminatedUnion("itemType", [
  z.object({ itemType: z.literal("announcement"), itemId: z.string(), createdAt: z.string(), item: announcementDto }),
  z.object({ itemType: z.literal("event"), itemId: z.string(), createdAt: z.string(), item: eventDto }),
  z.object({ itemType: z.literal("resource"), itemId: z.string(), createdAt: z.string(), item: resourceDto }),
  z.object({ itemType: z.literal("opening"), itemId: z.string(), createdAt: z.string(), item: openingDto }),
]);
export type BookmarkItem = z.infer<typeof bookmarkItem>;
