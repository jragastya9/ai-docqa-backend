import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Usage from '../models/Usage.js';

/**
 * GET /api/analytics/overview?days=30
 * Returns all dashboard metrics for the current tenant.
 */
export async function getOverview(req, res) {
  try {
    const tenantId = req.tenantId;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 90);

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - days);

    // ─── Totals ───
    const [totalConversations, totalMessages, totalDocuments] =
      await Promise.all([
        Conversation.countDocuments({ tenantId }),
        Message.countDocuments({ tenantId }),
        Document.countDocuments({ tenantId }),
      ]);

    // ─── Current period counts ───
    const [messagesInRange, conversationsInRange] = await Promise.all([
      Message.countDocuments({
        tenantId,
        createdAt: { $gte: since },
      }),
      Conversation.countDocuments({
        tenantId,
        createdAt: { $gte: since },
      }),
    ]);

    // ─── Messages per day (line chart) ───
    const dailyAgg = await Message.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill in missing days with 0
    const messagesByDay = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const found = dailyAgg.find((x) => x._id === key);
      messagesByDay.push({
        date: key,
        label: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        count: found ? found.count : 0,
      });
    }

    // ─── Top questions (bar chart) ───
    const topQuestionsAgg = await Message.aggregate([
      {
        $match: {
          tenantId,
          role: 'user',
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$content' } } },
          count: { $sum: 1 },
          sample: { $first: '$content' },
        },
      },
      { $match: { count: { $gte: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    const topQuestions = topQuestionsAgg.map((q) => ({
      question:
        q.sample.length > 60 ? q.sample.slice(0, 60) + '...' : q.sample,
      count: q.count,
    }));

    // ─── Popular documents (based on message sources) ───
    const popularDocsAgg = await Message.aggregate([
      {
        $match: {
          tenantId,
          role: 'assistant',
          createdAt: { $gte: since },
          'sources.0': { $exists: true },
        },
      },
      { $unwind: '$sources' },
      {
        $group: {
          _id: '$sources.documentId',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const docIds = popularDocsAgg.map((d) => d._id).filter(Boolean);
    const docDetails = await Document.find({
      _id: { $in: docIds },
    }).select('fileName pageCount');

    const docMap = Object.fromEntries(
      docDetails.map((d) => [d._id.toString(), d])
    );

    const totalCitations = popularDocsAgg.reduce(
      (sum, d) => sum + d.count,
      0
    );

    const popularDocuments = popularDocsAgg.map((d) => {
      const doc = docMap[d._id?.toString()];
      return {
        id: d._id?.toString() || 'unknown',
        name: doc?.fileName || 'Unknown document',
        pages: doc?.pageCount || 0,
        citations: d.count,
        percentage: totalCitations
          ? Math.round((d.count / totalCitations) * 100)
          : 0,
      };
    });

    // ─── Response time trend (avg time per day from message tokensUsed as proxy) ───
    // Since we don't store response time explicitly, we use message count
    // In production you'd log duration. For now, approximate with message/day.
    // If you want real response times, add a `durationMs` field to Message schema.

    // ─── Device breakdown (from user agent at message creation time) ───
    // Not stored yet. Placeholder for now: assume 65% desktop, 35% mobile.
    // Real implementation: add `deviceType` field to Message schema on chat create.
    const deviceBreakdown = [
      { name: 'Desktop', value: 65, color: '#6366f1' },
      { name: 'Mobile', value: 35, color: '#a855f7' },
    ];

    // ─── Current month usage ───
    const monthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`;
    const usage = await Usage.findOne({ tenantId, month: monthKey });

    // ─── Summary response ───
    return res.json({
      success: true,
      range: { days, since, until: now },
      totals: {
        conversations: totalConversations,
        messages: totalMessages,
        documents: totalDocuments,
        citations: totalCitations,
      },
      period: {
        days,
        conversations: conversationsInRange,
        messages: messagesInRange,
      },
      messagesByDay,
      topQuestions,
      popularDocuments,
      deviceBreakdown,
      usage: usage
        ? {
            documentCount: usage.documentCount,
            messageCount: usage.messageCount,
            aiTokensUsed: usage.aiTokensUsed,
          }
        : {
            documentCount: 0,
            messageCount: 0,
            aiTokensUsed: 0,
          },
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/analytics/export?days=30
 * Returns CSV for download.
 */
export async function exportCSV(req, res) {
  try {
    const tenantId = req.tenantId;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 90);

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - days);

    const dailyAgg = await Message.aggregate([
      {
        $match: { tenantId, createdAt: { $gte: since } },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          total: { $sum: 1 },
          user: {
            $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] },
          },
          assistant: {
            $sum: { $cond: [{ $eq: ['$role', 'assistant'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const rows = ['date,total,user,assistant'];
    for (const day of dailyAgg) {
      rows.push(`${day._id},${day.total},${day.user},${day.assistant}`);
    }

    const csv = rows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics-${days}d.csv"`
    );
    return res.send(csv);
  } catch (err) {
    console.error('CSV export error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
