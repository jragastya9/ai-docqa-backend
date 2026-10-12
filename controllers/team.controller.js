import crypto from 'crypto';
import Invitation from '../models/Invitation.js';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { sendTeamInviteEmail } from '../services/emailService.js';

const INVITE_TTL_DAYS = 7;

export async function inviteMember(req, res) {
  try {
    const { email, role = 'member' } = req.body;
    const tenantId = req.tenantId;
    const inviterId = req.user._id;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const normalized = email.toLowerCase().trim();

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const existing = await User.findOne({ email: normalized, tenantId });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'This user is already a member of your workspace',
      });
    }

    const pending = await Invitation.findOne({
      tenantId,
      email: normalized,
      status: 'pending',
    });
    if (pending) {
      return res.status(400).json({
        success: false,
        error: 'An invitation is already pending for this email',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const invitation = await Invitation.create({
      tenantId,
      email: normalized,
      role,
      invitedBy: inviterId,
      token,
      expiresAt,
    });

    const tenant = await Tenant.findById(tenantId);
    const inviter = await User.findById(inviterId);
    const frontendUrl =
      process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/accept-invite?token=${token}`;

    try {
      await sendTeamInviteEmail({
        to: normalized,
        tenantName: tenant?.name || 'a workspace',
        inviterName: inviter?.name || 'A teammate',
        role,
        inviteUrl,
        expiresInDays: INVITE_TTL_DAYS,
      });
    } catch (emailErr) {
      console.error('Invite email failed:', emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Invitation sent',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (err) {
    console.error('Invite error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function listTeam(req, res) {
  try {
    const tenantId = req.tenantId;

    const [members, invites] = await Promise.all([
      User.find({ tenantId })
        .select('name email role emailVerified createdAt lastLoginAt')
        .sort({ createdAt: 1 }),
      Invitation.find({ tenantId, status: 'pending' })
        .select('email role expiresAt createdAt')
        .sort({ createdAt: -1 }),
    ]);

    return res.json({
      success: true,
      members: members.map((m) => ({
        id: m._id,
        name: m.name,
        email: m.email,
        role: m.role,
        emailVerified: m.emailVerified,
        createdAt: m.createdAt,
        lastLoginAt: m.lastLoginAt,
        isYou: m._id.toString() === req.user._id.toString(),
      })),
      pendingInvites: invites.map((i) => ({
        id: i._id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
    });
  } catch (err) {
    console.error('List team error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateMemberRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const tenantId = req.tenantId;

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const member = await User.findOne({ _id: id, tenantId });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    if (member.role === 'owner') {
      return res
        .status(400)
        .json({ success: false, error: 'Cannot change the owner role' });
    }

    member.role = role;
    await member.save();

    return res.json({
      success: true,
      message: 'Role updated',
      member: {
        id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
      },
    });
  } catch (err) {
    console.error('Update role error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function removeMember(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    if (id === req.user._id.toString()) {
      return res
        .status(400)
        .json({ success: false, error: 'You cannot remove yourself' });
    }

    const member = await User.findOne({ _id: id, tenantId });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    if (member.role === 'owner') {
      return res
        .status(400)
        .json({ success: false, error: 'Cannot remove the owner' });
    }

    member.tenantId = null;
    await member.save();

    return res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    console.error('Remove member error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function revokeInvite(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const invite = await Invitation.findOne({ _id: id, tenantId });
    if (!invite) {
      return res
        .status(404)
        .json({ success: false, error: 'Invitation not found' });
    }

    invite.status = 'revoked';
    await invite.save();

    return res.json({ success: true, message: 'Invitation revoked' });
  } catch (err) {
    console.error('Revoke invite error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getInviteByToken(req, res) {
  try {
    const { token } = req.params;

    const invite = await Invitation.findOne({ token }).populate(
      'tenantId',
      'name'
    );

    if (!invite) {
      return res
        .status(404)
        .json({ success: false, error: 'Invitation not found' });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Invitation is ${invite.status}`,
      });
    }

    if (invite.expiresAt < new Date()) {
      invite.status = 'expired';
      await invite.save();
      return res
        .status(400)
        .json({ success: false, error: 'Invitation has expired' });
    }

    return res.json({
      success: true,
      invitation: {
        email: invite.email,
        role: invite.role,
        workspaceName: invite.tenantId?.name || 'Workspace',
      },
    });
  } catch (err) {
    console.error('Get invite error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function acceptInvite(req, res) {
  try {
    const { token } = req.params;
    const { name, password } = req.body;

    if (!name || !password) {
      return res
        .status(400)
        .json({ success: false, error: 'Name and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    const invite = await Invitation.findOne({ token });
    if (!invite) {
      return res
        .status(404)
        .json({ success: false, error: 'Invitation not found' });
    }

    if (invite.status !== 'pending') {
      return res
        .status(400)
        .json({ success: false, error: `Invitation is ${invite.status}` });
    }

    if (invite.expiresAt < new Date()) {
      invite.status = 'expired';
      await invite.save();
      return res
        .status(400)
        .json({ success: false, error: 'Invitation has expired' });
    }

    const existingUser = await User.findOne({ email: invite.email });
    if (existingUser) {
      if (existingUser.tenantId) {
        return res.status(400).json({
          success: false,
          error: 'This email is already registered to another workspace',
        });
      }
      existingUser.tenantId = invite.tenantId;
      existingUser.role = invite.role;
      await existingUser.save();

      invite.status = 'accepted';
      invite.acceptedAt = new Date();
      invite.acceptedBy = existingUser._id;
      await invite.save();

      return res.json({
        success: true,
        message: 'You have been added to the workspace. Please log in.',
        email: existingUser.email,
        alreadyExisted: true,
      });
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 12);

    const newUser = await User.create({
      name: name.trim(),
      email: invite.email,
      password: passwordHash,
      tenantId: invite.tenantId,
      role: invite.role,
      emailVerified: true,
    });

    invite.status = 'accepted';
    invite.acceptedAt = new Date();
    invite.acceptedBy = newUser._id;
    await invite.save();

    return res.status(201).json({
      success: true,
      message: 'Welcome to the workspace. You can now log in.',
      email: newUser.email,
    });
  } catch (err) {
    console.error('Accept invite error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
