import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Document from '../models/Document.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Subscription from '../models/Subscription.js';
import Usage from '../models/Usage.js';
import ImpersonationLog from '../models/ImpersonationLog.js';
import { signToken } from '../utils/jwt.js';

const PLAN_PRICES = { free: 0, pro: 49900, business: 199900 };

/**
 * GET /api/admin/overview
 * Global stats for the admin dashboard.
 */
export async function getOverview(req, res) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalTenants,
      totalUsers,
      activeSubscriptions,
      totalDocuments,
      totalMessages,
      signupsToday,
      signupsWeek,
      signupsMonth,
      tenantsByPlan,
      recentTenants,
      dailySignups,
    ] = await Promise.all([
      Tenant.countDocuments(),
      User.countDocuments(),
      Subscription.find({ status: 'active' }),
      Document.countDocuments(),
      Message.countDocuments(),
      Tenant.countDocuments({ createdAt: { $gte: todayStart } }),
      Tenant.countDocuments({ createdAt: { $gte: weekStart } }),
      Tenant.countDocuments({ createdAt: { $gte: monthStart } }),
      Tenant.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
      Tenant.find().sort({ createdAt: -1 }).limit(10).lean(),
      Tenant.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const mrr = activeSubscriptions.reduce(
      (sum, s) => sum + (s.amount || 0),
      0
    );
    const arr = mrr * 12;

    // Fill in daily signups for the last 30 days
    const signupTrend = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = dailySignups.find((x) => x._id === key);
      signupTrend.push({
        date: key,
        label: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        count: found ? found.count : 0,
      });
    }

    const planMap = {};
    for (const p of tenantsByPlan) planMap[p._id] = p.count;

    return res.json({
      success: true,
      totals: {
        tenants: totalTenants,
        users: totalUsers,
        documents: totalDocuments,
        messages: totalMessages,
        mrr,
        arr,
      },
      signups: {
        today: signupsToday,
        week: signupsWeek,
        month: signupsMonth,
      },
      planDistribution: [
        { plan: 'free', count: planMap.free || 0 },
        { plan: 'pro', count: planMap.pro || 0 },
        { plan: 'business', count: planMap.business || 0 },
      ],
      signupTrend,
      recentTenants: recentTenants.map((t) => ({
        id: t._id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        subdomain: t.subdomain,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/tenants?search=&plan=
 * Full list with usage counts.
 */
export async function listAllTenants(req, res) {
  try {
    const { search = '', plan } = req.query;

    const filter = {};
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      filter.$or = [{ name: regex }, { slug: regex }, { subdomain: regex }];
    }
    if (plan && ['free', 'pro', 'business'].includes(plan)) {
      filter.plan = plan;
    }

    const tenants = await Tenant.find(filter).sort({ createdAt: -1 }).lean();

    // Enrich with counts
    const enriched = await Promise.all(
      tenants.map(async (t) => {
        const [userCount, docCount, sub] = await Promise.all([
          User.countDocuments({ tenantId: t._id }),
          Document.countDocuments({ tenantId: t._id }),
          Subscription.findOne({ tenantId: t._id, status: 'active' }).sort({
            createdAt: -1,
          }),
        ]);

        return {
          id: t._id,
          name: t.name,
          slug: t.slug,
          subdomain: t.subdomain,
          plan: t.plan,
          isActive: t.isActive,
          createdAt: t.createdAt,
          userCount,
          docCount,
          mrr: sub?.amount || 0,
          brandName: t.settings?.brandName || null,
        };
      })
    );

    return res.json({
      success: true,
      total: enriched.length,
      tenants: enriched,
    });
  } catch (err) {
    console.error('Admin list tenants error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/tenants/:id
 * Full detail of one tenant.
 */
export async function getTenantDetail(req, res) {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }

    const monthKey = `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1
    ).padStart(2, '0')}`;

    const [
      users,
      docCount,
      convCount,
      msgCount,
      usage,
      subscriptions,
      recentDocs,
    ] = await Promise.all([
      User.find({ tenantId: tenant._id })
        .select('name email role emailVerified createdAt lastLoginAt')
        .sort({ createdAt: 1 }),
      Document.countDocuments({ tenantId: tenant._id }),
      Conversation.countDocuments({ tenantId: tenant._id }),
      Message.countDocuments({ tenantId: tenant._id }),
      Usage.findOne({ tenantId: tenant._id, month: monthKey }),
      Subscription.find({ tenantId: tenant._id }).sort({ createdAt: -1 }).limit(5),
      Document.find({ tenantId: tenant._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fileName pageCount chunkCount status createdAt'),
    ]);

    return res.json({
      success: true,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        customDomain: tenant.customDomain,
        domainVerified: tenant.domainVerified,
        plan: tenant.plan,
        isActive: tenant.isActive,
        ownerId: tenant.ownerId,
        settings: tenant.settings || {},
        createdAt: tenant.createdAt,
      },
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
      counts: {
        documents: docCount,
        conversations: convCount,
        messages: msgCount,
      },
      usage: usage
        ? {
            documentCount: usage.documentCount,
            messageCount: usage.messageCount,
            aiTokensUsed: usage.aiTokensUsed,
            month: usage.month,
          }
        : null,
      subscriptions: subscriptions.map((s) => ({
        id: s._id,
        plan: s.plan,
        status: s.status,
        amount: s.amount,
        currentPeriodEnd: s.currentPeriodEnd,
        createdAt: s.createdAt,
      })),
      recentDocuments: recentDocs.map((d) => ({
        id: d._id,
        fileName: d.fileName,
        pageCount: d.pageCount,
        chunkCount: d.chunkCount,
        status: d.status,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    console.error('Admin tenant detail error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/admin/tenants/:id/impersonate
 * Returns a JWT for the tenant's owner (or the first user).
 */
export async function impersonateTenant(req, res) {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }

    // Prefer the owner; fall back to the first user
    let target = await User.findById(tenant.ownerId);
    if (!target) {
      target = await User.findOne({ tenantId: tenant._id }).sort({
        createdAt: 1,
      });
    }

    if (!target) {
      return res
        .status(404)
        .json({ success: false, error: 'No user found in this tenant' });
    }

    // Log the impersonation
    await ImpersonationLog.create({
      adminUserId: req.user._id,
      adminEmail: req.user.email,
      targetUserId: target._id,
      targetEmail: target.email,
      targetTenantId: tenant._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      reason: req.body?.reason || '',
    });

    const token = signToken(target);

    return res.json({
      success: true,
      token,
      user: {
        id: target._id,
        name: target.name,
        email: target.email,
        role: target.role,
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
      warning: 'You are now acting as this user. Log out to end impersonation.',
    });
  } catch (err) {
    console.error('Impersonate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/admin/tenants/:id/plan
 * Body: { plan }
 */
export async function changeTenantPlan(req, res) {
  try {
    const { plan } = req.body;
    if (!['free', 'pro', 'business'].includes(plan)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid plan' });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { plan },
      { new: true }
    );
    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }

    // If upgrading to paid, create a subscription record
    if (plan !== 'free') {
      await Subscription.create({
        tenantId: tenant._id,
        plan,
        status: 'active',
        razorpaySubscriptionId: `admin_override_${Date.now()}`,
        amount: PLAN_PRICES[plan],
        currency: 'INR',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    return res.json({ success: true, tenant: { plan: tenant.plan } });
  } catch (err) {
    console.error('Change plan error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/admin/tenants/:id/active
 * Body: { isActive }
 * Suspend or reactivate a tenant.
 */
export async function toggleTenantActive(req, res) {
  try {
    const { isActive } = req.body;
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { isActive: !!isActive },
      { new: true }
    );
    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }
    return res.json({
      success: true,
      tenant: { id: tenant._id, isActive: tenant.isActive },
    });
  } catch (err) {
    console.error('Toggle tenant error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/admin/tenants/:id/features
 * Body: { featureFlags: { ... } }
 */
export async function updateFeatureFlags(req, res) {
  try {
    const { featureFlags } = req.body;
    if (!featureFlags || typeof featureFlags !== 'object') {
      return res
        .status(400)
        .json({ success: false, error: 'featureFlags object required' });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { $set: { 'settings.featureFlags': featureFlags } },
      { new: true }
    );
    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }

    return res.json({
      success: true,
      featureFlags: tenant.settings?.featureFlags || {},
    });
  } catch (err) {
    console.error('Update feature flags error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/impersonations
 * Recent impersonation logs.
 */
export async function listImpersonations(req, res) {
  try {
    const logs = await ImpersonationLog.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      logs: logs.map((l) => ({
        id: l._id,
        adminEmail: l.adminEmail,
        targetEmail: l.targetEmail,
        targetTenantId: l.targetTenantId,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error('List impersonations error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
