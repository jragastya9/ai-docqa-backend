import express from 'express';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { guardDocuments } from '../middleware/planGuard.js';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
} from '../controllers/document.controller.js';
import { embedDocument } from '../controllers/embedding.controller.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.post(
  '/upload',
  guardDocuments,
  upload.single('file'),
  uploadDocument
);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.post('/:id/embed', embedDocument);
router.delete('/:id', deleteDocument);

export default router;