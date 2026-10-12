import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Document from '../models/Document.js';
import { searchChunks } from '../services/searchService.js';
import { generateAnswer } from '../services/llmService.js';
import {
  incrementMessages,
  incrementTokens,
} from '../services/usageService.js';

export async function chat(req, res) {
  console.log('💬 Chat endpoint hit');

  try {
    const question = req.body?.question;
    const conversationId = req.body?.conversationId;
    const topK = req.body?.topK || 5;
    const documentId = req.body?.documentId;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Question is required.',
      });
    }

    const userId = req.user._id;
    const tenantId = req.tenantId;
    let conversation;

    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        tenantId,
      });
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }
    } else {
      conversation = await Conversation.create({
        userId,
        tenantId,
        title: question.trim().slice(0, 60),
      });
    }

    const history = await Message.find({
      conversationId: conversation._id,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    history.reverse();

    await Message.create({
      conversationId: conversation._id,
      userId,
      tenantId,
      role: 'user',
      content: question.trim(),
    });

    const startTime = Date.now();

    console.log(`💬 Step 1: Retrieving chunks for: "${question.slice(0, 60)}..."`);
    const chunks = await searchChunks(question.trim(), tenantId, {
      topK: Math.min(Number(topK) || 5, 10),
      documentId,
    });

    if (chunks.length === 0) {
      const emptyAnswer =
        "I couldn't find any relevant information in your documents to answer that question.";

      await Message.create({
        conversationId: conversation._id,
        userId,
        tenantId,
        role: 'assistant',
        content: emptyAnswer,
        sources: [],
      });

      conversation.lastMessageAt = new Date();
      conversation.messageCount += 2;
      await conversation.save();

      await incrementMessages(tenantId, 1);

      return res.json({
        success: true,
        conversationId: conversation._id,
        question,
        answer: emptyAnswer,
        sources: [],
        duration: ((Date.now() - startTime) / 1000).toFixed(2) + 's',
      });
    }

    console.log(
      `💬 Step 2: Generating answer from ${chunks.length} chunks with ${history.length} history msgs`
    );
    const { answer, tokensUsed } = await generateAnswer(
      question.trim(),
      chunks,
      history
    );

    const docIds = [...new Set(chunks.map((c) => c.documentId.toString()))];
    const docs = await Document.find({ _id: { $in: docIds } }).select(
      'fileName'
    );
    const docMap = Object.fromEntries(
      docs.map((d) => [d._id.toString(), d.fileName])
    );

    const sources = chunks.map((c, i) => ({
      sourceNumber: i + 1,
      chunkId: c._id,
      documentId: c.documentId,
      documentName: docMap[c.documentId.toString()] || 'Unknown',
      chunkIndex: c.chunkIndex,
      text: c.text,
      score: parseFloat(c.score.toFixed(4)),
    }));

    await Message.create({
      conversationId: conversation._id,
      userId,
      tenantId,
      role: 'assistant',
      content: answer,
      sources,
      tokensUsed,
    });

    conversation.lastMessageAt = new Date();
    conversation.messageCount += 2;
    await conversation.save();

    await incrementMessages(tenantId, 1);
    await incrementTokens(tenantId, tokensUsed);

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Chat complete in ${totalDuration}s`);

    return res.json({
      success: true,
      conversationId: conversation._id,
      question,
      answer,
      sources,
      tokensUsed,
      duration: `${totalDuration}s`,
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}