import express from 'express';
import { protect } from '../middleware/auth.js';
import { superAdminOnly } from '../middleware/superAdmin.js';
import {
  getOverview,
  listAllTenants,
  getTenantDetail,
  impersonateTenant,
  changeTenantPlan,
  toggleTenantActive,
  updateFeatureFlags,
  listImpersonations,
} from '../controllers/admin.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});
router.use(superAdminOnly);

router.get('/overview', getOverview);
router.get('/tenants', listAllTenants);
router.get('/tenants/:id', getTenantDetail);
router.post('/tenants/:id/impersonate', impersonateTenant);
router.patch('/tenants/:id/plan', changeTenantPlan);
router.patch('/tenants/:id/active', toggleTenantActive);
router.patch('/tenants/:id/features', updateFeatureFlags);
router.get('/impersonations', listImpersonations);

export default router;
