import Chunk from '../models/Chunk.js';
import Document from '../models/Document.js';
import { generateEmbeddings } from '../services/embeddingService.js';

export async function embedDocument(req, res) {
  console.log('Embed endpoint hit');

  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
    }

    const chunks = await Chunk.find({ documentId: doc._id }).sort({
      chunkIndex: 1,
    });

    if (chunks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document has no chunks to embed.',
      });
    }

    const alreadyEmbedded = chunks.filter(
      (c) => c.embedding && c.embedding.length > 0
    );
    if (alreadyEmbedded.length === chunks.length) {
      return res.json({
        success: true,
        message: 'All chunks already have embeddings.',
        embedded: chunks.length,
      });
    }

    console.log(`Embedding ${chunks.length} chunks...`);
    const startTime = Date.now();

    const texts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts);

    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
      await chunks[i].save();
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Embedded ${chunks.length} chunks in ${duration}s`);

    return res.json({
      success: true,
      message: `Embedded ${chunks.length} chunks.`,
      embedded: chunks.length,
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error('Embedding error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}