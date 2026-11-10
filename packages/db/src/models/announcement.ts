import { Schema, model, type InferSchemaType } from "mongoose";
import { LIMITS } from "@scc/shared";
import { basePlugin } from "../plugins/base.js";
import { audienceToKeys, type AudienceLike } from "../queries/audience.js";
import { audienceSchema } from "./audience-schema.js";

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: LIMITS.titleMax },
    body: { type: String, required: true, maxlength: LIMITS.bodyMax },
    audience: { type: audienceSchema, required: true },
    audienceKeys: { type: [String], required: true, select: false },
    status: { type: String, enum: ["draft", "scheduled", "published", "archived"], required: true },
    publishAt: { type: Date },
    expiresAt: { type: Date, default: null },
    pinned: { type: Boolean, default: false },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    moderation: {
      state: { type: String, enum: ["none", "flagged", "removed"], default: "none" },
      reason: String,
      by: Schema.Types.ObjectId,
      at: Date,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "announcements" },
);

announcementSchema.plugin(basePlugin);

// Derived index keys (never sent by clients); publish time defaults to now.
announcementSchema.pre("validate", function () {
  this.audienceKeys = audienceToKeys(this.audience as unknown as AudienceLike);
  if (this.status === "published" && !this.publishAt) this.publishAt = new Date();
});

announcementSchema.index({ status: 1, audienceKeys: 1, publishAt: -1, _id: -1 }, { name: "feed" });
announcementSchema.index({ authorId: 1, createdAt: -1 }, { name: "by_author" });
announcementSchema.index({ status: 1, publishAt: 1 }, { name: "scheduler" });
announcementSchema.index({ expiresAt: 1 }, { name: "expiry" });
announcementSchema.index({ title: "text", body: "text" }, { weights: { title: 3, body: 1 }, name: "text_fallback" });

export type AnnouncementDoc = InferSchemaType<typeof announcementSchema>;
export const Announcement = model("Announcement", announcementSchema);
