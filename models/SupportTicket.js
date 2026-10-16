import mongoose from 'mongoose';

const ticketReplySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: String,
    authorRole: { type: String, enum: ['user', 'admin'], required: true },
    message: { type: String, required: true, maxlength: 5000 },
  },
  { timestamps: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: String,
    subject: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    category: {
      type: String,
      enum: ['bug', 'billing', 'feature_request', 'question', 'other'],
      default: 'other',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    replies: [ticketReplySchema],
    lastReplyAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true }
);

supportTicketSchema.index({ tenantId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('SupportTicket', supportTicketSchema);
