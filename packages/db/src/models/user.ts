import { Schema, model, type InferSchemaType } from "mongoose";
// This imports the shared enums. It might show a red line right now, which is expected!
import { ROLES, DEPARTMENTS, YEARS } from "@scc/shared";
import { basePlugin } from "../plugins/base";

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  emailVerified: { type: Boolean, default: false },
  name: { type: String, required: true, minlength: 2, maxlength: 80 },
  rollNo: { type: String, uppercase: true, maxlength: 30 },
  role: { type: String, required: true, default: "student", enum: ROLES },
  department: { type: String, required: true, enum: DEPARTMENTS },
  year: { type: Number, enum: YEARS },
  section: { type: String, maxlength: 5 },
  status: { type: String, enum: ["pending", "active", "suspended", "deleted"], default: "pending" },
  
  // Sensitive fields hidden by default
  passwordHash: { type: String, select: false },
  
  authProviders: [{ provider: { type: String, enum: ["google"] }, subject: String }],
  
  mfa: {
    enabled: { type: Boolean, default: false },
    secretEnc: { type: String, select: false },
    pendingSecretEnc: { type: String, select: false },
    lastUsedStep: { type: Number, default: 0 },
    recoveryCodes: { type: [{ hash: String, usedAt: Date }], select: false },
    enrolledAt: Date
  },
  
  tokenVersion: { type: Number, default: 0 },
  
  security: {
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastFailedAt: Date,
    lastLoginAt: Date,
    lastLoginIpHash: String
  },
  
  profile: {
    phoneEnc: { type: String, select: false },
    bio: { type: String, maxlength: 300 },
    avatarKey: String
  },
  
  settings: {
    emailNotifications: { type: Boolean, default: true },
    animations: { type: Boolean, default: true }
  },
  
  lastFeedSeenAt: Date,
  deletedAt: { type: Date, default: null },
  anonymizedAt: { type: Date, default: null }
}, { 
  timestamps: true 
});

// Apply our base plugin to clean up JSON output
userSchema.plugin(basePlugin);

// Required Indexes
userSchema.index({ email: 1 }, { unique: true });
// Unique partial index that applies only when rollNo is actually provided as a string
userSchema.index(
  { rollNo: 1 }, 
  { unique: true, partialFilterExpression: { rollNo: { $type: "string" } } }
);
// Unique partial index for Google sign-in identities
userSchema.index(
  { "authProviders.provider": 1, "authProviders.subject": 1 }, 
  { unique: true, partialFilterExpression: { "authProviders.provider": { $exists: true } } }
);
userSchema.index({ role: 1, status: 1, createdAt: -1 });
userSchema.index({ department: 1, year: 1, status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
