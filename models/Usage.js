import mongoose from 'mongoose';

const usageSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
    },
    documentCount: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    aiTokensUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

usageSchema.index({ tenantId: 1, month: 1 }, { unique: true });

export default mongoose.model('Usage', usageSchema);