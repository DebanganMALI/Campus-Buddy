import { Schema, model, type InferSchemaType } from "mongoose";
import { DEPARTMENTS, LIMITS, YEARS } from "@scc/shared";
import { basePlugin } from "../plugins/base.js";

const RESOURCE_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const resourceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: LIMITS.titleMax },
    description: { type: String, maxlength: 2000 },
    department: { type: String, required: true, enum: DEPARTMENTS },
    year: { type: Number, required: true, enum: YEARS },
    semester: { type: Number, required: true, min: 1, max: 10 },
    subject: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    subjectKey: { type: String, required: true }, // normalised lowercase for exact filtering
    file: {
      key: { type: String },
      name: { type: String, maxlength: 200 },
      mimeType: { type: String, enum: RESOURCE_MIMES },
      size: { type: Number, max: LIMITS.fileMaxBytes },
      sha256: { type: String },
    },
    status: {
      type: String,
      enum: ["awaiting_upload", "pending_scan", "pending_review", "published", "rejected", "infected"],
      required: true,
    },
    version: { type: Number, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    review: { by: Schema.Types.ObjectId, at: Date, reason: String },
    downloadCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "resources" },
);

resourceSchema.plugin(basePlugin);

resourceSchema.pre("validate", function () {
  this.subjectKey = String(this.subject ?? "").trim().toLowerCase();
});

resourceSchema.index(
  { status: 1, department: 1, year: 1, semester: 1, subjectKey: 1, createdAt: -1, _id: -1 },
  { name: "browse" },
);
resourceSchema.index({ uploadedBy: 1, createdAt: -1 }, { name: "by_uploader" });
resourceSchema.index({ status: 1, createdAt: 1 }, { name: "moderation" });
resourceSchema.index(
  { title: "text", subject: "text", description: "text" },
  { weights: { title: 3, subject: 2, description: 1 }, name: "text_fallback" },
);

export type ResourceDoc = InferSchemaType<typeof resourceSchema>;
export const Resource = model("Resource", resourceSchema);
