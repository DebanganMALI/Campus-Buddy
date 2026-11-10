import type { UserDTO } from "@scc/shared";
import type { UserRecord } from "./records.js";

// Maps the stored user document to the public DTO the frontend expects.
// Anything sensitive (passwordHash, mfa secrets, security counters) is simply
// never copied across.
export function toUserDto(u: UserRecord): UserDTO {
  const dto: UserDTO = {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    status: u.status,
    emailVerified: u.emailVerified,
    mfaEnabled: u.mfa?.enabled ?? false,
    createdAt: u.createdAt.toISOString(),
  };
  if (u.rollNo) dto.rollNo = u.rollNo;
  if (typeof u.year === "number") dto.year = u.year;
  if (u.section) dto.section = u.section;
  return dto;
}
