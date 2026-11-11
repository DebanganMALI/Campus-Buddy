import { Router } from "express";
import { profilePatch } from "@scc/shared";
import { User, decryptField, encryptField } from "@scc/db";
import { audit } from "../lib/audit.js";
import { AppError } from "../lib/errors.js";
import type { UserRecord } from "../lib/records.js";
import { toProfileDto } from "../lib/user-dto.js";
import { requireAuth } from "../middleware/auth.js";
import { getAuth, requirePermission } from "../middleware/authorize.js";

export const profileRouter: Router = Router();
profileRouter.use(requireAuth);

// The stored user plus the private profile sub-document (phone is encrypted).
type ProfileRecord = UserRecord & { profile?: { phoneEnc?: string; bio?: string } };

const readProfile = (u: ProfileRecord) =>
  toProfileDto(u, {
    phone: u.profile?.phoneEnc ? decryptField(u.profile.phoneEnc) : undefined,
    bio: u.profile?.bio,
  });

// GET /api/profile — the signed-in user's own profile, including private fields.
profileRouter.get("/", async (req, res) => {
  const auth = getAuth(req);
  const user = await User.findById(auth.userId).select("+profile.phoneEnc").lean<ProfileRecord | null>();
  if (!user) throw new AppError("SESSION_REVOKED");
  res.json(readProfile(user));
});

// PATCH /api/profile — update own name / phone / bio. Phone is stored encrypted.
profileRouter.patch("/", requirePermission("profile:manage"), async (req, res) => {
  const auth = getAuth(req);
  const patch = profilePatch.parse(req.body);

  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.bio !== undefined) set["profile.bio"] = patch.bio;
  if (patch.phone !== undefined) set["profile.phoneEnc"] = patch.phone ? encryptField(patch.phone) : null;

  if (Object.keys(set).length > 0) await User.updateOne({ _id: auth.userId }, { $set: set });

  const user = await User.findById(auth.userId).select("+profile.phoneEnc").lean<ProfileRecord | null>();
  if (!user) throw new AppError("SESSION_REVOKED");
  audit(req, { action: "profile.update", result: "success", actorId: auth.userId });
  res.json(readProfile(user));
});
