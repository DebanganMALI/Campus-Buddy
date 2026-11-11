import { Router } from "express";
import { z } from "zod";
import type { Model } from "mongoose";
import { objectId, setUserStatusBody, userFilters } from "@scc/shared";
import { User, paginate } from "@scc/db";
import { audit } from "../lib/audit.js";
import { AppError } from "../lib/errors.js";
import type { UserRecord } from "../lib/records.js";
import { toUserDto } from "../lib/user-dto.js";
import { requireAuth } from "../middleware/auth.js";
import { getAuth, requirePermission } from "../middleware/authorize.js";
import { revokeAllSessions } from "../lib/session.js";

export const adminRouter: Router = Router();
adminRouter.use(requireAuth);

const idParam = z.object({ id: objectId });
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/admin/users — directory with filters, newest first.
adminRouter.get("/users", requirePermission("user:read"), async (req, res) => {
  const auth = getAuth(req);
  const f = userFilters.parse(req.query);

  const filter: Record<string, unknown> = {};
  if (f.q) {
    const rx = new RegExp(escapeRegex(f.q), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (f.role) filter.role = f.role;
  if (f.status) filter.status = f.status;
  if (f.department) filter.department = f.department;

  const { items, nextCursor } = await paginate<UserRecord>(
    User as unknown as Model<UserRecord>,
    filter,
    { sortField: "createdAt", direction: -1, limit: f.limit ?? 20, cursor: f.cursor ?? null },
  );
  res.json({ items: items.map(toUserDto), nextCursor });
});

// PATCH /api/admin/users/:id/status — activate or suspend a user. Suspending
// also revokes every active session so access is cut immediately.
adminRouter.patch("/users/:id/status", requirePermission("user:suspend"), async (req, res) => {
  const auth = getAuth(req);
  const { id } = idParam.parse(req.params);
  const { status, reason } = setUserStatusBody.parse(req.body);

  const user = await User.findById(id);
  if (!user) throw new AppError("NOT_FOUND");

  user.set("status", status);
  await user.save();
  if (status === "suspended") await revokeAllSessions(id, "admin_suspend");

  audit(req, {
    action: "admin.user.status",
    result: "success",
    actorId: auth.userId,
    actorRole: auth.role,
    targetType: "user",
    targetId: id,
    meta: { status, reason },
  });

  const lean = user.toObject() as unknown as UserRecord;
  res.json(toUserDto(lean));
});
