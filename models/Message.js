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
        sourceNumber: Number,
        chunkId: mongoose.Schema.Types.ObjectId,
        documentId: mongoose.Schema.Types.ObjectId,
        documentName: String,
        chunkIndex: Number,
        text: String,
        score: Number,
      },
    ],
    tokensUsed: {
      type: Number,
      default: 0,
    },
    // ─── Day 20 additions ───
    model: {
      type: String,
      default: null,
    },
    provider: {
      type: String,
      enum: ['groq', 'cohere', 'openai', 'gemini', null],
      default: null,
    },
    feedback: {
      type: String,
      enum: ['up', 'down', null],
      default: null,
    },
    feedbackNote: {
      type: String,
      default: null,
    },
    feedbackAt: {
      type: Date,
      default: null,
    },
    cached: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });
messageSchema.index({ tenantId: 1, feedback: 1 });

export default mongoose.model('Message', messageSchema);
