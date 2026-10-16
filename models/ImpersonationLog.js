import mongoose from 'mongoose';

const impersonationLogSchema = new mongoose.Schema(
  {
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    adminEmail: String,
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetEmail: String,
    targetTenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    },
    ipAddress: String,
    userAgent: String,
    endedAt: Date,
    reason: String,
  },
  { timestamps: true }
);

impersonationLogSchema.index({ createdAt: -1 });

export default mongoose.model('ImpersonationLog', impersonationLogSchema);
