export const ROLES = ["student", "faculty", "moderator", "placement_officer", "admin"] as const;
export type Role = (typeof ROLES)[number];

// MFA is mandatory for these roles
export const PRIVILEGED_ROLES: readonly Role[] = ["faculty", "moderator", "placement_officer", "admin"];

export const isPrivileged = (role: Role): boolean => PRIVILEGED_ROLES.includes(role);
