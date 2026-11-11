import { Router } from "express";
import type { Model } from "mongoose";
import { searchQuery, searchResults, type ContentType } from "@scc/shared";
import { Announcement, Event, Opening, Resource, paginate } from "@scc/db";
import { requireAuth } from "../middleware/auth.js";
import { getAuth, requirePermission } from "../middleware/authorize.js";
import {
  bookmarkedSet,
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

export const searchRouter: Router = Router();
searchRouter.use(requireAuth);

const ALL_TYPES: ContentType[] = ["announcement", "event", "resource", "opening"];
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/search — one query across the content types the viewer may see.
searchRouter.get("/", requirePermission("search:use"), async (req, res) => {
  const auth = getAuth(req);
  const { q, types, limit } = searchQuery.parse(req.query);
  const cap = limit ?? 6;
  const now = new Date();
  const viewer: Viewer = { role: auth.role, department: auth.department, year: auth.year };
  const want = new Set((types ? types.split(",") : ALL_TYPES).map((s) => s.trim()).filter(Boolean));
  const rx = new RegExp(escapeRegex(q), "i");

  const out = { announcements: [], events: [], resources: [], openings: [] } as ReturnType<
    typeof searchResults.parse
  >;

  if (want.has("announcement")) {
    const { items } = await paginate<AnnouncementRecord>(
      Announcement as unknown as Model<AnnouncementRecord>,
      { ...visibleFilter("announcement", viewer, now), title: rx },
      { sortField: "publishAt", direction: -1, limit: cap, cursor: null },
    );
    const authors = await loadAuthors(items.map((i) => i.authorId));
    const marks = await bookmarkedSet(auth.userId, "announcement", items.map((i) => i._id));
    out.announcements = items.map((i) => toAnnouncementDto(i, authors, marks));
  }

  if (want.has("event")) {
    const { items } = await paginate<EventRecord>(
      Event as unknown as Model<EventRecord>,
      { ...visibleFilter("event", viewer, now), title: rx },
      { sortField: "startsAt", direction: 1, limit: cap, cursor: null },
    );
    const authors = await loadAuthors(items.map((i) => i.authorId));
    const marks = await bookmarkedSet(auth.userId, "event", items.map((i) => i._id));
    out.events = items.map((i) => toEventDto(i, authors, marks));
  }

  if (want.has("resource")) {
    const { items } = await paginate<ResourceRecord>(
      Resource as unknown as Model<ResourceRecord>,
      { ...visibleFilter("resource", viewer, now), $or: [{ title: rx }, { subject: rx }] },
      { sortField: "createdAt", direction: -1, limit: cap, cursor: null },
    );
    const authors = await loadAuthors(items.map((i) => i.uploadedBy));
    const marks = await bookmarkedSet(auth.userId, "resource", items.map((i) => i._id));
    out.resources = items.map((i) => toResourceDto(i, authors, marks));
  }

  if (want.has("opening")) {
    const { items } = await paginate<OpeningRecord>(
      Opening as unknown as Model<OpeningRecord>,
      { ...visibleFilter("opening", viewer, now), $or: [{ title: rx }, { company: rx }] },
      { sortField: "closesAt", direction: 1, limit: cap, cursor: null },
    );
    const authors = await loadAuthors(items.map((i) => i.postedBy));
    const marks = await bookmarkedSet(auth.userId, "opening", items.map((i) => i._id));
    out.openings = items.map((i) => toOpeningDto(i, authors, marks));
  }

  res.json(searchResults.parse(out));
});
