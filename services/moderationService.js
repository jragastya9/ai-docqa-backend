import ModerationLog from '../models/ModerationLog.js';

// Simple fallback blocklist for when OpenAI isn't configured
const BLOCKED_PATTERNS = [
  /\b(make|build|create)\s+(a\s+)?(bomb|explosive|weapon)/i,
  /\b(kill|murder|hurt)\s+(myself|yourself|someone|people)/i,
  /\bchild\s+(porn|abuse|exploitation)/i,
  /\b(credit\s+card|ssn|social\s+security)\s+(dump|leak|steal)/i,
];

let openaiClient = null;

async function getOpenAI() {
  if (openaiClient) return openaiClient;
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openaiClient;
  } catch {
    return null;
  }
}

/**
 * Check content. Returns { allowed, flagged, categories, reason }.
 * Logs to ModerationLog either way.
 */
export async function checkContent({
  content,
  userId,
  tenantId,
  source = 'other',
  blockOnFlag = true,
}) {
  if (!content || typeof content !== 'string') {
    return { allowed: true, flagged: false };
  }

  const text = content.trim().slice(0, 4000);

  // 1. Fallback pattern check (always runs)
  for (const re of BLOCKED_PATTERNS) {
    if (re.test(text)) {
      const reason = 'Matched blocked pattern';
      await logModeration({
        userId,
        tenantId,
        content: text,
        source,
        flagged: true,
        categories: { custom: true },
        action: blockOnFlag ? 'block' : 'report',
        reason,
      });
      return {
        allowed: !blockOnFlag,
        flagged: true,
        categories: { custom: true },
        reason,
      };
    }
  }

  // 2. OpenAI Moderation
  const openai = await getOpenAI();
  if (openai) {
    try {
      const res = await openai.moderations.create({
        model: 'omni-moderation-latest',
        input: text,
      });
      const result = res.results?.[0];
      if (result) {
        const flagged = result.flagged;
        const categories = Object.fromEntries(
          Object.entries(result.categories || {}).filter(([, v]) => v)
        );

        if (flagged) {
          const reason = `Flagged: ${Object.keys(categories).join(', ')}`;
          await logModeration({
            userId,
            tenantId,
            content: text,
            source,
            flagged: true,
            categories,
            action: blockOnFlag ? 'block' : 'report',
            reason,
          });
          return { allowed: !blockOnFlag, flagged: true, categories, reason };
        }
      }
    } catch (err) {
      console.error('OpenAI moderation error:', err.message);
    }
  }

  return { allowed: true, flagged: false };
}

async function logModeration({
  userId,
  tenantId,
  content,
  source,
  flagged,
  categories,
  action,
  reason,
}) {
  try {
    await ModerationLog.create({
      userId,
      tenantId,
      content,
      contentPreview: content.slice(0, 200),
      source,
      flagged,
      categories,
      action,
      reason,
    });
  } catch (err) {
    console.error('Moderation log error:', err.message);
  }
}
