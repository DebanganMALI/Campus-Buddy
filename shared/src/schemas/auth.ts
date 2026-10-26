import { z } from "zod";
import { department, email, name, opaqueToken, password, totpCode, year } from "./common.js";
import { userDto } from "./user.js";

export const registerBody = z.strictObject({
  name,
  email,
  password,
  rollNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9/-]{3,30}$/)
    .optional(),
  department,
  year,
});

export const tokenBody = z.strictObject({ token: opaqueToken });
export const emailBody = z.strictObject({ email });

export const loginBody = z.strictObject({
  email,
  password: z.string().min(1).max(128),
  turnstileToken: z.string().max(2048).optional(),
});

export const mfaVerifyBody = z
  .strictObject({
    challengeId: opaqueToken,
    code: totpCode.optional(),
    recoveryCode: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{2}$/)
      .optional(),
  })
  .refine((b) => Boolean(b.code) !== Boolean(b.recoveryCode), { message: "Send a code or a recovery code" });

export const mfaConfirmBody = z.strictObject({ code: totpCode });

export const resetPasswordBody = z.strictObject({ token: opaqueToken, newPassword: password });
export const acceptInviteBody = z.strictObject({ token: opaqueToken, password });
export const changePasswordBody = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});
export const reauthBody = z.union([
  z.strictObject({ password: z.string().min(1).max(128) }),
  z.strictObject({ code: totpCode }),
]);
export const sessionIdParams = z.strictObject({ id: z.string().regex(/^[a-f\d]{32}$/) });

export const loginResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("OK"), user: userDto }),
  z.object({ status: z.literal("MFA_REQUIRED"), challengeId: z.string() }),
]);

export const meResponse = z.object({
  user: userDto,
  permissions: z.array(z.string()),
  mfa: z.object({ enabled: z.boolean(), required: z.boolean() }),
  feed: z.object({ lastSeenAt: z.string().nullable() }),
});

export const mfaEnrollResponse = z.object({ otpauthUrl: z.string(), secret: z.string() });
export const recoveryCodesResponse = z.object({ recoveryCodes: z.array(z.string()).length(10) });

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
export type LoginResponse = z.infer<typeof loginResponse>;
export type MeResponse = z.infer<typeof meResponse>;
