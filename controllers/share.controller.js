import crypto from 'crypto';
import ShareLink from '../models/ShareLink.js';
import ShareQuery from '../models/ShareQuery.js';
import Document from '../models/Document.js';
import Tenant from '../models/Tenant.js';
import { searchChunks } from '../services/searchService.js';
import { generateAnswer } from '../services/llmService.js';

/**
 * Generate a short random token
 */
function generateToken() {
  return crypto.randomBytes(8).toString('base64url'); // ~11 chars
}

/**
 * @route   POST /api/share
 * @desc    Create a share link for a document (auth required)
 * @access  Private (owner/admin/member)
 */
export async function createShareLink(req, res) {
  try {
    const { documentId, title, description, expiresInDays } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required',
      });
    }

    const doc = await Document.findOne({
      _id: documentId,
      tenantId: req.tenantId,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const shareLink = await ShareLink.create({
      token: generateToken(),
      tenantId: req.tenantId,
      documentId: doc._id,
      createdBy: req.user._id,
      title: title || `Ask about ${doc.fileName}`,
      description: description || '',
      expiresAt,
    });

    res.status(201).json({
      success: true,
      shareLink,
    });
  } catch (err) {
    console.error('Create share link error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * @route   GET /api/share
 * @desc    List share links for the tenant
 * @access  Private
 */
export async function listShareLinks(req, res) {
  try {
    const links = await ShareLink.find({
      tenantId: req.tenantId,
    })
      .sort({ createdAt: -1 })
      .populate('documentId', 'fileName')
      .lean();

    res.json({
      success: true,
      shareLinks: links,
    });
  } catch (err) {
    console.error('List share links error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * @route   GET /api/share/public/:token
 * @desc    Get public share info (NO AUTH)
 * @access  Public
 */
export async function getPublicShare(req, res) {
  try {
    const { token } = req.params;

    const shareLink = await ShareLink.findOne({ token })
      .populate('documentId', 'fileName')
      .populate('tenantId', 'name settings');

    if (!shareLink) {
      return res.status(404).json({
        success: false,
        error: 'Share link not found',
      });
    }

    if (!shareLink.isActive) {
      return res.status(410).json({
        success: false,
        error: 'This share link has been disabled',
      });
    }

    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'This share link has expired',
      });
    }

    // Increment view count (fire and forget)
    ShareLink.updateOne({ _id: shareLink._id }, { $inc: { viewCount: 1 } }).catch(
      (e) => console.error('View count error:', e)
    );

    res.json({
      success: true,
      share: {
        token: shareLink.token,
        title: shareLink.title,
        description: shareLink.description,
        documentName: shareLink.documentId?.fileName || 'Document',
        businessName: shareLink.tenantId?.name || 'Business',
        businessColor: shareLink.tenantId?.settings?.primaryColor || '#6366f1',
      },
    });
  } catch (err) {
    console.error('Get public share error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * @route   POST /api/share/public/:token/chat
 * @desc    Ask a question via public share (NO AUTH)
 * @access  Public
 */
export async function publicChat(req, res) {
  try {
    const { token } = req.params;
    const question = req.body?.question;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Question is required',
      });
    }

    if (question.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Question too long (max 500 chars)',
      });
    }

    const shareLink = await ShareLink.findOne({ token });
    if (!shareLink || !shareLink.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Share link not found or inactive',
      });
    }

    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'This share link has expired',
      });
    }

    const startTime = Date.now();

    // Retrieve chunks scoped to this share's document
    const chunks = await searchChunks(question.trim(), shareLink.tenantId, {
      topK: 5,
      documentId: shareLink.documentId,
    });

    if (chunks.length === 0) {
      const emptyAnswer =
        "I couldn't find an answer to that in this document. Try rephrasing your question.";

      // Log the query
      await ShareQuery.create({
        shareLinkId: shareLink._id,
        tenantId: shareLink.tenantId,
        question: question.trim(),
        answer: emptyAnswer,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({
        success: true,
        answer: emptyAnswer,
        sources: [],
      });
    }

    // Generate answer
    const { answer, tokensUsed } = await generateAnswer(
      question.trim(),
      chunks,
      []
    );

    // Log query
    await ShareQuery.create({
      shareLinkId: shareLink._id,
      tenantId: shareLink.tenantId,
      question: question.trim(),
      answer,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Increment chat count
    await ShareLink.updateOne(
      { _id: shareLink._id },
      { $inc: { chatCount: 1 } }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Return answer with minimal sources (only count + doc name, not text)
    const sources = chunks.map((c, i) => ({
      sourceNumber: i + 1,
      documentName: 'Document',
      score: parseFloat(c.score.toFixed(4)),
    }));

    res.json({
      success: true,
      answer,
      sources,
      duration: `${duration}s`,
    });
  } catch (err) {
    console.error('Public chat error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * @route   PATCH /api/share/:id
 * @desc    Update share link (toggle active, change expiry)
 * @access  Private
 */
export async function updateShareLink(req, res) {
  try {
    const { isActive, expiresInDays } = req.body;

    const updates = {};
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (expiresInDays !== undefined) {
      updates.expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;
    }

    const shareLink = await ShareLink.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      updates,
      { new: true }
    );

    if (!shareLink) {
      return res.status(404).json({
        success: false,
        error: 'Share link not found',
      });
    }

    res.json({ success: true, shareLink });
  } catch (err) {
    console.error('Update share link error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * @route   DELETE /api/share/:id
 * @desc    Delete share link
 * @access  Private
 */
export async function deleteShareLink(req, res) {
  try {
    const shareLink = await ShareLink.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!shareLink) {
      return res.status(404).json({
        success: false,
        error: 'Share link not found',
      });
    }

    await shareLink.deleteOne();

    res.json({
      success: true,
      message: 'Share link deleted',
    });
  } catch (err) {
    console.error('Delete share link error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * @route   GET /api/share/:id/analytics
 * @desc    Get analytics for a share link (auth required)
 * @access  Private
 */
export async function getShareAnalytics(req, res) {
  try {
    const shareLink = await ShareLink.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!shareLink) {
      return res.status(404).json({
        success: false,
        error: 'Share link not found',
      });
    }

    // Top 10 questions
    const topQuestions = await ShareQuery.aggregate([
      { $match: { shareLinkId: shareLink._id } },
      { $group: { _id: '$question', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Total queries
    const totalQueries = await ShareQuery.countDocuments({
      shareLinkId: shareLink._id,
    });

    res.json({
      success: true,
      analytics: {
        viewCount: shareLink.viewCount,
        chatCount: shareLink.chatCount,
        totalQueries,
        topQuestions,
      },
    });
  } catch (err) {
    console.error('Share analytics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}