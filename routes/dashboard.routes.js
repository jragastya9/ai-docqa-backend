import express from 'express';
import { protect } from '../middleware/auth.js';
import { getDashboardSummary } from '../controllers/dashboard.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.get('/summary', getDashboardSummary);

export default router;