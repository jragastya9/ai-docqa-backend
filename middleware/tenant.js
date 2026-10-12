import mongoose from 'mongoose';

export function requireTenant(req, res, next) {
  if (!req.tenantId) {
    return res.status(400).json({
      success: false,
      error: 'No tenant context. Please log in again.',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(req.tenantId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid tenant ID.',
    });
  }

  next();
}

export function applyTenantFilter(filter, tenantId) {
  return { ...filter, tenantId };
}