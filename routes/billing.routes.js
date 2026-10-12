import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  listPlans,
  getCurrentSubscription,
  createSubscription,
  verifyPayment,
  handleWebhook,
  cancelSubscription,
} from '../controllers/billing.controller.js';

const router = express.Router();

// Public
router.get('/plans', listPlans);
router.post('/webhook', express.json(), handleWebhook);

// Auth-protected
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.get('/current', getCurrentSubscription);
router.post('/subscribe', createSubscription);
router.post('/verify', verifyPayment);
router.post('/cancel', cancelSubscription);

export default router;