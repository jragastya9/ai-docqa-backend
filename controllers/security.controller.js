import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import Session from '../models/Session.js';
import { parseUserAgent } from '../utils/deviceParser.js';
import { sendNewDeviceAlert } from '../services/emailService.js';

const SALT_ROUNDS = 12;

/**
 * POST /api/security/change-password
 * Body: { currentPassword, newPassword }
 */
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user.password) {
      return res.status(400).json({
        success: false,
        error: 'This account uses Google sign-in. No password to change.',
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, error: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // logout everywhere
    await user.save();

    return res.json({
      success: true,
      message: 'Password changed. Please log in again.',
    });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/security/logout-all
 * Invalidates all existing sessions.
 */
export async function logoutAll(req, res) {
  try {
    const user = await User.findById(req.user._id);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { revokedAt: new Date(), revokedReason: 'logout_all' }
    );

    return res.json({
      success: true,
      message: 'All sessions logged out. Please log in again.',
    });
  } catch (err) {
    console.error('Logout all error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/security/sessions
 * List active sessions for the current user.
 */
export async function listSessions(req, res) {
  try {
    const sessions = await Session.find({
      userId: req.user._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ lastActiveAt: -1 });

    return res.json({
      success: true,
      currentTokenId: req.tokenId,
      sessions: sessions.map((s) => ({
        id: s._id,
        tokenId: s.tokenId,
        browser: s.browser,
        os: s.os,
        device: s.device,
        ipAddress: s.ipAddress,
        city: s.city,
        country: s.country,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        isCurrent: s.tokenId === req.tokenId,
      })),
    });
  } catch (err) {
    console.error('List sessions error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/security/sessions/:id
 * Revoke a specific session by bumping the user's tokenVersion if the
 * session is the current one. Actually — instead, we just bump the version
 * only when the user is revoking their own current session.
 * For other sessions, we can't selectively invalidate without a per-session
 * nonce in the JWT (which we have, jti). So: mark the session revoked,
 * AND bump tokenVersion only if it's the current one.
 */
export async function revokeSession(req, res) {
  try {
    const { id } = req.params;
    const session = await Session.findOne({
      _id: id,
      userId: req.user._id,
      revokedAt: null,
    });

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: 'Session not found' });
    }

    session.revokedAt = new Date();
    session.revokedReason = 'user_revoked';
    await session.save();

    // If revoking the current session, log out immediately
    if (session.tokenId === req.tokenId) {
      const user = await User.findById(req.user._id);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      return res.json({
        success: true,
        message: 'Current session revoked. Please log in again.',
        loggedOut: true,
      });
    }

    return res.json({ success: true, message: 'Session revoked' });
  } catch (err) {
    console.error('Revoke session error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/security/2fa/setup
 * Generate TOTP secret + QR code. Does NOT enable — user must verify.
 */
export async function setup2FA(req, res) {
  try {
    const user = await User.findById(req.user._id);

    if (user.twoFactor?.enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled',
      });
    }

    const secret = speakeasy.generateSecret({
      name: `LocalBiz AI (${user.email})`,
      issuer: 'LocalBiz AI',
      length: 32,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret (not yet enabled)
    user.twoFactor = {
      enabled: false,
      secret: secret.base32,
      backupCodes: [],
    };
    await user.save();

    return res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      otpauthUrl: secret.otpauth_url,
    });
  } catch (err) {
    console.error('Setup 2FA error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/security/2fa/verify
 * Body: { code }
 * Verify the TOTP code against the stored secret to ENABLE 2FA.
 */
export async function verify2FA(req, res) {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code required' });
    }

    const user = await User.findById(req.user._id);
    if (!user.twoFactor?.secret) {
      return res
        .status(400)
        .json({ success: false, error: 'Run setup first' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactor.secret,
      encoding: 'base32',
      token: String(code).trim(),
      window: 1,
    });

    if (!valid) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid code' });
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(5).toString('hex').toUpperCase()
    );
    const hashed = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, 10))
    );

    user.twoFactor.enabled = true;
    user.twoFactor.backupCodes = hashed;
    user.twoFactor.enabledAt = new Date();
    await user.save();

    return res.json({
      success: true,
      message: '2FA enabled',
      backupCodes, // show ONCE
    });
  } catch (err) {
    console.error('Verify 2FA error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/security/2fa/disable
 * Body: { code } — requires current TOTP or a backup code
 */
export async function disable2FA(req, res) {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code required' });
    }

    const user = await User.findById(req.user._id);
    if (!user.twoFactor?.enabled) {
      return res
        .status(400)
        .json({ success: false, error: '2FA is not enabled' });
    }

    // Try TOTP first
    const validTotp = speakeasy.totp.verify({
      secret: user.twoFactor.secret,
      encoding: 'base32',
      token: String(code).trim(),
      window: 1,
    });

    // Fall back to backup codes
    let validBackup = false;
    if (!validTotp) {
      for (const hash of user.twoFactor.backupCodes) {
        if (await bcrypt.compare(String(code).trim().toUpperCase(), hash)) {
          validBackup = true;
          break;
        }
      }
    }

    if (!validTotp && !validBackup) {
      return res.status(400).json({ success: false, error: 'Invalid code' });
    }

    user.twoFactor = {
      enabled: false,
      secret: null,
      backupCodes: [],
      enabledAt: null,
    };
    await user.save();

    return res.json({ success: true, message: '2FA disabled' });
  } catch (err) {
    console.error('Disable 2FA error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/security/2fa/status
 */
export async function get2FAStatus(req, res) {
  try {
    const user = await User.findById(req.user._id);
    return res.json({
      success: true,
      enabled: user.twoFactor?.enabled || false,
      enabledAt: user.twoFactor?.enabledAt || null,
      backupCodeCount: user.twoFactor?.backupCodes?.length || 0,
    });
  } catch (err) {
    console.error('Get 2FA status error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/security/export
 * Download all user data as JSON.
 */
export async function exportData(req, res) {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const tenant = await Tenant.findById(req.user.tenantId);

    // Import models lazily to avoid circular deps
    const { default: Document } = await import('../models/Document.js');
    const { default: Conversation } = await import(
      '../models/Conversation.js'
    );
    const { default: Message } = await import('../models/Message.js');

    const [documents, conversations, messages] = await Promise.all([
      Document.find({ tenantId: req.tenantId }).select('-__v').lean(),
      Conversation.find({ tenantId: req.tenantId }).select('-__v').lean(),
      Message.find({ tenantId: req.tenantId }).select('-__v').lean(),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      user: user.toObject(),
      tenant: tenant ? tenant.toObject() : null,
      documents,
      conversations,
      messages,
      stats: {
        documents: documents.length,
        conversations: conversations.length,
        messages: messages.length,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="localbiz-export-${Date.now()}.json"`
    );
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Export data error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/security/account
 * Body: { password, confirm: 'DELETE' }
 * Hard-delete account, tenant, and all data.
 */
export async function deleteAccount(req, res) {
  try {
    const { password, confirm } = req.body;

    if (confirm !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Type DELETE in the confirm field to proceed',
      });
    }

    const user = await User.findById(req.user._id);

    // If password exists, verify
    if (user.password) {
      if (!password) {
        return res
          .status(400)
          .json({ success: false, error: 'Password is required' });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res
          .status(400)
          .json({ success: false, error: 'Incorrect password' });
      }
    }

    // If the user owns the tenant, delete everything
    const tenant = await Tenant.findById(req.user.tenantId);
    const isOwner = tenant && tenant.ownerId?.toString() === user._id.toString();

    if (isOwner) {
      // Delete all tenant data
      const { default: Document } = await import('../models/Document.js');
      const { default: Chunk } = await import('../models/Chunk.js');
      const { default: Conversation } = await import(
        '../models/Conversation.js'
      );
      const { default: Message } = await import('../models/Message.js');
      const { default: ShareLink } = await import(
        '../models/ShareLink.js'
      );
      const { default: Usage } = await import('../models/Usage.js');
      const { default: Subscription } = await import(
        '../models/Subscription.js'
      );
      const { default: Notification } = await import(
        '../models/Notification.js'
      );
      const { default: Webhook } = await import('../models/Webhook.js');
      const { default: Session } = await import('../models/Session.js');

      await Promise.all([
        Document.deleteMany({ tenantId: tenant._id }),
        Chunk.deleteMany({ tenantId: tenant._id }),
        Conversation.deleteMany({ tenantId: tenant._id }),
        Message.deleteMany({ tenantId: tenant._id }),
        ShareLink.deleteMany({ tenantId: tenant._id }),
        Usage.deleteMany({ tenantId: tenant._id }),
        Subscription.deleteMany({ tenantId: tenant._id }),
        Notification.deleteMany({ tenantId: tenant._id }),
        Webhook.deleteMany({ tenantId: tenant._id }),
        Session.deleteMany({ userId: user._id }),
        User.deleteMany({ tenantId: tenant._id }),
        Tenant.findByIdAndDelete(tenant._id),
      ]);

      return res.json({
        success: true,
        message: 'Account and workspace deleted',
      });
    }

    // Not owner — just remove user
    const { default: Session } = await import('../models/Session.js');
    await Session.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(user._id);

    return res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
