import { Schema, model, type InferSchemaType } from "mongoose";
import { basePlugin } from "../plugins/base.js";

const bookmarkSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    itemType: { type: String, enum: ["announcement", "event", "resource", "opening"], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, collection: "bookmarks" },
);

bookmarkSchema.plugin(basePlugin);

bookmarkSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });
bookmarkSchema.index({ userId: 1, createdAt: -1, _id: -1 });

export type BookmarkDoc = InferSchemaType<typeof bookmarkSchema>;
export const Bookmark = model("Bookmark", bookmarkSchema);
