import type { Role } from "./roles.js";

export const PERMISSIONS = [
  "announcement:read",
  "announcement:create",
  "announcement:update:own",
  "announcement:update:any",
  "announcement:delete:own",
  "announcement:delete:any",
  "event:read",
  "event:create",
  "event:update:own",
  "event:update:any",
  "event:delete:own",
  "event:delete:any",
  "event:rsvp",
  "resource:read",
  "resource:submit",
  "resource:create",
  "resource:update:own",
  "resource:update:any",
  "resource:delete:own",
  "resource:delete:any",
  "opening:read",
  "opening:create",
  "opening:update:own",
  "opening:update:any",
  "opening:delete:own",
  "opening:delete:any",
  "opening:track",
  "search:use",
  "bookmark:manage",
  "profile:manage",
  "notification:read",
  "report:create",
  "report:review",
  "moderation:review",
  "user:read",
  "user:invite",
  "user:suspend",
  "user:role:update",
  "audit:read",
  "analytics:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const EVERYONE: Permission[] = [
  "announcement:read",
  "event:read",
  "resource:read",
  "opening:read",
  "search:use",
  "bookmark:manage",
  "profile:manage",
  "notification:read",
  "event:rsvp",
  "opening:track",
  "report:create",
];
const CONTENT_OWN: Permission[] = [
  "announcement:create",
  "announcement:update:own",
  "announcement:delete:own",
  "event:create",
  "event:update:own",
  "event:delete:own",
  "resource:create",
  "resource:update:own",
  "resource:delete:own",
];
const CONTENT_ANY: Permission[] = [
  "announcement:update:any",
  "announcement:delete:any",
  "event:update:any",
  "event:delete:any",
  "resource:update:any",
  "resource:delete:any",
];
const OPENINGS_OWN: Permission[] = ["opening:create", "opening:update:own", "opening:delete:own"];

// Mirrors the table in AGENTS.md §5.5 exactly
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  student: new Set([...EVERYONE, "resource:submit"]),
  faculty: new Set([...EVERYONE, ...CONTENT_OWN]),
  moderator: new Set([...EVERYONE, ...CONTENT_OWN, ...CONTENT_ANY, "moderation:review", "report:review"]),
  placement_officer: new Set([
    ...EVERYONE,
    ...OPENINGS_OWN,
    "event:create",
    "event:update:own",
    "event:delete:own",
  ]),
  admin: new Set(PERMISSIONS),
};

export const hasPermission = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].has(permission);

export const permissionsFor = (role: Role): Permission[] => [...ROLE_PERMISSIONS[role]];
