import { Schema, model, type InferSchemaType } from "mongoose";
import { basePlugin } from "../plugins/base";

const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  actorRole: String,
  action: { type: String, required: true, maxlength: 80 },
  targetType: String,
  targetId: String,
  result: { type: String, required: true, enum: ["success", "denied", "failure"] },
  ipHash: String,
  userAgent: { type: String, maxlength: 300 },
  requestId: String,
  meta: Schema.Types.Mixed,
  expiresAt: { 
    type: Date, 
    required: true,
    // Defaults to 365 days from creation
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) 
  }
}, { 
  // Only track createdAt, no updatedAt
  timestamps: { updatedAt: false } 
});

// Enforce strictly append-only behavior to prevent tampering
const preventModification = function(next: any) {
  next(new Error("Audit logs are append-only. Updates and deletions are strictly forbidden."));
};

auditLogSchema.pre("updateOne", preventModification);
auditLogSchema.pre("updateMany", preventModification);
auditLogSchema.pre("findOneAndUpdate", preventModification);
auditLogSchema.pre("replaceOne", preventModification);
auditLogSchema.pre("deleteOne", preventModification);
auditLogSchema.pre("deleteMany", preventModification);
auditLogSchema.pre("findOneAndDelete", preventModification);

// Apply our base plugin
auditLogSchema.plugin(basePlugin);

// Required Indexes
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;
export const AuditLog = model("AuditLog", auditLogSchema);
