import { Schema, model, type InferSchemaType } from "mongoose";
import { basePlugin } from "../plugins/base.js";

const openingTrackingSchema = new Schema(
  {
    openingId: { type: Schema.Types.ObjectId, ref: "Opening", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["interested", "applied"], required: true },
  },
  { timestamps: true, collection: "openingTracking" },
);

openingTrackingSchema.plugin(basePlugin);

openingTrackingSchema.index({ userId: 1, openingId: 1 }, { unique: true });
openingTrackingSchema.index({ openingId: 1, status: 1 });

export type OpeningTrackingDoc = InferSchemaType<typeof openingTrackingSchema>;
export const OpeningTracking = model("OpeningTracking", openingTrackingSchema);
