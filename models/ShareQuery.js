import mongoose from 'mongoose';

const shareQuerySchema = new mongoose.Schema(
  {
    shareLinkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShareLink',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

shareQuerySchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model('ShareQuery', shareQuerySchema);