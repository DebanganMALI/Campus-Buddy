import type { Role } from "@scc/shared";

declare global {
  namespace Express {
    interface AccessClaims {
      sub: string;
      role: Role;
      sid: string;
      tv: number;
      at: number;
      mfa: "ok" | "enroll";
    }
    interface Request {
      id: string;
      token?: { claims: AccessClaims; expired: boolean } | { invalid: true };
      auth?: { userId: string; role: Role; sid: string; authTime: number; mfa: "ok" | "enroll" };
    }
  }
}

export {};
