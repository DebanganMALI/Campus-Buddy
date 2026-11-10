import { Router } from "express";
import { z } from "zod";
import type { Model } from "mongoose";
import { objectId, resourceFilters } from "@scc/shared";
import { Resource, paginate } from "@scc/db";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCanModify, getAuth } from "../middleware/authorize.js";
import { bookmarkedSet, loadAuthors, toResourceDto, type ResourceRecord } from "../lib/content-dto.js";

export const resourcesRouter: Router = Router();
resourcesRouter.use(requireAuth);

const idParam = z.object({ id: objectId });

// Note: resource upload (presigned → object storage → virus scan) is a later
// slice. These routes cover browsing, viewing and removing published resources.

// GET /api/resources — dept → year → semester → subject browse.
resourcesRouter.get("/", async (req, res) => {
  const auth = getAuth(req);
  const f = resourceFilters.parse(req.query);

  const filter: Record<string, unknown> = { deletedAt: null, status: "published" };
  if (f.department) filter.department = f.department;
  if (typeof f.year === "number") filter.year = f.year;
  if (typeof f.semester === "number") filter.semester = f.semester;
  if (f.subject) filter.subjectKey = f.subject.trim().toLowerCase();
  if (f.q) filter.$text = { $search: f.q };

  const { items, nextCursor } = await paginate<ResourceRecord>(
    Resource as unknown as Model<ResourceRecord>,
    filter,
    { sortField: "createdAt", direction: -1, limit: f.limit ?? 20, cursor: f.cursor ?? null },
  );
  const authors = await loadAuthors(items.map((i) => i.uploadedBy));
  const marks = await bookmarkedSet(auth.userId, "resource", items.map((i) => i._id));
  res.json({ items: items.map((i) => toResourceDto(i, authors, marks)), nextCursor });
});

// GET /api/resources/:id
resourcesRouter.get("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const base: Record<string, unknown> = { _id: id, deletedAt: null };
  if (auth.role === "student") base.status = "published";
  const doc = await Resource.findOne(base).lean<ResourceRecord | null>();
  if (!doc) throw new AppError("NOT_FOUND");
  const authors = await loadAuthors([doc.uploadedBy]);
  const marks = await bookmarkedSet(auth.userId, "resource", [doc._id]);
  res.json(toResourceDto(doc, authors, marks));
});

// DELETE /api/resources/:id — soft delete, owner or admin/moderator.
resourcesRouter.delete("/:id", async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const doc = await Resource.findOne({ _id: id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND");
  assertCanModify(auth.role, "resource", "delete", String(doc.uploadedBy), auth.userId);
  doc.deletedAt = new Date();
  await doc.save();
  res.status(204).end();
});
