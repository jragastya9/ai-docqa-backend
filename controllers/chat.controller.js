import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Document from '../models/Document.js';
import { searchChunks } from '../services/searchService.js';
import { generateAnswer, streamAnswer } from '../services/llmService.js';
import {
  incrementMessages,
  incrementTokens,
} from '../services/usageService.js';

// ─── Non-streaming (kept for compatibility) ───
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

// ─── Streaming version (Server-Sent Events) ───
export async function chatStream(req, res) {
  console.log('💬 Chat STREAM endpoint hit');

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const question = req.body?.question;
    const conversationId = req.body?.conversationId;
    const topK = req.body?.topK || 5;
    const documentId = req.body?.documentId;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      send('error', { error: 'Question is required.' });
      return res.end();
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
        send('error', { error: 'Conversation not found' });
        return res.end();
      }
    } else {
      conversation = await Conversation.create({
        userId,
        tenantId,
        title: question.trim().slice(0, 60),
      });
    }

    // Send conversation id immediately so the client can track it
    send('meta', { conversationId: conversation._id.toString() });

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

    const chunks = await searchChunks(question.trim(), tenantId, {
      topK: Math.min(Number(topK) || 5, 10),
      documentId,
    });

    if (chunks.length === 0) {
      const emptyAnswer =
        "I couldn't find any relevant information in your documents to answer that question.";

      // Stream it out in tiny chunks so the UX feels consistent
      for (const word of emptyAnswer.split(' ')) {
        send('token', { token: word + ' ' });
      }

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

      send('done', { sources: [], tokensUsed: 0 });
      return res.end();
    }

    // Attach document names to chunks for source metadata
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

    // Send sources BEFORE the answer so the UI can display them immediately
    send('sources', { sources });

    // Stream the answer
    let fullText = '';
    let tokensUsed = 0;
    let aborted = false;

    // Listen for client abort (user clicked Stop)
    req.on('close', () => {
      aborted = true;
      console.log('⚠️ Client aborted stream');
    });

    for await (const event of streamAnswer(question.trim(), chunks, history)) {
      if (aborted) break;

      if (event.type === 'token') {
        fullText += event.data;
        send('token', { token: event.data });
      } else if (event.type === 'done') {
        fullText = event.data.fullText || fullText;
        tokensUsed = event.data.tokensUsed || 0;
      } else if (event.type === 'error') {
        send('error', { error: event.data });
      }
    }

    // Persist whatever we generated (even if aborted, we keep partial)
    if (fullText.trim()) {
      await Message.create({
        conversationId: conversation._id,
        userId,
        tenantId,
        role: 'assistant',
        content: fullText,
        sources,
        tokensUsed,
      });

      conversation.lastMessageAt = new Date();
      conversation.messageCount += 2;
      await conversation.save();

      await incrementMessages(tenantId, 1);
      await incrementTokens(tenantId, tokensUsed);
    }

    if (!aborted) {
      send('done', { sources, tokensUsed });
    }
    res.end();
  } catch (error) {
    console.error('❌ Chat stream error:', error);
    send('error', { error: error.message });
    res.end();
  }
}