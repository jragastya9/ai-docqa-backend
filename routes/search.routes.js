import express from 'express';
import { protect } from '../middleware/auth.js';
import { globalSearch } from '../controllers/search.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.get('/', globalSearch);

export default router;
