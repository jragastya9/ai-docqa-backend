import crypto from 'crypto';
import Webhook from '../models/Webhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import Tenant from '../models/Tenant.js';

export const AVAILABLE_EVENTS = [
  'document.uploaded',
  'document.deleted',
  'conversation.created',
  'subscription.upgraded',
  'subscription.downgraded',
  'member.invited',
  'member.removed',
  'share_link.created',
];

const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY = 1024;

function sign(body, secret) {
  return (
    'sha256=' +
    crypto.createHmac('sha256', secret).update(body).digest('hex')
  );
}

async function deliver(webhook, event, data) {
  const started = Date.now();

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    tenant: {
      id: webhook.tenantId.toString(),
      name: data?.tenantName || null,
    },
    data,
  };

  const body = JSON.stringify(payload);
  const signature = sign(body, webhook.secret);
  const deliveryId = `d_${crypto.randomBytes(8).toString('hex')}`;

  let responseStatus = null;
  let responseBody = '';
  let error = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LocalBiz-Webhooks/1.0',
        'X-LocalBiz-Event': event,
        'X-LocalBiz-Signature': signature,
        'X-LocalBiz-Delivery': deliveryId,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    responseStatus = res.status;
    const text = await res.text();
    responseBody = text.slice(0, MAX_RESPONSE_BODY);
    success = res.status >= 200 && res.status < 300;
  } catch (err) {
    error = err.name === 'AbortError' ? 'Timeout' : err.message;
  }

  const duration = Date.now() - started;

  try {
    await WebhookDelivery.create({
      webhookId: webhook._id,
      tenantId: webhook.tenantId,
      event,
      payload,
      responseStatus,
      responseBody,
      duration,
      success,
      error,
    });

    await Webhook.findByIdAndUpdate(webhook._id, {
      lastTriggeredAt: new Date(),
      $inc: { failureCount: success ? 0 : 1 },
    });
  } catch (logErr) {
    console.error('Failed to log webhook delivery:', logErr.message);
  }

  return { success, responseStatus, duration, error, deliveryId };
}

/**
 * Fire an event to all active webhooks for a tenant that subscribe to it.
 * Non-blocking — callers don't await.
 */
export async function fireWebhook({ tenantId, event, data = {} }) {
  try {
    const tenant = await Tenant.findById(tenantId).select('name');
    const payload = { ...data, tenantName: tenant?.name };

    const hooks = await Webhook.find({
      tenantId,
      active: true,
      events: event,
    });

    // Fire in parallel, don't await individually
    await Promise.all(
      hooks.map((h) =>
        deliver(h, event, payload).catch((err) =>
          console.error(`Webhook ${h._id} failed:`, err.message)
        )
      )
    );
  } catch (err) {
    console.error('fireWebhook error:', err.message);
  }
}
