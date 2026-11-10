import { Schema, model, type InferSchemaType } from "mongoose";
import { basePlugin } from "../plugins/base";

const sessionSchema = new Schema({
  // Override default ObjectId with a required String (for the 32 random hex characters)
  _id: { type: String, required: true }, 
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  
  // Refresh token hashes are strictly hidden from normal queries
  refreshHash: { type: String, required: true, select: false },
  prevRefreshHash: { type: String, select: false },
  rotatedAt: Date,
  
  // Device and location metadata
  userAgent: { type: String, maxlength: 300 },
  deviceLabel: String,
  browser: String,
  os: String,
  ipHash: String,
  approxLocation: String,
  
  // Authentication state
  mfaPending: { type: Boolean, default: false },
  authTime: { type: Date, required: true },
  
  // Expiry and revocation
  expiresAt: { type: Date, required: true },
  absoluteExpiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokeReason: String,
  lastUsedAt: Date
}, { 
  timestamps: true 
});

// Apply our base plugin
sessionSchema.plugin(basePlugin);

// Required Indexes for efficient querying and automatic expiration
sessionSchema.index({ userId: 1, revokedAt: 1, lastUsedAt: -1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL Index

export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export const Session = model("Session", sessionSchema);
