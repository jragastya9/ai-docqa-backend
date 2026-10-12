import { searchChunks } from '../services/searchService.js';

export async function queryChunks(req, res) {
  console.log('Query endpoint hit');

  try {
    const { question, topK = 5, documentId } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Question is required.',
      });
    }

    const startTime = Date.now();

    const chunks = await searchChunks(question.trim(), req.user._id, {
      topK: Math.min(Number(topK) || 5, 20),
      documentId,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Query processed in ${duration}s`);

    return res.json({
      success: true,
      question,
      resultCount: chunks.length,
      duration: `${duration}s`,
      results: chunks.map((c) => ({
        chunkId: c._id,
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        wordCount: c.wordCount,
        score: parseFloat(c.score.toFixed(4)),
      })),
    });
  } catch (error) {
    console.error('Query error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}