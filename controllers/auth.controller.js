import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { signToken } from '../utils/jwt.js';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/emailService.js';

const SALT_ROUNDS = 12;

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'workspace'
  );
}

async function generateUniqueSubdomain(businessName) {
  const base = slugify(businessName);
  let candidate = base;
  let counter = 1;

  while (await Tenant.findOne({ subdomain: candidate })) {
    candidate = `${base}-${counter}`;
    counter++;
    if (counter > 999) {
      candidate = `${base}-${Date.now().toString().slice(-6)}`;
      break;
    }
  }
  return candidate;
}

export async function signup(req, res) {
  try {
    const { name, email, password, businessName } = req.body;

    if (!name || !email || !password || !businessName) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, password, and business name are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    const normalized = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalized });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, error: 'Email already registered' });
    }

    const subdomain = await generateUniqueSubdomain(businessName);

    const tenant = await Tenant.create({
      name: businessName.trim(),
      slug: subdomain,
      subdomain,
      plan: 'free',
      settings: {
        primaryColor: '#6366f1',
      },
    });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      name: name.trim(),
      email: normalized,
      password: passwordHash,
      tenantId: tenant._id,
      role: 'owner',
      emailVerified: false,
      verificationToken,
    });

    tenant.ownerId = user._id;
    await tenant.save();

    const token = signToken(user);

    try {
      await sendWelcomeEmail({
        to: user.email,
        name: user.name,
        tenantName: tenant.name,
      });
    } catch (emailErr) {
      console.error('Welcome email failed:', emailErr.message);
    }

    try {
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: verificationToken,
      });
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr.message);
    }

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        plan: tenant.plan,
        brandName: tenant.settings?.brandName || tenant.name,
        logo: tenant.settings?.logo || null,
        primaryColor: tenant.settings?.primaryColor || '#6366f1',
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: 'Email and password are required' });
    }

    const normalized = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalized });

    if (!user || !user.password) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tenant = await Tenant.findById(user.tenantId);
    const token = signToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      tenant: tenant
        ? {
            id: tenant._id,
            name: tenant.name,
            slug: tenant.slug,
            subdomain: tenant.subdomain,
            plan: tenant.plan,
            brandName: tenant.settings?.brandName || tenant.name,
            logo: tenant.settings?.logo || null,
            primaryColor: tenant.settings?.primaryColor || '#6366f1',
          }
        : null,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function googleAuth(req, res) {
  try {
    const { email, name, image, googleId } = req.body;

    if (!email || typeof email !== 'string') {
      return res
        .status(400)
        .json({ success: false, error: 'Email is required' });
    }

    const normalized = email.toLowerCase().trim();

    let user = await User.findOne({ email: normalized });

    if (user) {
      user.lastLoginAt = new Date();
      if (image && !user.avatar) user.avatar = image;
      if (googleId && !user.googleId) user.googleId = googleId;
      await user.save();

      const tenant = await Tenant.findById(user.tenantId);
      const token = signToken(user);

      return res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
        tenant: tenant
          ? {
              id: tenant._id,
              name: tenant.name,
              slug: tenant.slug,
              subdomain: tenant.subdomain,
              plan: tenant.plan,
              brandName: tenant.settings?.brandName || tenant.name,
              logo: tenant.settings?.logo || null,
              primaryColor: tenant.settings?.primaryColor || '#6366f1',
            }
          : null,
      });
    }

    const firstName = name?.split(' ')[0] || 'My';
    const businessName = `${firstName}'s Workspace`;
    const subdomain = await generateUniqueSubdomain(businessName);

    const tenant = await Tenant.create({
      name: businessName,
      slug: subdomain,
      subdomain,
      plan: 'free',
      settings: {
        primaryColor: '#6366f1',
      },
    });

    user = await User.create({
      name: name || normalized.split('@')[0],
      email: normalized,
      password: null,
      avatar: image,
      tenantId: tenant._id,
      role: 'owner',
      emailVerified: true,
      googleId: googleId || undefined,
    });

    tenant.ownerId = user._id;
    await tenant.save();

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        plan: tenant.plan,
        brandName: tenant.settings?.brandName || tenant.name,
        logo: tenant.settings?.logo || null,
        primaryColor: tenant.settings?.primaryColor || '#6366f1',
      },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Email verification ───
export async function verifyEmail(req, res) {
  try {
    const { token } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, error: 'Token is required' });
    }
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid or expired token' });
    }
    user.emailVerified = true;
    user.verificationToken = undefined;
    await user.save();
    return res.json({ success: true, message: 'Email verified' });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Resend verification ───
export async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: 'Email is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'User not found' });
    }
    if (user.emailVerified) {
      return res
        .status(400)
        .json({ success: false, error: 'Email already verified' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    user.verificationToken = token;
    await user.save();
    await sendVerificationEmail({ to: user.email, name: user.name, token });
    return res.json({ success: true, message: 'Verification email sent' });
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Forgot password ───
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: 'Email is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Always return success to avoid user enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
    }
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();
    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token,
      });
    } catch (emailErr) {
      console.error('Reset email failed:', emailErr.message);
    }
    return res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Reset password ───
export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res
        .status(400)
        .json({ success: false, error: 'Token and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid or expired token' });
    }
    user.password = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    return res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Get current user ───
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const tenant = await Tenant.findById(req.tenantId);
    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
      tenant: tenant
        ? {
            id: tenant._id,
            name: tenant.name,
            slug: tenant.slug,
            subdomain: tenant.subdomain,
            plan: tenant.plan,
            brandName: tenant.settings?.brandName || tenant.name,
            logo: tenant.settings?.logo || null,
            primaryColor: tenant.settings?.primaryColor || '#6366f1',
          }
        : null,
    });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
