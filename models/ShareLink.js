import mongoose from 'mongoose';

const shareLinkSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      default: 'Ask questions',
    },
    description: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    chatCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

shareLinkSchema.index({ tenantId: 1, documentId: 1 });

export default mongoose.model('ShareLink', shareLinkSchema);