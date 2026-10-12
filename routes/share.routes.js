import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createShareLink,
  listShareLinks,
  getPublicShare,
  publicChat,
  updateShareLink,
  deleteShareLink,
  getShareAnalytics,
} from '../controllers/share.controller.js';
import {
  publicViewLimiter,
  publicChatLimiter,
} from '../middleware/rateLimit.js';

const router = express.Router();

// PUBLIC
router.get('/public/:token', publicViewLimiter, getPublicShare);
router.post('/public/:token/chat', publicChatLimiter, publicChat);

// AUTHENTICATED
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.post('/', createShareLink);
router.get('/', listShareLinks);
router.patch('/:id', updateShareLink);
router.delete('/:id', deleteShareLink);
router.get('/:id/analytics', getShareAnalytics);

export default router;