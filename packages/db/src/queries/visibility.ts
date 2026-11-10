import type { Role } from "@scc/shared";
import { viewerKeys } from "./audience.js";

export interface Viewer {
  role: Role;
  department: string;
  year?: number;
}

// The base server-side filter for "content this viewer is allowed to see":
// only published, non-deleted items, and — for students — only items whose
// audience covers their department + year. Staff see everything published.
// (Announcement routes add publishAt/expiresAt time windows on top of this.)
export function visibleContentFilter(viewer: Viewer, _now: Date = new Date()): Record<string, unknown> {
  const base: Record<string, unknown> = { deletedAt: null, status: "published" };
  if (viewer.role !== "student") return base;
  return { ...base, audienceKeys: { $in: viewerKeys(viewer.department, viewer.year) } };
}
