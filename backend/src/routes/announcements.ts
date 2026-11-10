import { Router } from "express";
import { z } from "zod";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { announcementFilters, announcementInput, announcementUpdate, objectId } from "@scc/shared";
import { Announcement, paginate, viewerKeys } from "@scc/db";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCanModify, getAuth, requirePermission } from "../middleware/authorize.js";
import { bookmarkedSet, loadAuthors, toAnnouncementDto, type AnnouncementRecord } from "../lib/content-dto.js";

export const announcementsRouter: Router = Router();
announcementsRouter.use(requireAuth);

const idParam = z.object({ id: objectId });

// GET /api/announcements — visibility-scoped, filtered, cursor-paginated feed.
announcementsRouter.get("/", async (req, res) => {
  const auth = getAuth(req);
  const f = announcementFilters.parse(req.query);
  const now = new Date();

  const filter: Record<string, unknown> = { deletedAt: null };
  if (auth.role === "student") {
    filter.status = "published";
    filter.audienceKeys = { $in: viewerKeys(auth.department, auth.year) };
    filter.publishAt = { $lte: now };
    filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
  } else {
    filter.status = f.status ?? "published";
  }
  if (typeof f.pinned === "boolean") filter.pinned = f.pinned;
  if (f.q) filter.$text = { $search: f.q };

  const { items, nextCursor } = await paginate<AnnouncementRecord>(
    Announcement as unknown as Model<AnnouncementRecord>,
    filter,
    { sortField: "publishAt", direction: -1, limit: f.limit ?? 20, cursor: f.cursor ?? null },
  );
  const authors = await loadAuthors(items.map((i) => i.authorId));
  const marks = await bookmarkedSet(auth.userId, "announcement", items.map((i) => i._id));
  res.json({ items: items.map((i) => toAnnouncementDto(i, authors, marks)), nextCursor });
});

// GET /api/announcements/:id
announcementsRouter.get("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const now = new Date();

  const base: Record<string, unknown> = { _id: id, deletedAt: null };
  if (auth.role === "student") {
    base.status = "published";
    base.audienceKeys = { $in: viewerKeys(auth.department, auth.year) };
    base.publishAt = { $lte: now };
    base.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
  }
  const doc = await Announcement.findOne(base).lean<AnnouncementRecord | null>();
  if (!doc) throw new AppError("NOT_FOUND");

  const authors = await loadAuthors([doc.authorId]);
  const marks = await bookmarkedSet(auth.userId, "announcement", [doc._id]);
  res.json(toAnnouncementDto(doc, authors, marks));
});

// POST /api/announcements — faculty/moderator/admin only.
announcementsRouter.post("/", requirePermission("announcement:create"), async (req, res) => {
  const auth = getAuth(req);
  const body = announcementInput.parse(req.body);
  const doc = await Announcement.create({
    title: body.title,
    body: body.body,
    audience: body.audience,
    status: body.status,
    pinned: body.pinned,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    authorId: new Types.ObjectId(auth.userId),
  });
  const lean = doc.toObject() as unknown as AnnouncementRecord;
  const authors = await loadAuthors([lean.authorId]);
  res.status(201).json(toAnnouncementDto(lean, authors, new Set()));
});

// PATCH /api/announcements/:id — owner or admin.
announcementsRouter.patch("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const body = announcementUpdate.parse(req.body);

  const doc = await Announcement.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND");
  assertCanModify(auth.role, "announcement", "update", String(doc.authorId), auth.userId);

  if (body.title !== undefined) doc.title = body.title;
  if (body.body !== undefined) doc.body = body.body;
  if (body.audience !== undefined) doc.audience = body.audience;
  if (body.status !== undefined) doc.status = body.status;
  if (body.pinned !== undefined) doc.pinned = body.pinned;
  if (body.expiresAt !== undefined) doc.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  await doc.save();

  const lean = doc.toObject() as unknown as AnnouncementRecord;
  const authors = await loadAuthors([lean.authorId]);
  const marks = await bookmarkedSet(auth.userId, "announcement", [lean._id]);
  res.json(toAnnouncementDto(lean, authors, marks));
});

// DELETE /api/announcements/:id — soft delete, owner or admin.
announcementsRouter.delete("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const doc = await Announcement.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND");
  assertCanModify(auth.role, "announcement", "delete", String(doc.authorId), auth.userId);
  doc.deletedAt = new Date();
  await doc.save();
  res.status(204).end();
});
