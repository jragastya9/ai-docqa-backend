import express from 'express';
import { protect } from '../middleware/auth.js';
import { superAdminOnly } from '../middleware/superAdmin.js';
import {
  listEmailLogs,
  getEmailStats,
  triggerJobs,
  unsubscribe,
  getPreferences,
} from '../controllers/marketing.controller.js';

const router = express.Router();

// Public (unsubscribe page)
router.post('/unsubscribe', unsubscribe);
router.get('/preferences/:userId', getPreferences);

// Super admin
router.get('/logs', protect, superAdminOnly, listEmailLogs);
router.get('/stats', protect, superAdminOnly, getEmailStats);
router.post('/run', protect, superAdminOnly, triggerJobs);

export default router;
