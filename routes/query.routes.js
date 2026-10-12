import express from 'express';
import { protect } from '../middleware/auth.js';
import { queryChunks } from '../controllers/query.controller.js';

const router = express.Router();

router.use(protect);
router.post('/', queryChunks);

export default router;