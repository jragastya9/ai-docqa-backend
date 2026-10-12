import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createConversation,
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
} from '../controllers/conversation.controller.js';

const router = express.Router();

// Skip auth for OPTIONS preflight requests
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.post('/', createConversation);
router.get('/', listConversations);
router.get('/:id', getConversation);
router.patch('/:id', renameConversation);
router.delete('/:id', deleteConversation);

export default router;