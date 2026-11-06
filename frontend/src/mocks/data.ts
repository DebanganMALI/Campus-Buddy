// Sample data only. Never put real student names, emails or roll numbers here.
import type { UserDTO } from "@scc/shared";

export const MOCK_PASSWORD = "demo-password-123";
export const MOCK_LOCKED_EMAIL = "locked@iem.edu.in";

export const mockUsers: UserDTO[] = [
  {
    id: "64b000000000000000000001",
    name: "Student A",
    email: "student.a@iem.edu.in",
    rollNo: "TEST01",
    role: "student",
    department: "CSE",
    year: 3,
    status: "active",
    emailVerified: true,
    mfaEnabled: false,
    createdAt: "2026-08-18T04:30:00.000Z",
  },
  {
    id: "64b000000000000000000002",
    name: "Faculty B",
    email: "faculty.b@iem.edu.in",
    role: "faculty",
    department: "CSE",
    status: "active",
    emailVerified: true,
    mfaEnabled: false,
    createdAt: "2026-08-18T04:30:00.000Z",
  },
  {
    id: "64b000000000000000000003",
    name: "Admin C",
    email: "admin.c@iem.edu.in",
    role: "admin",
    department: "CSE",
    status: "active",
    emailVerified: true,
    mfaEnabled: false,
    createdAt: "2026-08-18T04:30:00.000Z",
  },
];
