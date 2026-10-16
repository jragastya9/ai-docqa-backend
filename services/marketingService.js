import EmailLog from '../models/EmailLog.js';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import Document from '../models/Document.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Usage from '../models/Usage.js';
import {
  sendOnboarding1,
  sendOnboarding2,
  sendOnboarding3,
  sendTrialReminder,
  sendUsageWarning,
  sendWinBack,
  sendWeeklyDigest,
} from './emailService.js';

async function log({
  userId,
  tenantId,
  email,
  type,
  subject,
  status = 'sent',
  error = null,
  providerId = null,
}) {
  try {
    await EmailLog.create({
      userId,
      tenantId,
      email,
      type,
      subject,
      status,
      error,
      providerId,
    });
  } catch (err) {
    console.error('Email log error:', err.message);
  }
}

async function wasSent(userId, type, withinDays = 30) {
  const since = new Date();
  since.setDate(since.getDate() - withinDays);
  const found = await EmailLog.findOne({
    userId,
    type,
    status: 'sent',
    createdAt: { $gte: since },
  });
  return !!found;
}

/**
 * Send onboarding sequence based on user's onboardingStep.
 */
export async function runOnboardingDrip() {
  const now = Date.now();
  const users = await User.find({
    isActive: true,
    'emailPrefs.onboarding': { $ne: false },
    onboardingStep: { $lt: 3 },
  }).limit(200);

  let sent = 0;

  for (const user of users) {
    const created = new Date(user.createdAt).getTime();
    const daysSinceSignup = (now - created) / (1000 * 60 * 60 * 24);
    const step = user.onboardingStep || 0;

    let targetStep = step;
    if (step === 0 && daysSinceSignup >= 0.01 && daysSinceSignup < 3) {
      // Step 0 → send onboarding #1 (after 15 min)
      if (daysSinceSignup > 0.01) {
        const ok = await sendStep(user, 1);
        if (ok) {
          targetStep = 1;
          sent++;
        }
      }
    } else if (step === 1 && daysSinceSignup >= 1) {
      const ok = await sendStep(user, 2);
      if (ok) {
        targetStep = 2;
        sent++;
      }
    } else if (step === 2 && daysSinceSignup >= 3) {
      const ok = await sendStep(user, 3);
      if (ok) {
        targetStep = 3;
        sent++;
      }
    }

    if (targetStep !== step) {
      user.onboardingStep = targetStep;
      await user.save();
    }
  }

  return sent;
}

async function sendStep(user, step) {
  const type = `onboarding_${step}`;
  if (await wasSent(user._id, type, 7)) return false;

  try {
    if (step === 1) {
      const res = await sendOnboarding1({
        to: user.email,
        name: user.name,
        userId: user._id,
      });
      await log({
        userId: user._id,
        tenantId: user.tenantId,
        email: user.email,
        type,
        subject: 'Your first 5 minutes with LocalBiz AI',
        providerId: res?.id,
      });
      return true;
    }
    if (step === 2) {
      const docCount = await Document.countDocuments({
        tenantId: user.tenantId,
      });
      const res = await sendOnboarding2({
        to: user.email,
        name: user.name,
        userId: user._id,
        docCount,
      });
      await log({
        userId: user._id,
        tenantId: user.tenantId,
        email: user.email,
        type,
        subject: docCount ? 'Share your AI' : 'Need a hand?',
        providerId: res?.id,
      });
      return true;
    }
    if (step === 3) {
      const res = await sendOnboarding3({
        to: user.email,
        name: user.name,
        userId: user._id,
      });
      await log({
        userId: user._id,
        tenantId: user.tenantId,
        email: user.email,
        type,
        subject: 'Unlock Pro features',
        providerId: res?.id,
      });
      return true;
    }
  } catch (err) {
    await log({
      userId: user._id,
      tenantId: user.tenantId,
      email: user.email,
      type,
      subject: '',
      status: 'failed',
      error: err.message,
    });
  }
  return false;
}

/**
 * Warn users at 80%+ of monthly message limit.
 */
