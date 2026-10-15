import Notification from '../models/Notification.js';
import {
  subscribe,
  unsubscribe,
  emitRead,
  emitReadAll,
} from '../services/notificationService.js';

export async function listNotifications(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const userId = req.user._id;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId, read: false }),
    ]);

    return res.json({
      success: true,
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        description: n.description,
        href: n.href,
        read: n.read,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    console.error('List notifications error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function markRead(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notif) {
      return res
        .status(404)
        .json({ success: false, error: 'Notification not found' });
    }

    emitRead(userId, id);

    return res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function markAllRead(req, res) {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );

    emitReadAll(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteNotification(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    await Notification.findOneAndDelete({ _id: id, userId });

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete notification error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function streamNotifications(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(': connected\n\n');

  const userId = req.user._id;
  subscribe(userId, res);

  try {
    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });
    res.write(`event: init\ndata: ${JSON.stringify({ unreadCount })}\n\n`);
  } catch {
    // ignore
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe(userId, res);
    res.end();
  });
}
