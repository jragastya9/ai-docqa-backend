import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'openai/gpt-oss-120b';

function buildSystemPrompt(chunks) {
  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (Document: ${c.documentName || 'Unknown'})\n${c.text}`
    )
    .join('\n\n');

  return `You are a helpful AI assistant that answers questions based on the user's documents.

RULES:
- Answer ONLY using the provided context below.
- If the context doesn't contain the answer, say: "I couldn't find that information in your documents."
- Cite sources using [Source N] notation when you use information from a source.
- Be concise and direct. No filler.
- Never invent facts.

CONTEXT:
${context}`;
}

function buildMessages(question, chunks, history) {
  const messages = [{ role: 'system', content: buildSystemPrompt(chunks) }];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: 'user', content: question });
  return messages;
}

// ─── Non-streaming (kept for fallback / API compatibility) ───
export async function generateAnswer(question, chunks, history = []) {
  const messages = buildMessages(question, chunks, history);

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
  });

  const answer = completion.choices[0]?.message?.content || '';
  const tokensUsed = completion.usage?.total_tokens || 0;

  return { answer, tokensUsed };
}

// ─── Streaming version ───
/**
 * Streams the answer token-by-token.
 * Returns an async generator that yields { type, data } events.
 * Event types: 'token' | 'done' | 'error'
 */
export async function* streamAnswer(question, chunks, history = []) {
  const messages = buildMessages(question, chunks, history);

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 1024,
      stream: true,
    });

    let fullText = '';
    let tokensUsed = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        yield { type: 'token', data: delta };
      }
      if (chunk.usage?.total_tokens) {
        tokensUsed = chunk.usage.total_tokens;
      }
    }

    // Groq returns usage only on the final chunk sometimes — estimate if missing
    if (!tokensUsed) {
      tokensUsed = Math.ceil(fullText.length / 4);
    }

    yield { type: 'done', data: { fullText, tokensUsed } };
  } catch (err) {
    console.error('streamAnswer error:', err);
    yield { type: 'error', data: err.message };
  }
}