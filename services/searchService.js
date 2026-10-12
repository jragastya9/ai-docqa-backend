import mongoose from 'mongoose';
import Chunk from '../models/Chunk.js';
import { generateEmbedding } from './embeddingService.js';

const VECTOR_INDEX_NAME = 'vector_index';
const DEFAULT_TOP_K = 5;

export async function searchChunks(queryText, tenantId, options = {}) {
  const { topK = DEFAULT_TOP_K, documentId = null } = options;

  if (!queryText || typeof queryText !== 'string') {
    throw new Error('Query text is required');
  }

  console.log('🔍 Embedding query:', queryText.slice(0, 60) + '...');
  const queryEmbedding = await generateEmbedding(queryText);

  const vectorSearchStage = {
    index: VECTOR_INDEX_NAME,
    path: 'embedding',
    queryVector: queryEmbedding,
    numCandidates: topK * 10,
    limit: topK,
    filter: {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      ...(documentId && {
        documentId: new mongoose.Types.ObjectId(documentId),
      }),
    },
  };

  const results = await Chunk.aggregate([
    { $vectorSearch: vectorSearchStage },
    {
      $project: {
        _id: 1,
        documentId: 1,
        chunkIndex: 1,
        text: 1,
        wordCount: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ]);

  console.log(`🔍 Found ${results.length} chunks`);

  return results;
}