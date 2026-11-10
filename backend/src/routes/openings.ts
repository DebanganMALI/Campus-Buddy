import { Router } from "express";
import { z } from "zod";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { objectId, openingFilters, openingInput, openingUpdate } from "@scc/shared";
import { Opening, paginate, viewerKeys } from "@scc/db";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCanModify, getAuth, requirePermission } from "../middleware/authorize.js";
import { bookmarkedSet, loadAuthors, toOpeningDto, type OpeningRecord } from "../lib/content-dto.js";

export const openingsRouter: Router = Router();
openingsRouter.use(requireAuth);

const idParam = z.object({ id: objectId });

// GET /api/openings — eligibility-scoped, closing-soonest first.
openingsRouter.get("/", async (req, res) => {
  const auth = getAuth(req);
  const f = openingFilters.parse(req.query);
  const now = new Date();

  const filter: Record<string, unknown> = { deletedAt: null, status: "published" };
  if (auth.role === "student") {
    filter.eligibilityKeys = { $in: viewerKeys(auth.department, auth.year) };
    filter.closesAt = { $gte: now };
  }
  if (f.type) filter.type = f.type;
  if (typeof f.closingWithinDays === "number") {
    filter.closesAt = { $gte: now, $lte: new Date(now.getTime() + f.closingWithinDays * 86_400_000) };
  }
  if (f.q) filter.$text = { $search: f.q };

  const { items, nextCursor } = await paginate<OpeningRecord>(
    Opening as unknown as Model<OpeningRecord>,
    filter,
    { sortField: "closesAt", direction: 1, limit: f.limit ?? 20, cursor: f.cursor ?? null },
  );
  const authors = await loadAuthors(items.map((i) => i.postedBy));
  const marks = await bookmarkedSet(auth.userId, "opening", items.map((i) => i._id));
  res.json({ items: items.map((i) => toOpeningDto(i, authors, marks)), nextCursor });
});

// GET /api/openings/:id
openingsRouter.get("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const base: Record<string, unknown> = { _id: id, deletedAt: null };
  if (auth.role === "student") {
    base.status = "published";
    base.eligibilityKeys = { $in: viewerKeys(auth.department, auth.year) };
  }
  const doc = await Opening.findOne(base).lean<OpeningRecord | null>();
  if (!doc) throw new AppError("NOT_FOUND");
  const authors = await loadAuthors([doc.postedBy]);
  const marks = await bookmarkedSet(auth.userId, "opening", [doc._id]);
  res.json(toOpeningDto(doc, authors, marks));
});

// POST /api/openings — placement officer or admin.
openingsRouter.post("/", requirePermission("opening:create"), async (req, res) => {
  const auth = getAuth(req);
  const body = openingInput.parse(req.body);
  const doc = await Opening.create({
    title: body.title,
    company: body.company,
    type: body.type,
    description: body.description,
    location: body.location,
    compensation: body.compensation,
    eligibility: body.eligibility,
    closesAt: new Date(body.closesAt),
    applyUrl: body.applyUrl,
    status: "published",
    postedBy: new Types.ObjectId(auth.userId),
  });
  const lean = doc.toObject() as unknown as OpeningRecord;
  const authors = await loadAuthors([lean.postedBy]);
  res.status(201).json(toOpeningDto(lean, authors, new Set()));
});

// PATCH /api/openings/:id — owner or admin.
openingsRouter.patch("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const body = openingUpdate.parse(req.body);

  const doc = await Opening.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND");
  assertCanModify(auth.role, "opening", "update", String(doc.postedBy), auth.userId);

  if (body.title !== undefined) doc.title = body.title;
  if (body.company !== undefined) doc.company = body.company;
  if (body.type !== undefined) doc.type = body.type;
  if (body.description !== undefined) doc.description = body.description;
  if (body.location !== undefined) doc.location = body.location;
  if (body.compensation !== undefined) doc.compensation = body.compensation;
  if (body.eligibility !== undefined) doc.eligibility = body.eligibility;
  if (body.closesAt !== undefined) doc.closesAt = new Date(body.closesAt);
  if (body.applyUrl !== undefined) doc.applyUrl = body.applyUrl;
  await doc.save();

  const lean = doc.toObject() as unknown as OpeningRecord;
  const authors = await loadAuthors([lean.postedBy]);
  const marks = await bookmarkedSet(auth.userId, "opening", [lean._id]);
  res.json(toOpeningDto(lean, authors, marks));
});

// DELETE /api/openings/:id — soft delete, owner or admin.
openingsRouter.delete("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const doc = await Opening.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND");
  assertCanModify(auth.role, "opening", "delete", String(doc.postedBy), auth.userId);
  doc.deletedAt = new Date();
  await doc.save();
  res.status(204).end();
});
