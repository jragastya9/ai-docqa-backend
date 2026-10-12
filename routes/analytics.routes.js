import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getOverview,
  exportCSV,
} from '../controllers/analytics.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.get('/overview', getOverview);
router.get('/export', exportCSV);

export default router;
