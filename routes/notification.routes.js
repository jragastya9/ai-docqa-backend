import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  streamNotifications,
} from '../controllers/notification.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.get('/stream', streamNotifications);
router.get('/', listNotifications);
router.post('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.delete('/:id', deleteNotification);

export default router;
