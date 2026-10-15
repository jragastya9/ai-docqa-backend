import Groq from 'groq-sdk';
import { CohereClient } from 'cohere-ai';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Initialize clients (null if no key) ───
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const cohere = process.env.COHERE_API_KEY
  ? new CohereClient({ token: process.env.COHERE_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// ─── Provider registry ───
export const PROVIDERS = {
  groq: {
    id: 'groq',
    name: 'Groq (Llama 3.3)',
    model: 'openai/gpt-oss-120b',
    available: !!groq,
    description: 'Ultra-fast inference, great for chat. Free tier friendly.',
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere Command R',
    model: 'command-r-08-2024',
    available: !!cohere,
    description: 'Strong at RAG and citation. Free trial tier.',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI GPT-4o mini',
    model: 'gpt-4o-mini',
    available: !!openai,
    description: 'Highest quality, most reliable. Paid ($5 min credit).',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini 1.5 Flash',
    model: 'gemini-1.5-flash',
    available: !!genAI,
    description: 'Generous free tier, long context. Google account only.',
  },
};

const DEFAULT_PROVIDER = 'groq';

// ─── Prompt builders ───
function buildSystemPrompt(chunks, customPrompt) {
  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (Document: ${c.documentName || 'Unknown'})\n${c.text}`
    )
    .join('\n\n');

  const baseRules = `You are a helpful AI assistant that answers questions based on the user's documents.

RULES:
- Answer ONLY using the provided context below.
- If the context doesn't contain the answer, say: "I couldn't find that information in your documents."
- Cite sources using [Source N] notation when you use information from a source.
- Be concise and direct. No filler.
- Never invent facts.`;

  const custom = customPrompt?.trim()
    ? `\n\nADDITIONAL INSTRUCTIONS FROM THE WORKSPACE OWNER:\n${customPrompt.trim()}`
    : '';

  return `${baseRules}${custom}\n\nCONTEXT:\n${context}`;
}

function buildMessages(question, chunks, history, customPrompt) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(chunks, customPrompt) },
  ];
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: 'user', content: question });
  return messages;
}

// ═══════════════════════════════════════════
// NON-STREAMING
// ═══════════════════════════════════════════
export async function generateAnswer(
  question,
  chunks,
  history = [],
  options = {}
) {
  const provider = options.provider || DEFAULT_PROVIDER;
  const customPrompt = options.customPrompt;

  switch (provider) {
    case 'cohere':
      if (cohere) return generateCohere(question, chunks, history, customPrompt);
      break;
    case 'openai':
      if (openai) return generateOpenAI(question, chunks, history, customPrompt);
      break;
    case 'gemini':
      if (genAI) return generateGemini(question, chunks, history, customPrompt);
      break;
    case 'groq':
    default:
      if (groq) return generateGroq(question, chunks, history, customPrompt);
  }

  // Fallback chain — try whatever is available
  if (groq) return generateGroq(question, chunks, history, customPrompt);
  if (cohere) return generateCohere(question, chunks, history, customPrompt);
  if (openai) return generateOpenAI(question, chunks, history, customPrompt);
  if (genAI) return generateGemini(question, chunks, history, customPrompt);

  throw new Error('No LLM provider configured. Add at least one API key.');
}

async function generateGroq(question, chunks, history, customPrompt) {
  const messages = buildMessages(question, chunks, history, customPrompt);
  const completion = await groq.chat.completions.create({
    model: PROVIDERS.groq.model,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
  });
  const answer = completion.choices[0]?.message?.content || '';
  const tokensUsed = completion.usage?.total_tokens || 0;
  return { answer, tokensUsed, provider: 'groq', model: PROVIDERS.groq.model };
}

async function generateCohere(question, chunks, history, customPrompt) {
  const systemPrompt = buildSystemPrompt(chunks, customPrompt);
  const chatHistory = history.map((m) => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: m.content,
  }));
  const response = await cohere.chat({
    model: PROVIDERS.cohere.model,
    preamble: systemPrompt,
    message: question,
    chatHistory,
    temperature: 0.2,
  });
  const answer = response.text || '';
  const tokensUsed =
    (response.meta?.tokens?.inputTokens || 0) +
    (response.meta?.tokens?.outputTokens || 0);
  return {
    answer,
    tokensUsed,
    provider: 'cohere',
    model: PROVIDERS.cohere.model,
  };
}

async function generateOpenAI(question, chunks, history, customPrompt) {
  const messages = buildMessages(question, chunks, history, customPrompt);
  const completion = await openai.chat.completions.create({
    model: PROVIDERS.openai.model,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
  });
  const answer = completion.choices[0]?.message?.content || '';
  const tokensUsed = completion.usage?.total_tokens || 0;
  return {
    answer,
    tokensUsed,
    provider: 'openai',
    model: PROVIDERS.openai.model,
  };
}

async function generateGemini(question, chunks, history, customPrompt) {
  const model = genAI.getGenerativeModel({
    model: PROVIDERS.gemini.model,
    systemInstruction: buildSystemPrompt(chunks, customPrompt),
  });

  // Gemini uses 'model' role for assistant
  const contents = [];
  for (const msg of history) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: question }] });

  const result = await model.generateContent({ contents });
  const response = result.response;
  const answer = response.text() || '';
  const tokensUsed =
    (response.usageMetadata?.promptTokenCount || 0) +
    (response.usageMetadata?.candidatesTokenCount || 0);

  return {
    answer,
    tokensUsed,
    provider: 'gemini',
    model: PROVIDERS.gemini.model,
  };
}

// ═══════════════════════════════════════════
// STREAMING
// ═══════════════════════════════════════════
export async function* streamAnswer(
  question,
  chunks,
  history = [],
  options = {}
) {
  const provider = options.provider || DEFAULT_PROVIDER;
  const customPrompt = options.customPrompt;

  switch (provider) {
    case 'cohere':
      if (cohere) {
        yield* streamCohere(question, chunks, history, customPrompt);
        return;
      }
      break;
    case 'openai':
      if (openai) {
        yield* streamOpenAI(question, chunks, history, customPrompt);
        return;
      }
      break;
    case 'gemini':
      if (genAI) {
        yield* streamGemini(question, chunks, history, customPrompt);
        return;
      }
      break;
    case 'groq':
    default:
      if (groq) {
        yield* streamGroq(question, chunks, history, customPrompt);
        return;
      }
  }

  // Fallback
  if (groq) {
    yield* streamGroq(question, chunks, history, customPrompt);
    return;
  }
  if (cohere) {
    yield* streamCohere(question, chunks, history, customPrompt);
    return;
  }
  if (openai) {
    yield* streamOpenAI(question, chunks, history, customPrompt);
    return;
  }
  if (genAI) {
    yield* streamGemini(question, chunks, history, customPrompt);
    return;
  }

  yield { type: 'error', data: 'No LLM provider configured' };
}

async function* streamGroq(question, chunks, history, customPrompt) {
  const messages = buildMessages(question, chunks, history, customPrompt);
  try {
    const stream = await groq.chat.completions.create({
      model: PROVIDERS.groq.model,
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
      if (chunk.usage?.total_tokens) tokensUsed = chunk.usage.total_tokens;
    }
    if (!tokensUsed) tokensUsed = Math.ceil(fullText.length / 4);
    yield {
      type: 'done',
      data: {
        fullText,
        tokensUsed,
        provider: 'groq',
        model: PROVIDERS.groq.model,
      },
    };
  } catch (err) {
    console.error('streamGroq error:', err);
    yield { type: 'error', data: err.message };
  }
}

async function* streamCohere(question, chunks, history, customPrompt) {
  const systemPrompt = buildSystemPrompt(chunks, customPrompt);
  const chatHistory = history.map((m) => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: m.content,
  }));
  try {
    const stream = await cohere.chatStream({
      model: PROVIDERS.cohere.model,
      preamble: systemPrompt,
      message: question,
      chatHistory,
      temperature: 0.2,
    });
    let fullText = '';
    let tokensUsed = 0;
    for await (const event of stream) {
      if (event.eventType === 'text-generation') {
        const delta = event.text || '';
        if (delta) {
          fullText += delta;
          yield { type: 'token', data: delta };
        }
      } else if (event.eventType === 'stream-end') {
        const usage = event.response?.meta?.tokens;
        if (usage) {
          tokensUsed = (usage.inputTokens || 0) + (usage.outputTokens || 0);
        }
      }
    }
    if (!tokensUsed) tokensUsed = Math.ceil(fullText.length / 4);
    yield {
      type: 'done',
      data: {
        fullText,
        tokensUsed,
        provider: 'cohere',
        model: PROVIDERS.cohere.model,
      },
    };
  } catch (err) {
    console.error('streamCohere error:', err);
    yield { type: 'error', data: err.message };
  }
}

async function* streamOpenAI(question, chunks, history, customPrompt) {
  const messages = buildMessages(question, chunks, history, customPrompt);
  try {
    const stream = await openai.chat.completions.create({
      model: PROVIDERS.openai.model,
      messages,
      temperature: 0.2,
      max_tokens: 1024,
      stream: true,
      stream_options: { include_usage: true },
    });
    let fullText = '';
    let tokensUsed = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        yield { type: 'token', data: delta };
      }
      if (chunk.usage?.total_tokens) tokensUsed = chunk.usage.total_tokens;
    }
    if (!tokensUsed) tokensUsed = Math.ceil(fullText.length / 4);
    yield {
      type: 'done',
      data: {
        fullText,
        tokensUsed,
        provider: 'openai',
        model: PROVIDERS.openai.model,
      },
    };
  } catch (err) {
    console.error('streamOpenAI error:', err);
    yield { type: 'error', data: err.message };
  }
}

async function* streamGemini(question, chunks, history, customPrompt) {
  try {
    const model = genAI.getGenerativeModel({
      model: PROVIDERS.gemini.model,
      systemInstruction: buildSystemPrompt(chunks, customPrompt),
    });

    const contents = [];
    for (const msg of history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
    contents.push({ role: 'user', parts: [{ text: question }] });

    const result = await model.generateContentStream({ contents });

    let fullText = '';
    let tokensUsed = 0;

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        yield { type: 'token', data: text };
      }
    }

    const finalResponse = await result.response;
    const usage = finalResponse.usageMetadata;
    if (usage) {
      tokensUsed =
        (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0);
    }
    if (!tokensUsed) tokensUsed = Math.ceil(fullText.length / 4);

    yield {
      type: 'done',
      data: {
        fullText,
        tokensUsed,
        provider: 'gemini',
        model: PROVIDERS.gemini.model,
      },
    };
  } catch (err) {
    console.error('streamGemini error:', err);
    yield { type: 'error', data: err.message };
  }
}
