import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  getPublicBranding,
  getMyTenant,
  updateBranding,
  updateAISettings,
  getAIStats,
  clearResponseCache,
  updateSubdomain,
  updateCustomDomain,
  removeCustomDomain,
} from '../controllers/tenant.controller.js';

const router = express.Router();

router.get('/branding', getPublicBranding);

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.get('/me', getMyTenant);
router.patch('/branding', requireRole('owner', 'admin'), updateBranding);
router.patch('/ai', requireRole('owner', 'admin'), updateAISettings);
router.get('/ai/stats', getAIStats);
router.post(
  '/ai/cache/clear',
  requireRole('owner', 'admin'),
  clearResponseCache
);
router.post('/subdomain', requireRole('owner'), updateSubdomain);
router.post('/domain', requireRole('owner'), updateCustomDomain);
router.delete('/domain', requireRole('owner'), removeCustomDomain);

export default router;
