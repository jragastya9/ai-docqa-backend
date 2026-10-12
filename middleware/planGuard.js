import Tenant from '../models/Tenant.js';
import {
  canAddDocument,
  canSendMessage,
} from '../services/usageService.js';

export async function guardDocuments(req, res, next) {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const { allowed, reason } = await canAddDocument(
      req.tenantId,
      tenant.plan
    );

    if (!allowed) {
      return res.status(402).json({
        success: false,
        error: reason,
        code: 'PLAN_LIMIT_REACHED',
      });
    }

    req.tenantPlan = tenant.plan;
    next();
  } catch (err) {
    next(err);
  }
}

export async function guardMessages(req, res, next) {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const { allowed, reason } = await canSendMessage(
      req.tenantId,
      tenant.plan
    );

    if (!allowed) {
      return res.status(402).json({
        success: false,
        error: reason,
        code: 'PLAN_LIMIT_REACHED',
      });
    }

    req.tenantPlan = tenant.plan;
    next();
  } catch (err) {
    next(err);
  }
}