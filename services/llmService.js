import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const MAX_TOKENS = 800;
const TEMPERATURE = 0.3;

export async function generateAnswer(question, chunks, history = []) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question is required');
  }

  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('At least one context chunk is required');
  }

  // Build context string with numbered sources
  const context = chunks
    .map((c, i) => {
      return `[Source ${i + 1}]\n${c.text}`;
    })
    .join('\n\n---\n\n');

  const systemPrompt = `You are a helpful assistant that answers questions strictly based on the provided context and conversation history.

RULES:
1. Answer ONLY using information from the provided sources.
2. If the sources don't contain the answer, say "I don't have enough information in the provided documents to answer that."
3. Cite sources using [Source N] format when you use information from them.
4. Do NOT include any file paths, line numbers, or file references like "L1-L4".
5. Use conversation history to understand follow-up questions (pronouns like "it", "that", "the other one").
6. Be concise and direct. No filler.
7. Never invent facts, prices, dates, or names.`;

  const messages = [{ role: 'system', content: systemPrompt }];

  // Add conversation history
  for (const msg of history) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add current question with context
  const userPrompt = `Context sources:

${context}

---

Question: ${question}

Answer:`;

  messages.push({ role: 'user', content: userPrompt });

  console.log(
    `🤖 Calling LLM (${MODEL}) with ${chunks.length} sources + ${history.length} history msgs`
  );
  const startTime = Date.now();

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const answer = completion.choices[0]?.message?.content?.trim() || '';
  const tokensUsed = completion.usage?.total_tokens || 0;

  console.log(`🤖 LLM responded in ${duration}s (${tokensUsed} tokens)`);

  return { answer, tokensUsed, duration };
}

export async function generateAnswerStream(question, chunks, onToken) {
  if (!question || !chunks?.length) {
    throw new Error('Question and chunks are required');
  }

  const context = chunks
    .map((c, i) => `[Source ${i + 1}]\n${c.text}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a helpful assistant that answers questions strictly based on the provided context. Cite sources as [Source N]. If you cannot answer from the context, say so.`;

  const stream = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Context:\n\n${context}\n\n---\n\nQuestion: ${question}`,
      },
    ],
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    stream: true,
  });

  let fullAnswer = '';

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || '';
    if (token) {
      fullAnswer += token;
      onToken(token);
    }
  }

  return fullAnswer;
}