import mongoose from 'mongoose';

const moderationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    content: { type: String, required: true },
    contentPreview: String,
    source: {
      type: String,
      enum: ['chat', 'signup', 'invite', 'upload', 'other'],
      default: 'other',
    },
    flagged: { type: Boolean, default: false },
    categories: { type: mongoose.Schema.Types.Mixed, default: {} },
    action: {
      type: String,
      enum: ['allow', 'block', 'report'],
      default: 'allow',
    },
    reason: String,
  },
  { timestamps: true }
);

moderationLogSchema.index({ tenantId: 1, createdAt: -1 });
moderationLogSchema.index({ flagged: 1, createdAt: -1 });

export default mongoose.model('ModerationLog', moderationLogSchema);
