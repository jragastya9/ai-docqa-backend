import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
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
    chunkIndex: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    wordCount: {
      type: Number,
      required: true,
    },
    embedding: {
      type: [Number],
      default: undefined,
    },
  },
  { timestamps: true }
);

chunkSchema.index({ tenantId: 1, documentId: 1, chunkIndex: 1 });

export default mongoose.model('Chunk', chunkSchema);