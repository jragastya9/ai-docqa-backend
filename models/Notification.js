import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'document_uploaded',
        'chat_message',
        'plan_upgraded',
        'plan_downgraded',
        'team_invite_sent',
        'team_invite_accepted',
        'team_member_removed',
        'share_link_created',
        'share_link_viewed',
        'welcome',
        'system',
      ],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    href: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
