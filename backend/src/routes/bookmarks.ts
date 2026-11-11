import { Router } from "express";
import { z } from "zod";
import { Types, type Model } from "mongoose";
import { bookmarkBody, contentType, objectId, type ContentType } from "@scc/shared";
import { Announcement, Bookmark, Event, Opening, Resource, paginate } from "@scc/db";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { getAuth, requirePermission } from "../middleware/authorize.js";
import {
  loadAuthors,
  toAnnouncementDto,
  toEventDto,
  toOpeningDto,
  toResourceDto,
  type AnnouncementRecord,
  type EventRecord,
  type OpeningRecord,
  type ResourceRecord,
} from "../lib/content-dto.js";
import { visibleFilter, type Viewer } from "../lib/visible.js";
import type {
  AnnouncementDTO,
  BookmarkItem,
  EventDTO,
  OpeningDTO,
  ResourceDTO,
} from "@scc/shared";

export const bookmarksRouter: Router = Router();
bookmarksRouter.use(requireAuth);

interface BookmarkRecord {
  _id: Types.ObjectId;
  itemType: ContentType;
  itemId: Types.ObjectId;
  createdAt: Date;
}

const listQuery = z.strictObject({
  type: z.union([contentType, z.literal("")]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const idParams = z.object({ itemType: contentType, itemId: objectId });

// GET /api/bookmarks — the viewer's saved items, newest first. Items the viewer
// can no longer see (unpublished, out of scope, deleted) are silently dropped.
bookmarksRouter.get("/", requirePermission("bookmark:manage"), async (req, res) => {
  const auth = getAuth(req);
  const { type, cursor, limit } = listQuery.parse(req.query);
  const now = new Date();
  const viewer: Viewer = { role: auth.role, department: auth.department, year: auth.year };

  const filter: Record<string, unknown> = { userId: new Types.ObjectId(auth.userId) };
  if (type) filter.itemType = type;

  const { items: rows, nextCursor } = await paginate<BookmarkRecord>(
    Bookmark as unknown as Model<BookmarkRecord>,
    filter,
    { sortField: "createdAt", direction: -1, limit: limit ?? 20, cursor: cursor ?? null },
  );

  const idsByType: Record<ContentType, Types.ObjectId[]> = {
    announcement: [],
    event: [],
    resource: [],
    opening: [],
  };
  for (const r of rows) idsByType[r.itemType].push(r.itemId);

  const annMap = new Map<string, AnnouncementDTO>();
  const evtMap = new Map<string, EventDTO>();
  const resMap = new Map<string, ResourceDTO>();
  const opnMap = new Map<string, OpeningDTO>();

  if (idsByType.announcement.length) {
    const found = await (Announcement as unknown as Model<AnnouncementRecord>)
      .find({ ...visibleFilter("announcement", viewer, now), _id: { $in: idsByType.announcement } })
      .lean<AnnouncementRecord[]>();
    const authors = await loadAuthors(found.map((i) => i.authorId));
    const marks = new Set(found.map((i) => String(i._id)));
    for (const i of found) annMap.set(String(i._id), toAnnouncementDto(i, authors, marks));
  }
  if (idsByType.event.length) {
    const found = await (Event as unknown as Model<EventRecord>)
      .find({ ...visibleFilter("event", viewer, now), _id: { $in: idsByType.event } })
      .lean<EventRecord[]>();
    const authors = await loadAuthors(found.map((i) => i.authorId));
    const marks = new Set(found.map((i) => String(i._id)));
    for (const i of found) evtMap.set(String(i._id), toEventDto(i, authors, marks));
  }
  if (idsByType.resource.length) {
    const found = await (Resource as unknown as Model<ResourceRecord>)
      .find({ ...visibleFilter("resource", viewer, now), _id: { $in: idsByType.resource } })
      .lean<ResourceRecord[]>();
    const authors = await loadAuthors(found.map((i) => i.uploadedBy));
    const marks = new Set(found.map((i) => String(i._id)));
    for (const i of found) resMap.set(String(i._id), toResourceDto(i, authors, marks));
  }
  if (idsByType.opening.length) {
    const found = await (Opening as unknown as Model<OpeningRecord>)
      .find({ ...visibleFilter("opening", viewer, now), _id: { $in: idsByType.opening } })
      .lean<OpeningRecord[]>();
    const authors = await loadAuthors(found.map((i) => i.postedBy));
    const marks = new Set(found.map((i) => String(i._id)));
    for (const i of found) opnMap.set(String(i._id), toOpeningDto(i, authors, marks));
  }

  const items: BookmarkItem[] = [];
  for (const r of rows) {
    const id = String(r.itemId);
    const createdAt = r.createdAt.toISOString();
    if (r.itemType === "announcement") {
      const item = annMap.get(id);
      if (item) items.push({ itemType: "announcement", itemId: id, createdAt, item });
    } else if (r.itemType === "event") {
      const item = evtMap.get(id);
      if (item) items.push({ itemType: "event", itemId: id, createdAt, item });
    } else if (r.itemType === "resource") {
      const item = resMap.get(id);
      if (item) items.push({ itemType: "resource", itemId: id, createdAt, item });
    } else {
      const item = opnMap.get(id);
      if (item) items.push({ itemType: "opening", itemId: id, createdAt, item });
    }
  }

  res.json({ items, nextCursor });
});

// Confirm the referenced item exists and is visible to the viewer, so a user
// can't bookmark (and thereby probe for) something they cannot see.
async function itemIsVisible(type: ContentType, itemId: string, viewer: Viewer, now: Date): Promise<boolean> {
  const where = { ...visibleFilter(type, viewer, now), _id: itemId };
  const model = { announcement: Announcement, event: Event, resource: Resource, opening: Opening }[type];
  const hit = await (model as unknown as Model<{ _id: Types.ObjectId }>)
    .findOne(where)
    .select("_id")
    .lean();
  return hit !== null;
}

// POST /api/bookmarks — save an item (idempotent).
bookmarksRouter.post("/", requirePermission("bookmark:manage"), async (req, res) => {
  const auth = getAuth(req);
  const { itemType, itemId } = bookmarkBody.parse(req.body);
  if (!(await itemIsVisible(itemType, itemId, { role: auth.role, department: auth.department, year: auth.year }, new Date())))
    throw new AppError("NOT_FOUND");

  await Bookmark.updateOne(
    { userId: new Types.ObjectId(auth.userId), itemType, itemId: new Types.ObjectId(itemId) },
    { $setOnInsert: { userId: new Types.ObjectId(auth.userId), itemType, itemId: new Types.ObjectId(itemId) } },
    { upsert: true },
  );
  res.status(201).json({ status: "OK" });
});

// DELETE /api/bookmarks/:itemType/:itemId — remove a saved item.
bookmarksRouter.delete("/:itemType/:itemId", requirePermission("bookmark:manage"), async (req, res) => {
  const auth = getAuth(req);
  const { itemType, itemId } = idParams.parse(req.params);
  await Bookmark.deleteOne({
    userId: new Types.ObjectId(auth.userId),
    itemType,
    itemId: new Types.ObjectId(itemId),
  });
  res.status(204).end();
});
