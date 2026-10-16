import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
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
    email: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        'onboarding_1',
        'onboarding_2',
        'onboarding_3',
        'trial_reminder',
        'usage_warning',
        'win_back',
        'weekly_digest',
      ],
      required: true,
    },
    subject: String,
    status: {
      type: String,
      enum: ['sent', 'failed', 'bounced'],
      default: 'sent',
    },
    error: String,
    providerId: String,
    openedAt: Date,
    clickedAt: Date,
  },
  { timestamps: true }
);

emailLogSchema.index({ userId: 1, type: 1, createdAt: -1 });
emailLogSchema.index({ createdAt: -1 });

export default mongoose.model('EmailLog', emailLogSchema);
