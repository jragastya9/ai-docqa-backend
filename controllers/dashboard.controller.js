import Document from '../models/Document.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Tenant from '../models/Tenant.js';
import { getUsage } from '../services/usageService.js';
import { getPlan } from '../config/plans.js';

export async function getDashboardSummary(req, res) {
  try {
    const tenantId = req.tenantId;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [tenant, documentCount, conversationCount, monthMessages, recentDocs] =
      await Promise.all([
        Tenant.findById(tenantId),
        Document.countDocuments({ tenantId }),
        Conversation.countDocuments({ tenantId }),
        Message.countDocuments({
          tenantId,
          createdAt: { $gte: monthStart },
        }),
        Document.find({ tenantId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('fileName pageCount chunkCount status createdAt'),
      ]);

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }

    const usage = await getUsage(tenantId);
    const plan = getPlan(tenant.plan);

    return res.json({
      success: true,
      tenant: {
        name: tenant.name,
        plan: tenant.plan,
        planName: plan.name,
      },
      counts: {
        documents: documentCount,
        conversations: conversationCount,
        messagesThisMonth: monthMessages,
      },
      limits: plan.limits,
      usage: {
        documentCount: usage.documentCount,
        messageCount: usage.messageCount,
        aiTokensUsed: usage.aiTokensUsed,
        month: usage.month,
      },
      recentDocuments: recentDocs,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}