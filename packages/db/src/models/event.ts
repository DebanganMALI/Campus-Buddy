import { Schema, model, type InferSchemaType } from "mongoose";
import { LIMITS } from "@scc/shared";
import { basePlugin } from "../plugins/base.js";
import { audienceToKeys, type AudienceLike } from "../queries/audience.js";
import { audienceSchema } from "./audience-schema.js";

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: LIMITS.titleMax },
    description: { type: String, required: true, maxlength: LIMITS.bodyMax },
    venue: { type: String, required: true, maxlength: LIMITS.titleMax },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, default: null, min: 1, max: 100000 },
    rsvpCount: { type: Number, default: 0 },
    waitlistCount: { type: Number, default: 0 },
    audience: { type: audienceSchema, required: true },
    audienceKeys: { type: [String], required: true, select: false },
    status: { type: String, enum: ["draft", "published", "cancelled"], required: true },
    isPublic: { type: Boolean, default: false },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    moderation: {
      state: { type: String, enum: ["none", "flagged", "removed"], default: "none" },
      reason: String,
      by: Schema.Types.ObjectId,
      at: Date,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "events" },
);

eventSchema.plugin(basePlugin);

eventSchema.pre("validate", function () {
  this.audienceKeys = audienceToKeys(this.audience as unknown as AudienceLike);
});

eventSchema.index({ status: 1, audienceKeys: 1, startsAt: 1, _id: 1 }, { name: "feed" });
eventSchema.index({ isPublic: 1, status: 1, startsAt: 1 }, { name: "public" });
eventSchema.index({ authorId: 1, createdAt: -1 }, { name: "by_author" });
eventSchema.index(
  { title: "text", description: "text" },
  { weights: { title: 3, description: 1 }, name: "text_fallback" },
);

export type EventDoc = InferSchemaType<typeof eventSchema>;
export const Event = model("Event", eventSchema);
