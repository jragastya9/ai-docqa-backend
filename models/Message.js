import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
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
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: [
      {
        chunkId: mongoose.Schema.Types.ObjectId,
        documentId: mongoose.Schema.Types.ObjectId,
        documentName: String,
        text: String,
        score: Number,
      },
    ],
    tokensUsed: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);