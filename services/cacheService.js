import crypto from 'crypto';
import ResponseCache from '../models/ResponseCache.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashQuestion(question) {
  const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function getCached(tenantId, question) {
  try {
    const questionHash = hashQuestion(question);
    const cached = await ResponseCache.findOne({ tenantId, questionHash });

    if (!cached) return null;
    if (cached.expiresAt < new Date()) {
      await ResponseCache.deleteOne({ _id: cached._id });
      return null;
    }

    // Increment hit counter (fire and forget)
    ResponseCache.updateOne(
      { _id: cached._id },
      { $inc: { hitCount: 1 } }
    ).catch(() => {});

    return cached;
  } catch (err) {
    console.error('getCached error:', err.message);
    return null;
  }
}

export async function setCached({
  tenantId,
  question,
  answer,
  sources,
  provider,
  model,
  tokensUsed,
}) {
  try {
    const questionHash = hashQuestion(question);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

    await ResponseCache.findOneAndUpdate(
      { tenantId, questionHash },
      {
        tenantId,
        questionHash,
        question,
        answer,
        sources,
        provider,
        model,
        tokensUsed,
        expiresAt,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('setCached error:', err.message);
  }
}

export async function clearCache(tenantId) {
  try {
    await ResponseCache.deleteMany({ tenantId });
  } catch (err) {
    console.error('clearCache error:', err.message);
  }
}

export async function getCacheStats(tenantId) {
  try {
    const total = await ResponseCache.countDocuments({ tenantId });
    const stats = await ResponseCache.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: null,
          totalHits: { $sum: '$hitCount' },
          totalSaved: { $sum: { $multiply: ['$hitCount', '$tokensUsed'] } },
        },
      },
    ]);

    return {
      entries: total,
      totalHits: stats[0]?.totalHits || 0,
      tokensSaved: stats[0]?.totalSaved || 0,
    };
  } catch (err) {
    console.error('getCacheStats error:', err.message);
    return { entries: 0, totalHits: 0, tokensSaved: 0 };
  }
}
