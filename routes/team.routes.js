import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireRole, requireOwner } from '../middleware/rbac.js';
import {
  inviteMember,
  listTeam,
  updateMemberRole,
  removeMember,
  revokeInvite,
  getInviteByToken,
  acceptInvite,
} from '../controllers/team.controller.js';

const router = express.Router();

// ─── Public routes (no auth) ───
router.get('/invite/:token', getInviteByToken);
router.post('/invite/:token/accept', acceptInvite);

// ─── Auth-protected routes ───
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

// List team — any authenticated member can view
router.get('/', listTeam);

// Manage team — owner/admin only
router.post('/invite', requireRole('owner', 'admin'), inviteMember);
router.delete(
  '/invite/:id',
  requireRole('owner', 'admin'),
  revokeInvite
);

// Change roles / remove — owner only
router.patch('/:id/role', requireOwner, updateMemberRole);
router.delete('/:id', requireOwner, removeMember);

export default router;
