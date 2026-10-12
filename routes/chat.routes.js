import express from 'express';
import { protect } from '../middleware/auth.js';
import { guardMessages } from '../middleware/planGuard.js';
import { chat } from '../controllers/chat.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.post('/', guardMessages, chat);

export default router;