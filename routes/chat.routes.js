import express from 'express';
import { protect } from '../middleware/auth.js';
import { guardMessages } from '../middleware/planGuard.js';
import { chat, chatStream } from '../controllers/chat.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

// Non-streaming (kept for compatibility)
router.post('/', guardMessages, chat);

// Streaming (Server-Sent Events)
router.post('/stream', guardMessages, chatStream);

export default router;