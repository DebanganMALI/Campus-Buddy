import type { Types } from "mongoose";
import type { Department, Role } from "@scc/shared";

// Plain-object shapes returned by `.lean()` queries. We only list the fields
// the auth code actually reads, so the rest of the (large) user document stays
// out of the way.

export type UserStatus = "pending" | "active" | "suspended" | "deleted";

export interface UserRecord {
  _id: Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  rollNo?: string;
  role: Role;
  department: Department;
  year?: number;
  section?: string;
  status: UserStatus;
  passwordHash?: string;
  mfa?: { enabled?: boolean };
  security?: { failedLogins?: number; lockUntil?: Date | null; lastFailedAt?: Date | null };
  lastFeedSeenAt?: Date;
  createdAt: Date;
}

export interface SessionRecord {
  _id: string;
  userId: Types.ObjectId;
  refreshHash: string;
  authTime: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}
