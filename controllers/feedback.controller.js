import Message from '../models/Message.js';

/**
 * POST /api/feedback
 * Body: { messageId, feedback: 'up' | 'down', note?: string }
 */
export async function submitFeedback(req, res) {
  try {
    const { messageId, feedback, note } = req.body;
    const tenantId = req.tenantId;
    const userId = req.user._id;

    if (!messageId) {
      return res
        .status(400)
        .json({ success: false, error: 'messageId is required' });
    }

    if (!['up', 'down', null].includes(feedback)) {
      return res.status(400).json({
        success: false,
        error: 'feedback must be "up", "down", or null',
      });
    }

    const message = await Message.findOne({
      _id: messageId,
      tenantId,
      userId,
      role: 'assistant',
    });

    if (!message) {
      return res
        .status(404)
        .json({ success: false, error: 'Message not found' });
    }

    message.feedback = feedback;
    message.feedbackNote = note || null;
    message.feedbackAt = feedback ? new Date() : null;
    await message.save();

    return res.json({
      success: true,
      feedback: message.feedback,
    });
  } catch (err) {
    console.error('Submit feedback error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/feedback/stats
 * Aggregated ratings for the analytics dashboard.
 */
export async function getFeedbackStats(req, res) {
  try {
    const tenantId = req.tenantId;
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totals, byModel] = await Promise.all([
      Message.aggregate([
        {
          $match: {
            tenantId,
            role: 'assistant',
            feedback: { $ne: null },
            feedbackAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: '$feedback',
            count: { $sum: 1 },
          },
        },
      ]),
      Message.aggregate([
        {
          $match: {
            tenantId,
            role: 'assistant',
            feedback: { $ne: null },
            feedbackAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: {
              provider: '$provider',
              model: '$model',
              feedback: '$feedback',
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const up = totals.find((t) => t._id === 'up')?.count || 0;
    const down = totals.find((t) => t._id === 'down')?.count || 0;
    const total = up + down;

    // Group by provider
    const providerMap = {};
    for (const row of byModel) {
      const provider = row._id.provider || 'unknown';
      if (!providerMap[provider]) {
        providerMap[provider] = { provider, up: 0, down: 0 };
      }
      if (row._id.feedback === 'up') providerMap[provider].up += row.count;
      else if (row._id.feedback === 'down')
        providerMap[provider].down += row.count;
    }

    return res.json({
      success: true,
      range: { days, since },
      totals: {
        up,
        down,
        total,
        satisfaction: total ? Math.round((up / total) * 100) : null,
      },
      byProvider: Object.values(providerMap).map((p) => ({
        provider: p.provider,
        up: p.up,
        down: p.down,
        total: p.up + p.down,
        satisfaction:
          p.up + p.down > 0
            ? Math.round((p.up / (p.up + p.down)) * 100)
            : null,
      })),
    });
  } catch (err) {
    console.error('Get feedback stats error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
