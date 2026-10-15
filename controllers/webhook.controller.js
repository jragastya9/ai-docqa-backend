import Webhook from '../models/Webhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import { AVAILABLE_EVENTS, fireWebhook } from '../services/webhookService.js';

/**
 * GET /api/webhooks
 */
export async function listWebhooks(req, res) {
  try {
    const hooks = await Webhook.find({ tenantId: req.tenantId }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      availableEvents: AVAILABLE_EVENTS,
      webhooks: hooks.map((h) => ({
        id: h._id,
        url: h.url,
        events: h.events,
        description: h.description,
        active: h.active,
        secret: h.secret,
        lastTriggeredAt: h.lastTriggeredAt,
        failureCount: h.failureCount,
        createdAt: h.createdAt,
      })),
    });
  } catch (err) {
    console.error('List webhooks error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/webhooks
 */
export async function createWebhook(req, res) {
  try {
    const { url, events, description = '' } = req.body;

    if (!url || typeof url !== 'string') {
      return res
        .status(400)
        .json({ success: false, error: 'URL is required' });
    }

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid URL format' });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'Select at least one event' });
    }

    const invalid = events.filter((e) => !AVAILABLE_EVENTS.includes(e));
    if (invalid.length) {
      return res.status(400).json({
        success: false,
        error: `Unknown events: ${invalid.join(', ')}`,
      });
    }

    const secret = Webhook.generateSecret();

    const webhook = await Webhook.create({
      tenantId: req.tenantId,
      url,
      events,
      description,
      secret,
    });

    return res.status(201).json({
      success: true,
      message: 'Webhook created',
      webhook: {
        id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        active: webhook.active,
        secret: webhook.secret,
        createdAt: webhook.createdAt,
      },
    });
  } catch (err) {
    console.error('Create webhook error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/webhooks/:id
 */
export async function updateWebhook(req, res) {
  try {
    const { id } = req.params;
    const { url, events, description, active } = req.body;

    const hook = await Webhook.findOne({ _id: id, tenantId: req.tenantId });
    if (!hook) {
      return res
        .status(404)
        .json({ success: false, error: 'Webhook not found' });
    }

    if (url !== undefined) {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol))
          throw new Error();
        hook.url = url;
      } catch {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid URL format' });
      }
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'Select at least one event' });
      }
      const invalid = events.filter((e) => !AVAILABLE_EVENTS.includes(e));
      if (invalid.length) {
        return res.status(400).json({
          success: false,
          error: `Unknown events: ${invalid.join(', ')}`,
        });
      }
      hook.events = events;
    }

    if (description !== undefined) hook.description = description;
    if (active !== undefined) hook.active = active;

    await hook.save();

    return res.json({ success: true, message: 'Webhook updated' });
  } catch (err) {
    console.error('Update webhook error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/webhooks/:id
 */
export async function deleteWebhook(req, res) {
  try {
    const { id } = req.params;

    const hook = await Webhook.findOneAndDelete({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!hook) {
      return res
        .status(404)
        .json({ success: false, error: 'Webhook not found' });
    }

    await WebhookDelivery.deleteMany({ webhookId: hook._id });

    return res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    console.error('Delete webhook error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/webhooks/:id/test
 * Sends a test event to the webhook URL.
 */
export async function testWebhook(req, res) {
  try {
    const { id } = req.params;

    const hook = await Webhook.findOne({ _id: id, tenantId: req.tenantId });
    if (!hook) {
      return res
        .status(404)
        .json({ success: false, error: 'Webhook not found' });
    }

    await fireWebhook({
      tenantId: req.tenantId,
      event: 'document.uploaded', // sample event for testing
      data: {
        test: true,
        message: 'This is a test delivery from LocalBiz AI',
        documentId: 'test_doc_123',
        fileName: 'sample.pdf',
      },
    });

    return res.json({
      success: true,
      message: 'Test event sent. Check your endpoint and delivery logs.',
    });
  } catch (err) {
    console.error('Test webhook error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/webhooks/:id/deliveries
 */
export async function listDeliveries(req, res) {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Verify the webhook belongs to this tenant
    const hook = await Webhook.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!hook) {
      return res
        .status(404)
        .json({ success: false, error: 'Webhook not found' });
    }

    const deliveries = await WebhookDelivery.find({ webhookId: id })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      deliveries: deliveries.map((d) => ({
        id: d._id,
        event: d.event,
        responseStatus: d.responseStatus,
        responseBody: d.responseBody,
        duration: d.duration,
        success: d.success,
        error: d.error,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    console.error('List deliveries error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/webhooks/:id/regenerate-secret
 */
export async function regenerateSecret(req, res) {
  try {
    const { id } = req.params;

    const hook = await Webhook.findOne({ _id: id, tenantId: req.tenantId });
    if (!hook) {
      return res
        .status(404)
        .json({ success: false, error: 'Webhook not found' });
    }

    hook.secret = Webhook.generateSecret();
    await hook.save();

    return res.json({
      success: true,
      message: 'Secret regenerated',
      secret: hook.secret,
    });
  } catch (err) {
    console.error('Regenerate secret error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
