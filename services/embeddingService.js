import { pipeline, env } from '@huggingface/transformers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '.cache');

env.cacheDir = CACHE_DIR;
env.allowRemoteModels = true;

console.log('Model cache dir:', CACHE_DIR);

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;

let embedder = null;

async function getEmbedder() {
  if (embedder) return embedder;

  console.log('Loading embedding model (first time may take 30-60s)...');

  embedder = await pipeline('feature-extraction', MODEL_NAME, {
    dtype: 'fp32',
  });

  console.log('Embedding model loaded');
  return embedder;
}

export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text is required for embedding');
  }

  const pipe = await getEmbedder();
  const output = await pipe(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

export async function generateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const pipe = await getEmbedder();
  const embeddings = [];

  for (let i = 0; i < texts.length; i++) {
    const output = await pipe(texts[i], {
      pooling: 'mean',
      normalize: true,
    });
    embeddings.push(Array.from(output.data));

    if ((i + 1) % 10 === 0 || i === texts.length - 1) {
      console.log(`Embedded ${i + 1}/${texts.length}`);
    }
  }

  return embeddings;
}

export const EMBEDDING_DIMENSION = EMBEDDING_DIM;