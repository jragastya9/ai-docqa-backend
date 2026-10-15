import express from 'express';
import { protect } from '../middleware/auth.js';
import { superAdminOnly } from '../middleware/superAdmin.js';
import {
  createTicket,
  listTickets,
  getTicket,
  replyToTicket,
  updateTicket,
} from '../controllers/support.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.post('/', createTicket);
router.get('/', listTickets);
router.get('/:id', getTicket);
router.post('/:id/reply', replyToTicket);
router.patch('/:id', superAdminOnly, updateTicket);

export default router;
