import crypto from 'crypto';
import Tenant from '../models/Tenant.js';
import Subscription from '../models/Subscription.js';
import { getUsage } from '../services/usageService.js';
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