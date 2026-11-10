import type { Types } from "mongoose";
import type {
  AnnouncementDTO,
  AuthorRef,
  ContentType,
  EventDTO,
  OpeningDTO,
  ResourceDTO,
  Role,
} from "@scc/shared";
import { Bookmark, User } from "@scc/db";

// Resolve the AuthorRef for a set of content items in one query, instead of
// populating each document.
interface AuthorRow {
  _id: Types.ObjectId;
  name: string;
  role: Role;
}

export async function loadAuthors(ids: Types.ObjectId[]): Promise<Map<string, AuthorRef>> {
  const unique = [...new Set(ids.map(String))];
  const rows = await User.find({ _id: { $in: unique } })
    .select("name role")
    .lean<AuthorRow[]>();
  const map = new Map<string, AuthorRef>();
  for (const r of rows) map.set(String(r._id), { id: String(r._id), name: r.name, role: r.role });
  return map;
}

const UNKNOWN_AUTHOR: AuthorRef = { id: "", name: "Unknown", role: "student" };
const authorOf = (authors: Map<string, AuthorRef>, id: Types.ObjectId): AuthorRef =>
  authors.get(String(id)) ?? UNKNOWN_AUTHOR;

// Which of these items has the viewer bookmarked (one query, not N).
export async function bookmarkedSet(
  userId: string,
  itemType: ContentType,
  itemIds: Types.ObjectId[],
): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();
  const rows = await Bookmark.find({ userId, itemType, itemId: { $in: itemIds } })
    .select("itemId")
    .lean<{ itemId: Types.ObjectId }[]>();
  return new Set(rows.map((r) => String(r.itemId)));
}

// Lean record shapes — only the fields the mappers read.
interface Base {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
interface StoredAudience {
  departments: unknown[];
  years: unknown[];
}

export interface AnnouncementRecord extends Base {
  title: string;
  body: string;
  audience: StoredAudience;
  status: AnnouncementDTO["status"];
  publishAt?: Date | null;
  expiresAt?: Date | null;
  pinned: boolean;
  authorId: Types.ObjectId;
}
export interface EventRecord extends Base {
  title: string;
  description: string;
  venue: string;
  startsAt: Date;
  endsAt: Date;
  capacity?: number | null;
  rsvpCount: number;
  audience: StoredAudience;
  status: EventDTO["status"];
  authorId: Types.ObjectId;
}
export interface ResourceRecord extends Base {
  title: string;
  description?: string;
  department: string;
  year: number;
  semester: number;
  subject: string;
  file?: { name?: string; mimeType?: string; size?: number };
  status: ResourceDTO["status"];
  version: number;
  uploadedBy: Types.ObjectId;
}
export interface OpeningRecord extends Base {
  title: string;
  company: string;
  type: OpeningDTO["type"];
  description: string;
  location?: string;
  compensation?: string;
  eligibility: { departments: unknown[]; years: unknown[]; minCgpa?: number | null };
  closesAt: Date;
  applyUrl: string;
  postedBy: Types.ObjectId;
}

export function toAnnouncementDto(
  d: AnnouncementRecord,
  authors: Map<string, AuthorRef>,
  bookmarked: Set<string>,
): AnnouncementDTO {
  return {
    id: String(d._id),
    title: d.title,
    body: d.body,
    audience: d.audience as AnnouncementDTO["audience"],
    status: d.status,
    publishAt: d.publishAt ? d.publishAt.toISOString() : undefined,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    pinned: d.pinned,
    author: authorOf(authors, d.authorId),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    bookmarked: bookmarked.has(String(d._id)),
  };
}

export function toEventDto(
  d: EventRecord,
  authors: Map<string, AuthorRef>,
  bookmarked: Set<string>,
): EventDTO {
  return {
    id: String(d._id),
    title: d.title,
    description: d.description,
    venue: d.venue,
    startsAt: d.startsAt.toISOString(),
    endsAt: d.endsAt.toISOString(),
    capacity: d.capacity ?? null,
    rsvpCount: d.rsvpCount,
    audience: d.audience as EventDTO["audience"],
    status: d.status,
    author: authorOf(authors, d.authorId),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    bookmarked: bookmarked.has(String(d._id)),
  };
}

export function toResourceDto(
  d: ResourceRecord,
  authors: Map<string, AuthorRef>,
  bookmarked: Set<string>,
): ResourceDTO {
  return {
    id: String(d._id),
    title: d.title,
    description: d.description,
    department: d.department as ResourceDTO["department"],
    year: d.year as ResourceDTO["year"],
    semester: d.semester,
    subject: d.subject,
    file: {
      name: d.file?.name ?? "",
      mimeType: (d.file?.mimeType ?? "application/pdf") as ResourceDTO["file"]["mimeType"],
      size: d.file?.size ?? 0,
    },
    status: d.status,
    version: d.version,
    uploadedBy: authorOf(authors, d.uploadedBy),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    bookmarked: bookmarked.has(String(d._id)),
  };
}

export function toOpeningDto(
  d: OpeningRecord,
  authors: Map<string, AuthorRef>,
  bookmarked: Set<string>,
): OpeningDTO {
  return {
    id: String(d._id),
    title: d.title,
    company: d.company,
    type: d.type,
    description: d.description,
    location: d.location,
    compensation: d.compensation,
    eligibility: d.eligibility as OpeningDTO["eligibility"],
    closesAt: d.closesAt.toISOString(),
    applyUrl: d.applyUrl,
    postedBy: authorOf(authors, d.postedBy),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    bookmarked: bookmarked.has(String(d._id)),
  };
}
