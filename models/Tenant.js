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
      tagline: String,
      logo: String,
      primaryColor: { type: String, default: '#6366f1' },
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

tenantSchema.index({ ownerId: 1 });

export default mongoose.model('Tenant', tenantSchema);