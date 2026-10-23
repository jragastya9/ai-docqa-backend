import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Tenant from '../models/Tenant.js';
import { incrementDocuments } from '../services/usageService.js';
import { notify } from '../services/notificationService.js';
import { fireWebhook } from '../services/webhookService.js';
import { uploadPDF } from '../services/cloudinaryService.js'; // 👈 Import
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

    // 1. Upload to Cloudinary first
    let fileUrl = null;
    try {
      console.log('☁️ Uploading to Cloudinary...');
      fileUrl = await uploadPDF(req.file.buffer, req.file.originalname);
      console.log('☁️ Uploaded:', fileUrl);
    } catch (cloudErr) {
      console.error('❌ Cloudinary error:', cloudErr);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to upload file to storage.' 
      });
    }

    // 2. Create Document record
    const doc = await Document.create({
      userId: req.user._id,
      tenantId: req.tenantId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileUrl: fileUrl, // 👈 Save URL
      status: 'processing',
    });

    try {
      console.log('📄 Extracting text...');
      const { text, pageCount, wordCount } = await extractTextFromPDF(
        req.file.buffer
      );

      const cleaned = cleanText(text);
      const cleanedWordCount = cleaned.split(/\s+/).filter(Boolean).length;
      const chunks = chunkText(cleaned);

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

      // Notify
      try {
        const tenant = await Tenant.findById(req.tenantId);
        if (tenant && tenant.ownerId) {
          await notify({
            userId: tenant.ownerId,
            tenantId: req.tenantId,
            type: 'document_uploaded',
            title: 'Document processed',
            description: `${doc.fileName} is ready for chat.`,
            href: '/documents',
            meta: { documentId: doc._id.toString() },
          });
        }
      } catch (notifErr) {
        console.error('Upload notification failed:', notifErr.message);
      }

      // Webhook
      try {
        await fireWebhook({
          tenantId: req.tenantId,
          event: 'document.uploaded',
          data: {
            documentId: doc._id.toString(),
            fileName: doc.fileName,
            fileUrl, // Include URL in webhook
          },
        });
      } catch (whErr) {
        console.error('Upload webhook failed:', whErr.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Document uploaded and processed.',
        document: {
          id: doc._id,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
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
      return res.status(404).json({ success: false, error: 'Document not found.' });
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
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    await Chunk.deleteMany({ documentId: doc._id });
    await doc.deleteOne();

    // Optional: Delete from Cloudinary here if you want to free up space
    // if (doc.fileUrl) {
    //   const publicId = doc.fileUrl.split('/').slice(-1)[0].split('.')[0];
    //   await cloudinary.uploader.destroy(`localbiz-docs/${publicId}`);
    // }

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