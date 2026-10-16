import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

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
 * 100 questions per 15 minutes per token + IP
 */
export const publicChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'You have asked too many questions. Please wait a few minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use ipKeyGenerator helper for IPv6-safe IP hashing
    const ip = ipKeyGenerator(req);
    return `${req.params.token}-${ip}`;
  },
});
