import { Schema, model, type InferSchemaType } from "mongoose";
import { basePlugin } from "../plugins/base.js";

const eventRsvpSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["going", "waitlisted", "cancelled"], required: true },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "eventRsvps" },
);

eventRsvpSchema.plugin(basePlugin);

eventRsvpSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventRsvpSchema.index({ userId: 1, status: 1, createdAt: -1 });
eventRsvpSchema.index({ eventId: 1, status: 1, createdAt: 1 }); // waitlist promotion order

export type EventRsvpDoc = InferSchemaType<typeof eventRsvpSchema>;
export const EventRsvp = model("EventRsvp", eventRsvpSchema);
