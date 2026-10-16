import mongoose from 'mongoose';

const webhookDeliverySchema = new mongoose.Schema(
  {
    webhookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Webhook',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    responseStatus: Number,
    responseBody: String,
    duration: Number,
    success: {
      type: Boolean,
      default: false,
    },
    error: String,
  },
  { timestamps: true }
);

webhookDeliverySchema.index({ tenantId: 1, createdAt: -1 });
webhookDeliverySchema.index({ webhookId: 1, createdAt: -1 });

// Auto-delete deliveries older than 30 days
webhookDeliverySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 }
);

export default mongoose.model('WebhookDelivery', webhookDeliverySchema);
