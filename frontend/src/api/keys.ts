// One place for TanStack Query cache keys, so invalidation after a change is precise.
export const keys = {
  announcements: ["announcements"] as const,
  events: ["events"] as const,
  resources: ["resources"] as const,
  openings: ["openings"] as const,
  search: ["search"] as const,
  bookmarks: ["bookmarks"] as const,
  profile: ["profile"] as const,
  users: ["admin", "users"] as const,
};
