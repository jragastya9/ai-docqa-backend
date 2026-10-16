import EmailLog from '../models/EmailLog.js';
import User from '../models/User.js';
import {
  runDailyJobs,
  runWeeklyJobs,
} from '../services/marketingService.js';

/**
 * GET /api/marketing/logs
 * Super admin: recent email sends.
 */
export async function listEmailLogs(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const logs = await EmailLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      logs: logs.map((l) => ({
        id: l._id,
        email: l.email,
        type: l.type,
        subject: l.subject,
        status: l.status,
        error: l.error,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error('List email logs error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/marketing/stats
 * Super admin: email performance.
 */
export async function getEmailStats(req, res) {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [byType, totals] = await Promise.all([
      EmailLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { type: '$type', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]),
      EmailLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    // Group by type
    const typeMap = {};
    for (const row of byType) {
      const t = row._id.type;
      if (!typeMap[t]) typeMap[t] = { type: t, sent: 0, failed: 0 };
      if (row._id.status === 'sent') typeMap[t].sent += row.count;
      else typeMap[t].failed += row.count;
    }

    const sent = totals.find((t) => t._id === 'sent')?.count || 0;
    const failed = totals.find((t) => t._id === 'failed')?.count || 0;

    return res.json({
      success: true,
      range: { days, since },
      totals: { sent, failed, total: sent + failed },
      byType: Object.values(typeMap),
    });
  } catch (err) {
    console.error('Get email stats error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/marketing/run
 * Super admin: manually trigger.
 * Body: { job: 'daily' | 'weekly' }
 */
export async function triggerJobs(req, res) {
  try {
    const { job = 'daily' } = req.body;

    const result =
      job === 'weekly' ? await runWeeklyJobs() : await runDailyJobs();

    return res.json({ success: true, result });
  } catch (err) {
    console.error('Trigger jobs error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/marketing/unsubscribe
 * Public endpoint. Body: { userId, type }
 */
export async function unsubscribe(req, res) {
  try {
    const { userId, type } = req.body;

    if (!userId || !type) {
      return res
        .status(400)
        .json({ success: false, error: 'userId and type required' });
    }

    const validTypes = ['marketing', 'onboarding', 'weeklyDigest'];
    if (!validTypes.includes(type)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid type' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'User not found' });
    }

    user.emailPrefs = user.emailPrefs || {};
    user.emailPrefs[type] = false;

    // If they unsubscribe from marketing, disable everything except critical
    if (type === 'marketing') {
      user.emailPrefs.marketing = false;
      user.emailPrefs.onboarding = false;
      user.emailPrefs.weeklyDigest = false;
      user.emailPrefs.unsubscribedAt = new Date();
    }

    await user.save();

    return res.json({ success: true, message: 'Unsubscribed' });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/marketing/preferences/:userId
 * Public — for the unsubscribe page.
 */
export async function getPreferences(req, res) {
  try {
    const user = await User.findById(req.params.userId).select(
      'email emailPrefs name'
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'User not found' });
    }

    return res.json({
      success: true,
      email: user.email,
      name: user.name,
      prefs: {
        marketing: user.emailPrefs?.marketing !== false,
        onboarding: user.emailPrefs?.onboarding !== false,
        weeklyDigest: user.emailPrefs?.weeklyDigest !== false,
      },
    });
  } catch (err) {
    console.error('Get preferences error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
