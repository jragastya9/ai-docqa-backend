import rateLimit from 'express-rate-limit';

/**
 * Rate limit for public share page views
 * 100 requests per 15 minutes per IP
 */
export const publicViewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limit for public chat
 * 20 questions per 15 minutes per IP — generous for real users, blocks bots
 */
export const publicChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'You have asked too many questions. Please wait a few minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per share token + IP
    return `${req.params.token}-${req.ip}`;
  },
});