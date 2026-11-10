import { Schema, model, type InferSchemaType } from "mongoose";
import { DEPARTMENTS, LIMITS, YEARS } from "@scc/shared";
import { basePlugin } from "../plugins/base.js";
import { audienceToKeys, type AudienceLike } from "../queries/audience.js";

const eligibilitySchema = new Schema(
  {
    departments: {
      type: [String],
      enum: [...DEPARTMENTS, "ALL"],
      required: true,
      validate: (v: string[]) => v.length >= 1 && v.length <= 30,
    },
    years: {
      type: [Schema.Types.Mixed],
      required: true,
      validate: (v: unknown[]) =>
        v.length >= 1 && v.every((y) => y === "ALL" || (YEARS as readonly number[]).includes(y as number)),
    },
    minCgpa: { type: Number, min: 0, max: 10, default: null },
  },
  { _id: false },
);

const openingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: LIMITS.titleMax },
    company: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: ["job", "internship"], required: true },
    description: { type: String, required: true, maxlength: LIMITS.bodyMax },
    location: { type: String, maxlength: 100 },
    compensation: { type: String, maxlength: 100 },
    eligibility: { type: eligibilitySchema, required: true },
    eligibilityKeys: { type: [String], required: true, select: false },
    closesAt: { type: Date, required: true },
    applyUrl: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ["draft", "published", "closed"], required: true },
    postedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    moderation: {
      state: { type: String, enum: ["none", "flagged", "removed"], default: "none" },
      reason: String,
      by: Schema.Types.ObjectId,
      at: Date,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "openings" },
);

openingSchema.plugin(basePlugin);

openingSchema.pre("validate", function () {
  this.eligibilityKeys = audienceToKeys({
    departments: this.eligibility.departments,
    years: this.eligibility.years,
  } as unknown as AudienceLike);
});

openingSchema.index({ status: 1, eligibilityKeys: 1, closesAt: 1, _id: 1 }, { name: "feed" });
openingSchema.index({ status: 1, type: 1, closesAt: 1 }, { name: "by_type" });
openingSchema.index({ postedBy: 1, createdAt: -1 }, { name: "by_author" });
openingSchema.index(
  { title: "text", company: "text", description: "text" },
  { weights: { title: 3, company: 2, description: 1 }, name: "text_fallback" },
);

export type OpeningDoc = InferSchemaType<typeof openingSchema>;
export const Opening = model("Opening", openingSchema);
