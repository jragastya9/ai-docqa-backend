import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  changePassword,
  logoutAll,
  listSessions,
  revokeSession,
  setup2FA,
  verify2FA,
  disable2FA,
  get2FAStatus,
  exportData,
  deleteAccount,
} from '../controllers/security.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

// Password
router.post('/change-password', changePassword);

// Sessions
router.post('/logout-all', logoutAll);
router.get('/sessions', listSessions);
router.delete('/sessions/:id', revokeSession);

// 2FA
router.get('/2fa/status', get2FAStatus);
router.post('/2fa/setup', setup2FA);
router.post('/2fa/verify', verify2FA);
router.post('/2fa/disable', disable2FA);

// GDPR
router.get('/export', exportData);
router.delete('/account', deleteAccount);

export default router;
