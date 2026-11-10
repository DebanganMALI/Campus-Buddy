// The mock "database". Mock mode only — never part of a production build.
// Saved in sessionStorage so a page reload keeps demo changes (the real app uses MongoDB).
import type { AnnouncementDTO, ContentType, EventDTO, OpeningDTO, ResourceDTO } from "../api/types";
import { seedAnnouncements, seedEvents, seedOpenings, seedResources, seedUsers, type MockUser } from "./data";

type Stored<T> = Omit<T, "bookmarked">;

export interface MockDb {
  version: number;
  users: MockUser[];
  announcements: Stored<AnnouncementDTO>[];
  events: Stored<EventDTO>[];
  resources: Stored<ResourceDTO>[];
  openings: Stored<OpeningDTO>[];
  bookmarks: Array<{ userId: string; itemType: ContentType; itemId: string; createdAt: string }>;
  deleted: string[]; // soft-deleted content ids
}

const KEY = "scc-mock-db";
const VERSION = 3;

function seed(): MockDb {
  return {
    version: VERSION,
    users: structuredClone(seedUsers),
    announcements: seedAnnouncements(),
    events: seedEvents(),
    resources: seedResources(),
    openings: seedOpenings(),
    bookmarks: [
      { userId: seedUsers[0]!.id, itemType: "resource", itemId: "c10000000000000000000001", createdAt: new Date().toISOString() },
    ],
    deleted: [],
  };
}

function load(): MockDb {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === VERSION) return parsed;
    }
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return seed();
}

export const db: MockDb = load();

export function save(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore: the mock just forgets changes on reload */
  }
}

export function newId(prefix: string): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
  return (prefix + hex).slice(0, 24);
}
