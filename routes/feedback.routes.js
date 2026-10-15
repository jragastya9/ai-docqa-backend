import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  submitFeedback,
  getFeedbackStats,
} from '../controllers/feedback.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.post('/', submitFeedback);
router.get('/stats', getFeedbackStats);

export default router;
