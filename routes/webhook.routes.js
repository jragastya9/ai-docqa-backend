import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  listDeliveries,
  regenerateSecret,
} from '../controllers/webhook.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

// Any member can view
router.get('/', listWebhooks);
router.get('/:id/deliveries', listDeliveries);

// Owner/Admin can manage
router.post('/', requireRole('owner', 'admin'), createWebhook);
router.patch('/:id', requireRole('owner', 'admin'), updateWebhook);
router.delete('/:id', requireRole('owner', 'admin'), deleteWebhook);
router.post('/:id/test', requireRole('owner', 'admin'), testWebhook);
router.post(
  '/:id/regenerate-secret',
  requireRole('owner', 'admin'),
  regenerateSecret
);

export default router;
