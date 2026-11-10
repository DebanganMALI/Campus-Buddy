// Content endpoints, exactly as listed in AGENTS.md §5.8.
import { api } from "../client";
import { qs } from "../query";
import type {
  AnnouncementDTO,
  AudienceDTO,
  EventDTO,
  OpeningDTO,
  Page,
  ResourceDTO,
  UploadUrlResponse,
  Year,
} from "../types";

/* ---------- Announcements ---------- */
export interface AnnouncementFilters {
  q?: string;
  department?: string;
  year?: number;
  pinned?: boolean;
  cursor?: string | null;
  limit?: number;
}
export interface AnnouncementInput {
  title: string;
  body: string;
  audience: AudienceDTO;
  status: "draft" | "published";
  pinned: boolean;
  expiresAt?: string | null;
}
export const listAnnouncements = (f: AnnouncementFilters, signal?: AbortSignal) =>
  api<Page<AnnouncementDTO>>("GET", `/announcements${qs({ ...f })}`, { signal });
export const getAnnouncement = (id: string, signal?: AbortSignal) =>
  api<AnnouncementDTO>("GET", `/announcements/${encodeURIComponent(id)}`, { signal });
export const createAnnouncement = (body: AnnouncementInput) => api<AnnouncementDTO>("POST", "/announcements", { body });
export const updateAnnouncement = (id: string, body: Partial<AnnouncementInput>) =>
  api<AnnouncementDTO>("PATCH", `/announcements/${encodeURIComponent(id)}`, { body });
export const deleteAnnouncement = (id: string) => api<void>("DELETE", `/announcements/${encodeURIComponent(id)}`);

/* ---------- Events ---------- */
export interface EventFilters {
  q?: string;
  cursor?: string | null;
  limit?: number;
}
export interface EventInput {
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity?: number | null;
  audience: AudienceDTO;
  status: "draft" | "published";
}
export const listEvents = (f: EventFilters, signal?: AbortSignal) =>
  api<Page<EventDTO>>("GET", `/events${qs({ ...f })}`, { signal });
export const getEvent = (id: string, signal?: AbortSignal) =>
  api<EventDTO>("GET", `/events/${encodeURIComponent(id)}`, { signal });
export const createEvent = (body: EventInput) => api<EventDTO>("POST", "/events", { body });
export const updateEvent = (id: string, body: Partial<EventInput>) =>
  api<EventDTO>("PATCH", `/events/${encodeURIComponent(id)}`, { body });
export const deleteEvent = (id: string) => api<void>("DELETE", `/events/${encodeURIComponent(id)}`);

/* ---------- Resources ---------- */
export interface ResourceFilters {
  department?: string;
  year?: number;
  semester?: number;
  subject?: string;
  q?: string;
  cursor?: string | null;
  limit?: number;
}
export interface UploadUrlInput {
  title: string;
  description?: string;
  department: string;
  year: Year;
  semester: number;
  subject: string;
  fileName: string;
  mimeType: string;
  size: number;
}
export const listResources = (f: ResourceFilters, signal?: AbortSignal) =>
  api<Page<ResourceDTO>>("GET", `/resources${qs({ ...f })}`, { signal });
export const getResource = (id: string, signal?: AbortSignal) =>
  api<ResourceDTO>("GET", `/resources/${encodeURIComponent(id)}`, { signal });
export const deleteResource = (id: string) => api<void>("DELETE", `/resources/${encodeURIComponent(id)}`);
export const requestUploadUrl = (body: UploadUrlInput) =>
  api<UploadUrlResponse>("POST", "/resources/upload-url", { body });
export const completeUpload = (id: string) =>
  api<{ status: ResourceDTO["status"] }>("POST", `/resources/${encodeURIComponent(id)}/complete`);
export const getDownloadUrl = (id: string) =>
  api<{ url: string; expiresAt: string }>("GET", `/resources/${encodeURIComponent(id)}/download`);

/* ---------- Openings ---------- */
export interface OpeningFilters {
  type?: "job" | "internship" | "";
  closingWithinDays?: number;
  q?: string;
  cursor?: string | null;
  limit?: number;
}
export const listOpenings = (f: OpeningFilters, signal?: AbortSignal) =>
  api<Page<OpeningDTO>>("GET", `/openings${qs({ ...f })}`, { signal });
export const getOpening = (id: string, signal?: AbortSignal) =>
  api<OpeningDTO>("GET", `/openings/${encodeURIComponent(id)}`, { signal });
