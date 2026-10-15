import express from 'express';
import { protect } from '../middleware/auth.js';
import { superAdminOnly } from '../middleware/superAdmin.js';
import {
  reportAbuse,
  listModerationLogs,
  listAbuseReports,
  updateAbuseReport,
} from '../controllers/moderation.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

// Any user can report
router.post('/report', reportAbuse);

// Super admin only
router.get('/logs', superAdminOnly, listModerationLogs);
router.get('/reports', superAdminOnly, listAbuseReports);
router.patch('/reports/:id', superAdminOnly, updateAbuseReport);

export default router;
