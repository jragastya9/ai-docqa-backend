import pdf from 'pdf-parse';

const CHUNK_SIZE_WORDS = 500;
const CHUNK_OVERLAP_WORDS = 50;

export async function extractTextFromPDF(buffer) {
  const data = await pdf(buffer);
  return {
    text: data.text,
    pageCount: data.numpages,
    wordCount: data.text.split(/\s+/).filter(Boolean).length,
  };
}

export function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

export function chunkText(text, chunkSize = CHUNK_SIZE_WORDS, overlap = CHUNK_OVERLAP_WORDS) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunkWords = words.slice(start, end);

    chunks.push({
      text: chunkWords.join(' '),
      wordCount: chunkWords.length,
      chunkIndex: chunks.length,
    });

    if (end === words.length) break;
    start = end - overlap;
  }

  return chunks;
}