export async function runUsageWarnings() {
  const month = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, '0')}`;

  const { getPlan } = await import('../config/plans.js');

  const usages = await Usage.find({ month }).limit(500);
  let sent = 0;

  for (const usage of usages) {
    const tenant = await Tenant.findById(usage.tenantId);
    if (!tenant) continue;

    const plan = getPlan(tenant.plan);
    const limit = plan.limits.messagesPerMonth;
    if (limit === -1) continue;

    const pct = (usage.messageCount / limit) * 100;
    if (pct < 80 || pct >= 100) continue;

    if (await wasSent(tenant.ownerId, 'usage_warning', 20)) continue;

    const owner = await User.findById(tenant.ownerId);
    if (!owner || owner.emailPrefs?.marketing === false) continue;

    try {
      const res = await sendUsageWarning({
        to: owner.email,
        name: owner.name,
        userId: owner._id,
        percentUsed: Math.round(pct),
        resource: 'messages',
        used: usage.messageCount,
        limit,
      });
      await log({
        userId: owner._id,
        tenantId: tenant._id,
        email: owner.email,
        type: 'usage_warning',
        subject: `Usage at ${Math.round(pct)}%`,
        providerId: res?.id,
      });
      sent++;
    } catch (err) {
      await log({
        userId: owner._id,
        tenantId: tenant._id,
        email: owner.email,
        type: 'usage_warning',
        subject: '',
        status: 'failed',
        error: err.message,
      });
    }
  }

  return sent;
}

/**
 * Win-back for users inactive 14+ days.
 */
export async function runWinBack() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const users = await User.find({
    isActive: true,
    'emailPrefs.marketing': { $ne: false },
    lastActiveAt: { $lt: cutoff },
  }).limit(100);

  let sent = 0;

  for (const user of users) {
    if (await wasSent(user._id, 'win_back', 60)) continue;

    try {
      const res = await sendWinBack({
        to: user.email,
        name: user.name,
        userId: user._id,
      });
      await log({
        userId: user._id,
        tenantId: user.tenantId,
        email: user.email,
        type: 'win_back',
        subject: 'Come back',
        providerId: res?.id,
      });
      sent++;
    } catch (err) {
      await log({
        userId: user._id,
        tenantId: user.tenantId,
        email: user.email,
        type: 'win_back',
        subject: '',
        status: 'failed',
        error: err.message,
      });
    }
  }

  return sent;
}

/**
 * Weekly digest every Sunday.
 */
export async function runWeeklyDigest() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const tenants = await Tenant.find({ isActive: true }).limit(200);
  let sent = 0;

  for (const tenant of tenants) {
    const owner = await User.findById(tenant.ownerId);
    if (!owner || owner.emailPrefs?.weeklyDigest === false) continue;

    const [msgCount, convCount, docCount] = await Promise.all([
      Message.countDocuments({
        tenantId: tenant._id,
        createdAt: { $gte: weekAgo },
      }),
      Conversation.countDocuments({
        tenantId: tenant._id,
        createdAt: { $gte: weekAgo },
      }),
      Document.countDocuments({ tenantId: tenant._id }),
    ]);

    // Skip if no activity this week
    if (msgCount === 0 && convCount === 0) continue;

    // Top questions
    const topQ = await Message.aggregate([
      {
        $match: {
          tenantId: tenant._id,
          role: 'user',
          createdAt: { $gte: weekAgo },
        },
      },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$content' } } },
          count: { $sum: 1 },
          question: { $first: '$content' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]);

    try {
      const res = await sendWeeklyDigest({
        to: owner.email,
        name: owner.name,
        userId: owner._id,
        stats: {
          messages: msgCount,
          conversations: convCount,
          documents: docCount,
        },
        topQuestions: topQ.map((q) => ({
          question: q.question,
          count: q.count,
        })),
      });
      await log({
        userId: owner._id,
        tenantId: tenant._id,
        email: owner.email,
        type: 'weekly_digest',
        subject: `${msgCount} messages this week`,
        providerId: res?.id,
      });
      sent++;
    } catch (err) {
      await log({
        userId: owner._id,
        tenantId: tenant._id,
        email: owner.email,
        type: 'weekly_digest',
        subject: '',
        status: 'failed',
        error: err.message,
      });
    }
  }

  return sent;
}

/**
 * Trial reminders — 2 days before trialEndsAt.
 */
export async function runTrialReminders() {
  const now = new Date();
  const target = new Date();
  target.setDate(target.getDate() + 2);

  const users = await User.find({
    isActive: true,
    trialEndsAt: {
      $gte: target,
      $lt: new Date(target.getTime() + 24 * 60 * 60 * 1000),
    },
  }).limit(100);

  let sent = 0;

  for (const user of users) {
    if (await wasSent(user._id, 'trial_reminder', 10)) continue;
    const daysLeft = Math.ceil(
      (user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    try {
      const res = await sendTrialReminder({
        to: user.email,
        name: user.name,
        userId: user._id,
        daysLeft,
      });
      await log({
        userId: user._id,
        tenantId: user.tenantId,
        email: user.email,
        type: 'trial_reminder',
        subject: `Trial ends in ${daysLeft} days`,
        providerId: res?.id,
      });
      sent++;
    } catch (err) {
      await log({
        userId: user._id,
        tenantId: user.tenantId,
        email: user.email,
        type: 'trial_reminder',
        subject: '',
        status: 'failed',
        error: err.message,
      });
    }
  }

  return sent;
}

/**
 * Master run — call daily.
 */
export async function runDailyJobs() {
  console.log('📧 Running daily marketing jobs...');
  const [onboarding, usage, winback, trials] = await Promise.all([
    runOnboardingDrip(),
    runUsageWarnings(),
    runWinBack(),
    runTrialReminders(),
  ]);
  console.log(
    `📧 Daily jobs done: onboarding=${onboarding}, usage=${usage}, winback=${winback}, trials=${trials}`
  );
  return { onboarding, usage, winback, trials };
}

export async function runWeeklyJobs() {
  console.log('📧 Running weekly marketing jobs...');
  const digest = await runWeeklyDigest();
  console.log(`📧 Weekly digest sent to ${digest} tenants`);
  return { digest };
}
