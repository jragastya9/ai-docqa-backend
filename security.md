
---

### 📄 FILE 4: `security.md`

```markdown
# 🔐 Security — LocalBiz AI

**Version:** 1.0
**Last updated:** October 2026

How LocalBiz AI protects user data, authenticates requests, and defends against abuse.

---

## 🎯 Threat model

| Threat | Likelihood | Mitigation |
|--------|-----------|------------|
| Credential stuffing | High | bcrypt, rate limiting |
| XSS | Medium | React escaping, CSP headers |
| SQL/NoSQL injection | Medium | Mongoose sanitization |
| Cross-tenant data leak | High | tenantId on every query |
| Leaked API keys | Medium | Rotation, env vars |
| Prompt injection | Medium | Moderation API, system prompt |
| DDoS | Low (free tier) | Render + Cloudflare |
| Session hijacking | Low | HttpOnly cookies (future), token versioning |

---

## 🔐 Authentication

### JWT structure

```json
{
  "id": "user_id",
  "email": "user@example.com",
  "tenantId": "tenant_id",
  "role": "owner",
  "tv": 0,
  "jti": "random_32_hex",
  "iat": 1792000000,
  "exp": 1792604800
}

Signed with: JWT_SECRET (env var, 64-byte hex)

Algorithm: HS256

Expiry: 7 days

Token versioning (Day 22)
Every user has a tokenVersion field. JWT includes tv. Middleware checks:

if (decoded.tv < user.tokenVersion) {
  return res.status(401).json({ error: 'Session revoked' });
}

When to bump tokenVersion:

User changes password

User clicks "Log out everywhere"

Admin revokes user

Security incident

One bump invalidates ALL existing tokens for that user.

Password hashing
Algorithm: bcrypt

Cost: 12 rounds

Never logged: passwords never appear in logs, responses, or exports

const hash = await bcrypt.hash(password, 12);

2FA (TOTP)
Library: speakeasy

Secret: 32 bytes base32

Backup codes: 10 codes, bcrypt-hashed

Window: ±1 (allows slight clock drift)

Google OAuth
Library: NextAuth v5 (frontend) + manual backend callback

Flow:

User clicks "Continue with Google"
NextAuth redirects to Google
Google returns to /google-callback
signIn callback hits backend /api/auth/google
Backend creates/finds user, returns app JWT
Frontend stores JWT
🛡️ Authorization (RBAC)
Roles
Role	Can do
owner	Everything, including billing and team management
admin	Everything except billing and owner-only actions
member	Read/write own data, chat, upload
viewer	Read-only

Middleware
// backend/middleware/rbac.js
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Owner only' });
  }
  next();
}

Usage
router.post('/invite', requireRole('owner', 'admin'), inviteMember);
router.patch('/:id/role', requireOwner, updateMemberRole);
router.delete('/:id', requireOwner, removeMember);

🏢 Multi-tenancy isolation
Rule: every query MUST filter by tenantId.

// ✅ Correct
const docs = await Document.find({ tenantId: req.tenantId });

// ❌ NEVER — leaks data
const docs = await Document.find({});

Enforcement checklist
□ Every model has tenantId field + index
□ Every controller filters by tenantId
□ middleware/tenant.js sets req.tenantId from JWT
□ Vector search $search includes tenantId filter
□ Public endpoints (share links) use token not tenantId

Cross-tenant test
Create two tenants. Try to access tenant A's data while logged into tenant B:

# Login as tenant B
# GET /api/documents/{A's doc id}
# Expected: 404 (not found — filtered by tenantId)

🔒 Data protection
In transit
HTTPS only — Vercel and Render enforce

HSTS enabled by default

At rest
MongoDB Atlas: encrypted at rest (default)

Passwords: bcrypt hashed

2FA secrets: stored in plaintext (must be readable for TOTP verification, but accessible only by user)

Backup codes: bcrypt hashed

Sensitive fields
Field	Storage	Notes
User password	bcrypt(12)	Never returned by API
JWT	localStorage (browser)	Vulnerable to XSS
2FA secret	plaintext	Required for verification
Backup codes	bcrypt(10)	One-time use
API keys	env vars	Never in code or DB
Webhook secret	plaintext	Required for HMAC signing
🚨 Rate limiting
Public endpoints

// middleware/rateLimit.js
export const publicViewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});

export const publicChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => `${req.params.token}-${req.ip}`
});

Authenticated endpoints
Global limiter: 100 req / 15 min / IP (configurable per route).

Abuse response
429 Too Many Requests

Retry-After header

Logged to QueryMetric for analysis

🛡️ Content moderation
Day 23 feature. All user input is checked before being processed.

Layers
Custom blocklist (regex patterns for extreme cases)

OpenAI Moderation API (free, fast)

Fallback to pattern matching if OpenAI unavailable

Blocked inputs
Logged to ModerationLog

Returned with { error: 'Content flagged', code: 'CONTENT_FLAGGED' }

User sees toast notification

Categories checked
Hate speech

Harassment

Self-harm

Sexual content (minors)

Violence

Illegal activity

🔐 Session management
Session tracking
Every login creates a Session record:

await Session.create({
  userId,
  tokenId: decoded.jti,
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
  browser: parsedUA.browser,
  os: parsedUA.os,
  device: parsedUA.device,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});

Device management
User can see all their sessions in Settings → Security.

Revoke a session
Soft revoke: set revokedAt on Session record

Hard revoke: bump user.tokenVersion (invalidates ALL sessions)

Auto-cleanup
Sessions expire after 7 days (TTL index)

Revoked sessions retained for audit

🚨 Incident response
If API key leaked
Revoke the key at the provider immediately

Create a new key

Update env vars locally + on Render

Redeploy backend

Notify affected users if data was accessed

Document the incident

If MongoDB password leaked
Rotate password in Atlas immediately

Update MONGO_URI locally + Render

Check logs for unauthorized queries (last 24h)

Force logout all users (bump tokenVersion for all)

Enable IP whitelist (tighten access)

Review what data may have been exposed

If user account compromised
Admin revokes user's sessions (bump tokenVersion)

User changes password

Re-enable 2FA

Audit last 30 days of activity

🎯 Security checklist (before launch)
□ Rotated all leaked secrets
□ JWT_SECRET is 64-byte random hex
□ MONGO_URI password is strong + unique
□ Google OAuth redirect URIs restricted to your domain
□ MongoDB IP whitelist allows only Render
□ Rate limiting enabled on all routes
□ Content moderation enabled on chat input
□ HTTPS enforced (Vercel + Render)
□ .env files NOT in Git
□ .env.example in Git (no secrets)
□ 2FA tested end-to-end
□ Session tracking works
□ GDPR data export works
□ Account deletion works
□ Webhook signature verification works