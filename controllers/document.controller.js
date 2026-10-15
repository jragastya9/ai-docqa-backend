import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Tenant from '../models/Tenant.js';
import { incrementDocuments } from '../services/usageService.js';
import { notify } from '../services/notificationService.js';
import { fireWebhook } from '../services/webhookService.js';
import {
  extractTextFromPDF,
  cleanText,
  chunkText,
} from '../services/pdfService.js';

export async function uploadDocument(req, res) {
  console.log('📄 Upload endpoint hit');

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Send a PDF as "file" field.',
      });
    }

    console.log('📄 File:', req.file.originalname, '|', req.file.size, 'bytes');

    const doc = await Document.create({
      userId: req.user._id,
      tenantId: req.tenantId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      status: 'processing',
    });

    try {
      console.log('📄 Extracting text...');
      const { text, pageCount, wordCount } = await extractTextFromPDF(
        req.file.buffer
      );
      console.log(`📄 Extracted: ${pageCount} pages, ${wordCount} words`);

      const cleaned = cleanText(text);
      const cleanedWordCount = cleaned.split(/\s+/).filter(Boolean).length;

      console.log('📄 Chunking...');
      const chunks = chunkText(cleaned);
      console.log(`📄 Created ${chunks.length} chunks`);

      const chunkDocs = chunks.map((c) => ({
        documentId: doc._id,
        userId: req.user._id,
        tenantId: req.tenantId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        wordCount: c.wordCount,
      }));

      await Chunk.insertMany(chunkDocs);

      doc.pageCount = pageCount;
      doc.wordCount = cleanedWordCount;
      doc.chunkCount = chunks.length;
      doc.status = 'completed';
      await doc.save();

      await incrementDocuments(req.tenantId, 1);

      // Notify the tenant owner
      try {
        const tenant = await Tenant.findById(req.tenantId);
        if (tenant && tenant.ownerId) {
          await notify({
            userId: tenant.ownerId,
            tenantId: req.tenantId,
            type: 'document_uploaded',
            title: 'Document processed',
            description: `${doc.fileName} is ready for chat (${pageCount} pages, ${chunks.length} chunks).`,
            href: '/documents',
            meta: { documentId: doc._id.toString() },
          });
        }
      } catch (notifErr) {
        console.error('Upload notification failed:', notifErr.message);
      }

      // Fire webhook
      try {
        await fireWebhook({
          tenantId: req.tenantId,
          event: 'document.uploaded',
          data: {
            documentId: doc._id.toString(),
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            pageCount,
            chunkCount: chunks.length,
          },
        });
      } catch (whErr) {
        console.error('Upload webhook failed:', whErr.message);
      }

      console.log('✅ Document processed successfully');

      return res.status(201).json({
        success: true,
        message: 'Document uploaded and processed.',
        document: {
          id: doc._id,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          pageCount: doc.pageCount,
          wordCount: doc.wordCount,
          chunkCount: doc.chunkCount,
          status: doc.status,
          createdAt: doc.createdAt,
        },
      });
    } catch (innerError) {
      doc.status = 'failed';
      doc.errorMessage = innerError.message;
      await doc.save();

      console.error('❌ Processing error:', innerError);

      return res.status(500).json({
        success: false,
        error: 'Failed to process PDF: ' + innerError.message,
      });
    }
  } catch (error) {
    console.error('❌ Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function listDocuments(req, res) {
  try {
    const docs = await Document.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .select('-__v');

    return res.json({
      success: true,
      count: docs.length,
      documents: docs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function getDocument(req, res) {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
    }

    const chunks = await Chunk.find({ documentId: doc._id })
      .sort({ chunkIndex: 1 })
      .select('chunkIndex text wordCount');

    return res.json({
      success: true,
      document: doc,
      chunks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function deleteDocument(req, res) {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
    }

    await Chunk.deleteMany({ documentId: doc._id });
    await doc.deleteOne();

    // Fire webhook
    try {
      await fireWebhook({
        tenantId: req.tenantId,
        event: 'document.deleted',
        data: {
          documentId: doc._id.toString(),
          fileName: doc.fileName,
        },
      });
    } catch (whErr) {
      console.error('Delete webhook failed:', whErr.message);
    }

    return res.json({
      success: true,
      message: 'Document and chunks deleted.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
