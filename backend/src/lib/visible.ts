import type { ContentType, Role } from "@scc/shared";
import { viewerKeys } from "@scc/db";

// The per-type "content this viewer may see" filter, kept identical to what each
// list route builds, so search and bookmarks can never surface something a
// viewer couldn't reach through the normal feeds. Students are scoped by
// audience/eligibility; staff see everything published (events: not cancelled).
export interface Viewer {
  role: Role;
  department: string;
  year?: number;
}

export function visibleFilter(type: ContentType, v: Viewer, now: Date = new Date()): Record<string, unknown> {
  const student = v.role === "student";
  switch (type) {
    case "announcement": {
      const f: Record<string, unknown> = { deletedAt: null, status: "published" };
      if (student) {
        f.audienceKeys = { $in: viewerKeys(v.department, v.year) };
        f.publishAt = { $lte: now };
        f.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
      }
      return f;
    }
    case "event": {
      const f: Record<string, unknown> = { deletedAt: null };
      if (student) {
        f.status = "published";
        f.audienceKeys = { $in: viewerKeys(v.department, v.year) };
      } else {
        f.status = { $ne: "cancelled" };
      }
      return f;
    }
    case "resource":
      return { deletedAt: null, status: "published" };
    case "opening": {
      const f: Record<string, unknown> = { deletedAt: null, status: "published" };
      if (student) {
        f.eligibilityKeys = { $in: viewerKeys(v.department, v.year) };
        f.closesAt = { $gte: now };
      }
      return f;
    }
  }
}
