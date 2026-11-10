import { Schema, model, type InferSchemaType } from "mongoose";
import { basePlugin } from "../plugins/base";

// Export the specific token types required by the backend
export const AUTH_TOKEN_TYPES = ["email_verify", "password_reset", "invite", "mfa_challenge", "oauth_state"] as const;
export type AuthTokenType = typeof AUTH_TOKEN_TYPES[number];

const authTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  type: { type: String, required: true, enum: AUTH_TOKEN_TYPES },
  
  // The raw token is never stored, only its SHA-256 hash. Hidden by default.
  tokenHash: { type: String, required: true, unique: true, select: false },
  
  attempts: { type: Number, default: 0 },
  meta: Schema.Types.Mixed,
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null }
}, { 
  // The spec specifically requested only the creation timestamp for this collection
  timestamps: { updatedAt: false } 
});

// Apply our base plugin
authTokenSchema.plugin(basePlugin);

// Required Indexes
authTokenSchema.index({ tokenHash: 1 }, { unique: true });
authTokenSchema.index({ userId: 1, type: 1, usedAt: 1 });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for automatic cleanup

export type AuthTokenDoc = InferSchemaType<typeof authTokenSchema>;
export const AuthToken = model("AuthToken", authTokenSchema);
