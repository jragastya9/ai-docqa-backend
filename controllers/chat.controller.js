import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Document from '../models/Document.js';
import Tenant from '../models/Tenant.js';
import { searchChunks } from '../services/searchService.js';
import { generateAnswer, streamAnswer } from '../services/llmService.js';
import { getCached, setCached } from '../services/cacheService.js';
import { checkContent } from '../services/moderationService.js';
import {
  incrementMessages,
  incrementTokens,
} from '../services/usageService.js';

async function getTenantAISettings(tenantId) {
  try {
    const tenant = await Tenant.findById(tenantId).select('settings');
    return {
      provider: tenant?.settings?.aiProvider || 'groq',
      customPrompt: tenant?.settings?.customPrompt || '',
      cachingEnabled: tenant?.settings?.cachingEnabled !== false,
    };
  } catch {
    return { provider: 'groq', customPrompt: '', cachingEnabled: true };
  }
}

// ─── Non-streaming ───
export async function chat(req, res) {
  console.log('💬 Chat endpoint hit');

  try {
    const question = req.body?.question;
    const conversationId = req.body?.conversationId;
    const topK = req.body?.topK || 5;
    const documentId = req.body?.documentId;

    if (
      !question ||
      typeof question !== 'string' ||
      question.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: 'Question is required.',
      });
    }

    const userId = req.user._id;
    const tenantId = req.tenantId;

    // Moderation check
    const mod = await checkContent({
      content: question.trim(),
      userId,
      tenantId,
      source: 'chat',
      blockOnFlag: true,
    });

    if (!mod.allowed) {
      return res.status(400).json({
        success: false,
        error: 'Your message was flagged by our content moderation system.',
        code: 'CONTENT_FLAGGED',
      });
    }

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
    const aiSettings = await getTenantAISettings(tenantId);

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

    let cached = null;
    if (aiSettings.cachingEnabled && !documentId) {
      cached = await getCached(tenantId, question.trim());
    }

    let answer, tokensUsed, provider, model, sources;
    let wasCached = false;

    if (cached) {
      answer = cached.answer;
      tokensUsed = cached.tokensUsed;
      provider = cached.provider;
      model = cached.model;
      sources = cached.sources;
      wasCached = true;
      console.log('⚡ Cache hit for:', question.trim().slice(0, 40));
    } else {
      const result = await generateAnswer(
        question.trim(),
        chunks,
        history,
        {
          provider: aiSettings.provider,
          customPrompt: aiSettings.customPrompt,
        }
      );
      answer = result.answer;
      tokensUsed = result.tokensUsed;
      provider = result.provider;
      model = result.model;

      const docIds = [...new Set(chunks.map((c) => c.documentId.toString()))];
      const docs = await Document.find({ _id: { $in: docIds } }).select(
        'fileName'
      );
      const docMap = Object.fromEntries(
        docs.map((d) => [d._id.toString(), d.fileName])
      );

      sources = chunks.map((c, i) => ({
        sourceNumber: i + 1,
        chunkId: c._id,
        documentId: c.documentId,
        documentName: docMap[c.documentId.toString()] || 'Unknown',
        chunkIndex: c.chunkIndex,
        text: c.text,
        score: parseFloat(c.score.toFixed(4)),
      }));

      if (aiSettings.cachingEnabled && !documentId) {
        await setCached({
          tenantId,
          question: question.trim(),
          answer,
          sources,
          provider,
          model,
          tokensUsed,
        });
      }
    }

    await Message.create({
      conversationId: conversation._id,
      userId,
      tenantId,
      role: 'assistant',
      content: answer,
      sources,
      tokensUsed,
      model,
      provider,
      cached: wasCached,
    });

    conversation.lastMessageAt = new Date();
    conversation.messageCount += 2;
    await conversation.save();

    await incrementMessages(tenantId, 1);
    if (!wasCached) await incrementTokens(tenantId, tokensUsed);

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Chat complete in ${totalDuration}s (cached: ${wasCached})`);

    return res.json({
      success: true,
      conversationId: conversation._id,
      question,
      answer,
      sources,
      tokensUsed,
      provider,
      model,
      cached: wasCached,
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

// ─── Streaming ───
export async function chatStream(req, res) {
  console.log('💬 Chat STREAM endpoint hit');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
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

    if (
      !question ||
      typeof question !== 'string' ||
      question.trim().length === 0
    ) {
      send('error', { error: 'Question is required.' });
      return res.end();
    }

    const userId = req.user._id;
    const tenantId = req.tenantId;

    // Moderation check
    const mod = await checkContent({
      content: question.trim(),
      userId,
      tenantId,
      source: 'chat',
      blockOnFlag: true,
    });

    if (!mod.allowed) {
      send('error', {
        error: 'Your message was flagged by our content moderation system.',
      });
      return res.end();
    }

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

    const aiSettings = await getTenantAISettings(tenantId);

    const chunks = await searchChunks(question.trim(), tenantId, {
      topK: Math.min(Number(topK) || 5, 10),
      documentId,
    });

    if (chunks.length === 0) {
      const emptyAnswer =
        "I couldn't find any relevant information in your documents to answer that question.";

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
        provider: aiSettings.provider,
      });

      conversation.lastMessageAt = new Date();
      conversation.messageCount += 2;
      await conversation.save();

      await incrementMessages(tenantId, 1);

      send('done', { sources: [], tokensUsed: 0, cached: false });
      return res.end();
    }

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

    send('sources', { sources });

    let cached = null;
    if (aiSettings.cachingEnabled && !documentId) {
      cached = await getCached(tenantId, question.trim());
    }

    if (cached) {
      console.log('⚡ Stream cache hit');
      send('meta_event', { cached: true });

      const words = cached.answer.split(/(\s+)/);
      for (const w of words) {
        send('token', { token: w });
      }

      await Message.create({
        conversationId: conversation._id,
        userId,
        tenantId,
        role: 'assistant',
        content: cached.answer,
        sources: cached.sources,
        tokensUsed: cached.tokensUsed,
        model: cached.model,
        provider: cached.provider,
        cached: true,
      });

      conversation.lastMessageAt = new Date();
      conversation.messageCount += 2;
      await conversation.save();

      await incrementMessages(tenantId, 1);

      send('done', {
        sources: cached.sources,
        tokensUsed: cached.tokensUsed,
        cached: true,
      });
      return res.end();
    }

    let fullText = '';
    let tokensUsed = 0;
    let provider = aiSettings.provider;
    let model = null;
    let aborted = false;

    req.on('close', () => {
      aborted = true;
      console.log('⚠️ Client aborted stream');
    });

    for await (const event of streamAnswer(question.trim(), chunks, history, {
      provider: aiSettings.provider,
      customPrompt: aiSettings.customPrompt,
    })) {
      if (aborted) break;

      if (event.type === 'token') {
        fullText += event.data;
        send('token', { token: event.data });
      } else if (event.type === 'done') {
        fullText = event.data.fullText || fullText;
        tokensUsed = event.data.tokensUsed || 0;
        provider = event.data.provider || provider;
        model = event.data.model || null;
      } else if (event.type === 'error') {
        send('error', { error: event.data });
      }
    }

    if (fullText.trim()) {
      await Message.create({
        conversationId: conversation._id,
        userId,
        tenantId,
        role: 'assistant',
        content: fullText,
        sources,
        tokensUsed,
        model,
        provider,
      });

      conversation.lastMessageAt = new Date();
      conversation.messageCount += 2;
      await conversation.save();

      await incrementMessages(tenantId, 1);
      await incrementTokens(tenantId, tokensUsed);

      if (aiSettings.cachingEnabled && !documentId && fullText.trim()) {
        await setCached({
          tenantId,
          question: question.trim(),
          answer: fullText,
          sources,
          provider,
          model,
          tokensUsed,
        });
      }
    }

    if (!aborted) {
      send('done', { sources, tokensUsed, cached: false });
    }
    res.end();
  } catch (error) {
    console.error('❌ Chat stream error:', error);
    send('error', { error: error.message });
    res.end();
  }
}
