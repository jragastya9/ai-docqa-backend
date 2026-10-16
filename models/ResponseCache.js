import mongoose from 'mongoose';

const responseCacheSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    questionHash: {
      type: String,
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    sources: [
      {
        sourceNumber: Number,
        chunkId: mongoose.Schema.Types.ObjectId,
        documentId: mongoose.Schema.Types.ObjectId,
        documentName: String,
        chunkIndex: Number,
        text: String,
        score: Number,
      },
    ],
    provider: String,
    model: String,
    tokensUsed: { type: Number, default: 0 },
    hitCount: { type: Number, default: 0 },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique per tenant + question
responseCacheSchema.index(
  { tenantId: 1, questionHash: 1 },
  { unique: true }
);

// TTL — auto-delete when expiresAt is reached
responseCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('ResponseCache', responseCacheSchema);
