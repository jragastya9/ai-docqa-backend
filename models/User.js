import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, default: null },
    avatar: String,
    googleId: String,
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member',
    },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lastLoginAt: Date,

    // ─── Day 22 — Security ───
    tokenVersion: { type: Number, default: 0 },

    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: null },
      backupCodes: [{ type: String }],
      enabledAt: Date,
    },

    // ─── Day 26 — Marketing ───
    lastActiveAt: { type: Date, default: Date.now, index: true },
    onboardingStep: { type: Number, default: 0 },
    trialEndsAt: { type: Date, default: null },

    emailPrefs: {
      marketing: { type: Boolean, default: true },
      onboarding: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
      unsubscribedAt: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
