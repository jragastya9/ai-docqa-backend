import crypto from 'crypto';
import Tenant from '../models/Tenant.js';
import Subscription from '../models/Subscription.js';
import { getUsage } from '../services/usageService.js';
import { notify } from '../services/notificationService.js';
import { fireWebhook } from '../services/webhookService.js';
import { PLANS, getPlan } from '../config/plans.js';

export async function listPlans(req, res) {
  res.json({
    success: true,
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })),
  });
}

export async function getCurrentSubscription(req, res) {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    const subscription = await Subscription.findOne({
      tenantId: req.tenantId,
    }).sort({ createdAt: -1 });

    const usage = await getUsage(req.tenantId);
    const plan = getPlan(tenant.plan);

    res.json({
      success: true,
      tenant: { plan: tenant.plan, name: tenant.name },
      subscription,
      usage,
      plan,
    });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createSubscription(req, res) {
  try {
    const { plan } = req.body;

    if (!plan || !['pro', 'business'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan. Choose pro or business.',
      });
    }

    const planConfig = PLANS[plan];

    const order = {
      id: `mock_order_${Date.now()}_${crypto
        .randomBytes(4)
        .toString('hex')}`,
      amount: planConfig.price,
      currency: planConfig.currency,
    };

    res.json({
      success: true,
      order,
      key: 'mock_key',
      mock: true,
    });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function verifyPayment(req, res) {
  try {
    const { razorpay_payment_id, plan } = req.body;

    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Plan is required',
      });
    }

    if (!['pro', 'business'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan',
      });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenantId,
      { plan },
      { new: true }
    );

    await Subscription.create({
      tenantId: req.tenantId,
      plan,
      status: 'active',
      razorpaySubscriptionId:
        razorpay_payment_id || `mock_pay_${Date.now()}`,
      amount: PLANS[plan].price,
      currency: PLANS[plan].currency,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Notify
    try {
      await notify({
        userId: req.user._id,
        tenantId: req.tenantId,
        type: 'plan_upgraded',
        title: `Upgraded to ${PLANS[plan].name}`,
        description: `Your workspace is now on the ${PLANS[plan].name} plan.`,
        href: '/billing',
        meta: { plan },
      });
    } catch (notifErr) {
      console.error('Upgrade notification failed:', notifErr.message);
    }

    // Fire webhook
    try {
      await fireWebhook({
        tenantId: req.tenantId,
        event: 'subscription.upgraded',
        data: {
          plan,
          planName: PLANS[plan].name,
          amount: PLANS[plan].price,
          currency: PLANS[plan].currency,
        },
      });
    } catch (whErr) {
      console.error('Upgrade webhook failed:', whErr.message);
    }

    res.json({
      success: true,
      message: 'Payment verified, plan upgraded',
      tenant: { plan: tenant.plan },
      mock: true,
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleWebhook(req, res) {
  console.log('📩 Mock webhook received:', req.body?.event);
  res.json({ success: true, mock: true });
}

export async function cancelSubscription(req, res) {
  try {
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenantId,
      { plan: 'free' },
      { new: true }
    );

    await Subscription.findOneAndUpdate(
      { tenantId: req.tenantId, status: 'active' },
      { status: 'cancelled' }
    );

    // Notify
    try {
      await notify({
        userId: req.user._id,
        tenantId: req.tenantId,
        type: 'plan_downgraded',
        title: 'Downgraded to Free',
        description: 'Your workspace is back on the Free plan.',
        href: '/billing',
      });
    } catch (notifErr) {
      console.error('Downgrade notification failed:', notifErr.message);
    }

    // Fire webhook
    try {
      await fireWebhook({
        tenantId: req.tenantId,
        event: 'subscription.downgraded',
        data: { plan: 'free' },
      });
    } catch (whErr) {
      console.error('Downgrade webhook failed:', whErr.message);
    }

    res.json({
      success: true,
      message: 'Downgraded to free plan',
      tenant: { plan: tenant.plan },
    });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
