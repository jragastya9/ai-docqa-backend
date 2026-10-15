import express from 'express';
import { protect } from '../middleware/auth.js';
import { superAdminOnly } from '../middleware/superAdmin.js';
import {
  exportAll,
  healthCheck,
  backupStats,
} from '../controllers/backup.controller.js';

const router = express.Router();

// Public health check
router.get('/health', healthCheck);

// Super admin only
router.get('/export', protect, superAdminOnly, exportAll);
router.get('/stats', protect, superAdminOnly, backupStats);

export default router;
