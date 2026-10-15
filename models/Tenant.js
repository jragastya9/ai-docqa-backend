import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    subdomain: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    customDomain: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    domainVerified: {
      type: Boolean,
      default: false,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'business'],
      default: 'free',
    },
    settings: {
      // Branding (Day 18)
      brandName: String,
      tagline: String,
      logo: String,
      favicon: String,
      primaryColor: { type: String, default: '#6366f1' },
      supportEmail: String,
      footerText: String,
      // AI (Day 20)
      aiProvider: { type: String, default: 'groq' },
      customPrompt: { type: String, default: '' },
      cachingEnabled: { type: Boolean, default: true },
      // Admin (Day 21) — feature flags
      featureFlags: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Tenant', tenantSchema);
