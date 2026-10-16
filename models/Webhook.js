import mongoose from 'mongoose';
import crypto from 'crypto';

const webhookSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    events: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one event is required',
      },
    },
    secret: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: 120,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastTriggeredAt: Date,
    failureCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

webhookSchema.index({ tenantId: 1, active: 1 });

webhookSchema.statics.generateSecret = function () {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
};

export default mongoose.model('Webhook', webhookSchema);
