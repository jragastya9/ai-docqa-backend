import Usage from '../models/Usage.js';
import { getPlan } from '../config/plans.js';

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getUsage(tenantId) {
  const month = getCurrentMonth();
  let usage = await Usage.findOne({ tenantId, month });
  if (!usage) {
    usage = await Usage.create({ tenantId, month });
  }
  return usage;
}

export async function canAddDocument(tenantId, planName) {
  const plan = getPlan(planName);
  if (plan.limits.documents === -1) return { allowed: true };

  const usage = await getUsage(tenantId);
  if (usage.documentCount >= plan.limits.documents) {
    return {
      allowed: false,
      reason: `Your ${plan.name} plan allows ${plan.limits.documents} document(s). Please upgrade to add more.`,
    };
  }
  return { allowed: true };
}

export async function canSendMessage(tenantId, planName) {
  const plan = getPlan(planName);
  if (plan.limits.messagesPerMonth === -1) return { allowed: true };

  const usage = await getUsage(tenantId);
  if (usage.messageCount >= plan.limits.messagesPerMonth) {
    return {
      allowed: false,
      reason: `You've used all ${plan.limits.messagesPerMonth} messages for this month. Upgrade for more.`,
    };
  }
  return { allowed: true };
}

export async function incrementDocuments(tenantId, amount = 1) {
  const month = getCurrentMonth();
  await Usage.findOneAndUpdate(
    { tenantId, month },
    {
      $inc: { documentCount: amount },
      $setOnInsert: { tenantId, month },
    },
    { upsert: true, new: true }
  );
}

export async function incrementMessages(tenantId, amount = 1) {
  const month = getCurrentMonth();
  await Usage.findOneAndUpdate(
    { tenantId, month },
    {
      $inc: { messageCount: amount },
      $setOnInsert: { tenantId, month },
    },
    { upsert: true, new: true }
  );
}

export async function incrementTokens(tenantId, amount) {
  const month = getCurrentMonth();
  await Usage.findOneAndUpdate(
    { tenantId, month },
    {
      $inc: { aiTokensUsed: amount },
      $setOnInsert: { tenantId, month },
    },
    { upsert: true, new: true }
  );
}