import SupportTicket from '../models/SupportTicket.js';
import { isSuperAdmin } from '../middleware/superAdmin.js';

/**
 * POST /api/support
 * Any authenticated user creates a ticket.
 */
export async function createTicket(req, res) {
  try {
    const { subject, description, category, priority } = req.body;

    if (!subject || !description) {
      return res
        .status(400)
        .json({ success: false, error: 'Subject and description required' });
    }
    if (subject.length > 200 || description.length > 5000) {
      return res
        .status(400)
        .json({ success: false, error: 'Content too long' });
    }

    const ticket = await SupportTicket.create({
      tenantId: req.tenantId,
      userId: req.user._id,
      userEmail: req.user.email,
      subject: subject.trim(),
      description: description.trim(),
      category: category || 'other',
      priority: priority || 'normal',
    });

    return res.status(201).json({
      success: true,
      message: 'Ticket created. We\'ll get back to you soon.',
      ticket: {
        id: ticket._id,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (err) {
    console.error('Create ticket error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/support
 * - Regular user: sees their own tickets only
 * - Super admin: sees all tickets
 */
export async function listTickets(req, res) {
  try {
    const isAdmin = isSuperAdmin(req.user.email);
    const filter = isAdmin ? {} : { userId: req.user._id };

    if (req.query.status) filter.status = req.query.status;

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      isAdmin,
      tickets: tickets.map((t) => ({
        id: t._id,
        subject: t.subject,
        description: t.description,
        category: t.category,
        priority: t.priority,
        status: t.status,
        userEmail: isAdmin ? t.userEmail : undefined,
        replyCount: t.replies?.length || 0,
        lastReplyAt: t.lastReplyAt,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    console.error('List tickets error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/support/:id
 */
export async function getTicket(req, res) {
  try {
    const isAdmin = isSuperAdmin(req.user.email);
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, error: 'Ticket not found' });
    }

    if (!isAdmin && ticket.userId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, error: 'Forbidden' });
    }

    return res.json({
      success: true,
      isAdmin,
      ticket: {
        id: ticket._id,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        userEmail: ticket.userEmail,
        replies: (ticket.replies || []).map((r) => ({
          id: r._id,
          authorName: r.authorName,
          authorRole: r.authorRole,
          message: r.message,
          createdAt: r.createdAt,
        })),
        createdAt: ticket.createdAt,
      },
    });
  } catch (err) {
    console.error('Get ticket error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/support/:id/reply
 */
export async function replyToTicket(req, res) {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, error: 'Message required' });
    }
    if (message.length > 5000) {
      return res
        .status(400)
        .json({ success: false, error: 'Message too long' });
    }

    const isAdmin = isSuperAdmin(req.user.email);
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, error: 'Ticket not found' });
    }

    if (!isAdmin && ticket.userId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, error: 'Forbidden' });
    }

    ticket.replies.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: isAdmin ? 'admin' : 'user',
      message: message.trim(),
    });
    ticket.lastReplyAt = new Date();

    // Auto-move status
    if (isAdmin && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    if (!isAdmin && ticket.status === 'closed') {
      ticket.status = 'open';
    }

    await ticket.save();

    return res.status(201).json({
      success: true,
      message: 'Reply added',
    });
  } catch (err) {
    console.error('Reply error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/support/:id
 * Super admin only — change status/priority.
 */
export async function updateTicket(req, res) {
  try {
    const { status, priority } = req.body;
    const update = {};
    if (status) {
      if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      update.status = status;
      if (status === 'resolved') update.resolvedAt = new Date();
    }
    if (priority) {
      if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid priority' });
      }
      update.priority = priority;
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, error: 'Ticket not found' });
    }

    return res.json({
      success: true,
      ticket: { status: ticket.status, priority: ticket.priority },
    });
  } catch (err) {
    console.error('Update ticket error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
