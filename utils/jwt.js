import '../config/env.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

export function signToken(user) {
  if (!user) throw new Error('signToken: user is required');

  const payload = {
    id: (user._id || user.id)?.toString(),
    email: user.email,
    tenantId: user.tenantId ? user.tenantId.toString() : undefined,
    role: user.role,
    tv: user.tokenVersion || 0, // token version
    jti: crypto.randomBytes(16).toString('hex'), // unique token id (for session tracking)
  };

  if (!payload.id || !payload.email) {
    throw new Error('signToken: user must have id and email');
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function getTokenExpiry() {
  // Decode the expiry of a fresh token in seconds → convert to Date
  const probe = jwt.sign({ probe: true }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  const decoded = jwt.decode(probe);
  return new Date(decoded.exp * 1000);
}
