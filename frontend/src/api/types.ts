// Response shapes for content, copied from AGENTS.md §5.7 (the agreed DTOs).
// shared/ only has auth + user schemas so far. These types should move into
// shared/src/schemas via a contract PR (all 4 members approve) — see docs/CONTRACT-GAPS.md.
import type { Department, Role, UserDTO } from "@scc/shared";

export type Year = 1 | 2 | 3 | 4 | 5;

export interface AuthorRef {
  id: string;
  name: string;
  role: Role;
}

export interface AudienceDTO {
  departments: Department[] | ["ALL"];
  years: Year[] | ["ALL"];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AnnouncementDTO {
  id: string;
  title: string;
  body: string;
  audience: AudienceDTO;
  status: "draft" | "scheduled" | "published" | "archived";
  publishAt?: string;
  expiresAt?: string | null;
  pinned: boolean;
  author: AuthorRef;
  createdAt: string;
  updatedAt: string;
  bookmarked: boolean;
}

export interface EventDTO {
  id: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity?: number | null;
  rsvpCount: number;
  audience: AudienceDTO;
  status: "draft" | "published" | "cancelled";
  author: AuthorRef;
  createdAt: string;
  updatedAt: string;
  bookmarked: boolean;
}

export type ResourceMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export interface ResourceDTO {
  id: string;
  title: string;
  description?: string;
  department: Department;
  year: Year;
  semester: number;
  subject: string;
  file: { name: string; mimeType: ResourceMime; size: number };
  status: "awaiting_upload" | "pending_scan" | "pending_review" | "published" | "rejected" | "infected";
  version: number;
  uploadedBy: AuthorRef;
  createdAt: string;
  updatedAt: string;
  bookmarked: boolean;
}

export interface OpeningDTO {
  id: string;
  title: string;
  company: string;
  type: "job" | "internship";
  description: string;
  location?: string;
  compensation?: string;
  eligibility: { departments: Department[] | ["ALL"]; years: Year[] | ["ALL"]; minCgpa?: number | null };
  closesAt: string;
  applyUrl: string;
  postedBy: AuthorRef;
  createdAt: string;
  updatedAt: string;
  bookmarked: boolean;
}

export type ContentType = "announcement" | "event" | "resource" | "opening";

export interface SearchResults {
  announcements: AnnouncementDTO[];
  events: EventDTO[];
  resources: ResourceDTO[];
  openings: OpeningDTO[];
}

/** Not defined in AGENTS.md yet — proposed shape (see CONTRACT-GAPS.md). */
export type BookmarkItem =
  | { itemType: "announcement"; itemId: string; createdAt: string; item: AnnouncementDTO }
  | { itemType: "event"; itemId: string; createdAt: string; item: EventDTO }
  | { itemType: "resource"; itemId: string; createdAt: string; item: ResourceDTO }
  | { itemType: "opening"; itemId: string; createdAt: string; item: OpeningDTO };

/** Not defined in AGENTS.md yet — proposed shape: the user plus editable profile fields. */
export type ProfileDTO = UserDTO & { phone?: string; bio?: string };

export interface UploadUrlResponse {
  resourceId: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}
