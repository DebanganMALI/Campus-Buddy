import { Router } from "express";
import { z } from "zod";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { eventFilters, eventInput, eventUpdate, objectId } from "@scc/shared";
import { Event, paginate, viewerKeys } from "@scc/db";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCanModify, getAuth, requirePermission } from "../middleware/authorize.js";
import { bookmarkedSet, loadAuthors, toEventDto, type EventRecord } from "../lib/content-dto.js";

export const eventsRouter: Router = Router();
eventsRouter.use(requireAuth);

const idParam = z.object({ id: objectId });

// GET /api/events — upcoming-first; the frontend splits upcoming/past itself.
eventsRouter.get("/", async (req, res) => {
  const auth = getAuth(req);
  const f = eventFilters.parse(req.query);

  const filter: Record<string, unknown> = { deletedAt: null };
  if (auth.role === "student") {
    filter.status = "published";
    filter.audienceKeys = { $in: viewerKeys(auth.department, auth.year) };
  } else {
    filter.status = { $ne: "cancelled" };
  }
  if (f.q) filter.$text = { $search: f.q };

  const { items, nextCursor } = await paginate<EventRecord>(
    Event as unknown as Model<EventRecord>,
    filter,
    { sortField: "startsAt", direction: 1, limit: f.limit ?? 20, cursor: f.cursor ?? null },
  );
  const authors = await loadAuthors(items.map((i) => i.authorId));
  const marks = await bookmarkedSet(auth.userId, "event", items.map((i) => i._id));
  res.json({ items: items.map((i) => toEventDto(i, authors, marks)), nextCursor });
});

// GET /api/events/:id
eventsRouter.get("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);

  const base: Record<string, unknown> = { _id: id, deletedAt: null };
  if (auth.role === "student") {
    base.status = "published";
    base.audienceKeys = { $in: viewerKeys(auth.department, auth.year) };
  }
  const doc = await Event.findOne(base).lean<EventRecord | null>();
  if (!doc) throw new AppError("NOT_FOUND");

  const authors = await loadAuthors([doc.authorId]);
  const marks = await bookmarkedSet(auth.userId, "event", [doc._id]);
  res.json(toEventDto(doc, authors, marks));
});

// POST /api/events — faculty/moderator/placement_officer/admin.
eventsRouter.post("/", requirePermission("event:create"), async (req, res) => {
  const auth = getAuth(req);
  const body = eventInput.parse(req.body);
  const doc = await Event.create({
    title: body.title,
    description: body.description,
    venue: body.venue,
    startsAt: new Date(body.startsAt),
    endsAt: new Date(body.endsAt),
    capacity: body.capacity ?? null,
    audience: body.audience,
    status: body.status,
    authorId: new Types.ObjectId(auth.userId),
  });
  const lean = doc.toObject() as unknown as EventRecord;
  const authors = await loadAuthors([lean.authorId]);
  res.status(201).json(toEventDto(lean, authors, new Set()));
});

// PATCH /api/events/:id — owner or admin.
eventsRouter.patch("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const body = eventUpdate.parse(req.body);

  const doc = await Event.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND");
  assertCanModify(auth.role, "event", "update", String(doc.authorId), auth.userId);

  if (body.title !== undefined) doc.title = body.title;
  if (body.description !== undefined) doc.description = body.description;
  if (body.venue !== undefined) doc.venue = body.venue;
  if (body.startsAt !== undefined) doc.startsAt = new Date(body.startsAt);
  if (body.endsAt !== undefined) doc.endsAt = new Date(body.endsAt);
  if (body.capacity !== undefined) doc.capacity = body.capacity ?? null;
  if (body.audience !== undefined) doc.audience = body.audience;
  if (body.status !== undefined) doc.status = body.status;
  await doc.save();

  const lean = doc.toObject() as unknown as EventRecord;
  const authors = await loadAuthors([lean.authorId]);
  const marks = await bookmarkedSet(auth.userId, "event", [lean._id]);
  res.json(toEventDto(lean, authors, marks));
});

// DELETE /api/events/:id — soft delete, owner or admin.
eventsRouter.delete("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const doc = await Event.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND");
  assertCanModify(auth.role, "event", "delete", String(doc.authorId), auth.userId);
  doc.deletedAt = new Date();
  await doc.save();
  res.status(204).end();
});
