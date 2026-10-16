import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Device info
    userAgent: String,
    ipAddress: String,
    browser: String,
    os: String,
    device: String,
    // Location (best effort)
    city: String,
    country: String,
    // Timestamps
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: Date,
    revokedReason: String,
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1, revokedAt: 1 });
// TTL — auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Session', sessionSchema);
