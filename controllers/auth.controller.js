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

export async function signup(req, res) {
  try {
    const { name, email, password, businessName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    const slugBase = (businessName || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const tenant = await Tenant.create({
      name: businessName || `${name}'s Workspace`,
      slug,
    });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      tenantId: tenant._id,
      role: 'owner',
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
    });

    tenant.ownerId = user._id;
    await tenant.save();

    const token = signToken({
      id: user._id,
      email: user.email,
      tenantId: tenant._id,
      role: 'owner',
    });

    try {
      await sendWelcomeEmail({ to: user.email, name: user.name });
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: emailVerificationToken,
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Account created. Check your email to verify.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: tenant._id,
        emailVerified: user.emailVerified,
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
    });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated.',
      });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken({
      id: user._id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
    });
  }
}

export async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      tenantId: req.user.tenantId,
      emailVerified: req.user.emailVerified,
      createdAt: req.user.createdAt,
    },
  });
}

export async function verifyEmail(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required.',
      });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token.',
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Email verified successfully.',
      user: {
        id: user._id,
        email: user.email,
        emailVerified: true,
      },
    });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token: resetToken,
      });
    } catch (emailErr) {
      console.error('Reset email failed:', emailErr.message);
    }

    res.json({
      success: true,
      message: 'If that email exists, a reset link has been sent.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters.',
      });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token.',
      });
    }

    user.password = await bcrypt.hash(password, SALT_ROUNDS);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function googleAuth(req, res) {
  try {
    const { email, name, image, googleId } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({
        success: false,
        error: 'Email and Google ID are required.',
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (image && !user.avatar) user.avatar = image;
        await user.save({ validateBeforeSave: false });
      }
    } else {
      const slugBase = (name || email)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
      const slug = `${slugBase}-${Date.now().toString(36)}`;

      const tenant = await Tenant.create({
        name: `${name || 'User'}'s Workspace`,
        slug,
      });

      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: await bcrypt.hash(
          crypto.randomBytes(32).toString('hex'),
          SALT_ROUNDS
        ),
        tenantId: tenant._id,
        role: 'owner',
        googleId,
        avatar: image,
        emailVerified: true,
      });

      tenant.ownerId = user._id;
      await tenant.save();
    }

    const token = signToken({
      id: user._id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}