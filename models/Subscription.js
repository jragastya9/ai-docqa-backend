import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    razorpayCustomerId: { type: String },
    razorpaySubscriptionId: { type: String },
    razorpayPlanId: { type: String },
    plan: {
      type: String,
      enum: ['free', 'pro', 'business'],
      default: 'free',
    },
    status: {
      type: String,
      enum: [
        'created',
        'authenticated',
        'active',
        'pending',
        'halted',
        'cancelled',
        'completed',
        'expired',
      ],
      default: 'created',
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    amount: { type: Number },
    currency: { type: String, default: 'INR' },
  },
  { timestamps: true }
);

subscriptionSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('Subscription', subscriptionSchema);