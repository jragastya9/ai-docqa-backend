import '../config/env.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

/**
 * Sign a JWT token.
 * Accepts either a Mongoose User document OR a plain object.
 * Only picks the fields we actually need.
 */
export function signToken(user) {
  if (!user) {
    throw new Error('signToken: user is required');
  }

  // Extract only the fields we need — works for Mongoose docs and plain objects
  const payload = {
    id: (user._id || user.id)?.toString(),
    email: user.email,
    tenantId: user.tenantId ? user.tenantId.toString() : undefined,
    role: user.role,
  };

  if (!payload.id || !payload.email) {
    throw new Error('signToken: user must have id and email');
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT token. Throws if invalid/expired.
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
