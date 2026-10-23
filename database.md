
---

### 📄 FILE 3: `database.md`

```markdown
# 🗄️ Database Schema — LocalBiz AI

**Version:** 1.0
**Last updated:** October 2026
**Database:** MongoDB Atlas
**ODM:** Mongoose 8

---

## 🎯 Overview

18 collections. Every collection that stores tenant data has a `tenantId` field with an index for isolation.

### Collection map

| Collection | Purpose | TTL? |
|------------|---------|------|
| `tenants` | Workspaces | No |
| `users` | Team members | No |
| `invitations` | Pending invites | No (manual expire) |
| `documents` | Uploaded PDFs | No |
| `chunks` | Text chunks + embeddings | No |
| `conversations` | Chat sessions | No |
| `messages` | Individual messages | No |
| `sharelinks` | Public Q&A links | No |
| `usages` | Monthly counters | No |
| `subscriptions` | Billing records | No |
| `notifications` | In-app alerts | No |
| `webhooks` | Webhook endpoints | No |
| `webhookdeliveries` | Delivery attempts | 30 days |
| `sessions` | Auth sessions | 7 days |
| `impersonationlogs` | Admin audit | No |
| `moderationlogs` | Content checks | No |
| `abusereports` | User reports | No |
| `supporttickets` | Help tickets | No |
| `emailLogs` | Marketing emails | No |
| `queryMetrics` | Slow request logs | 7 days |
| `responseCaches` | LLM response cache | 1 hour |

---

## 📊 Schema details

### `tenants`

```javascript
{
  _id: ObjectId,
  name: String (required, max 100),
  slug: String (unique, lowercase, required),
  subdomain: String (unique, lowercase, sparse),
  customDomain: String (unique, lowercase, sparse),
  domainVerified: Boolean,
  ownerId: ObjectId (ref: User, indexed),
  plan: enum ['free', 'pro', 'business'],
  settings: {
    // Branding
    brandName: String,
    tagline: String,
    logo: String,
    favicon: String,
    primaryColor: String (default '#6366f1'),
    supportEmail: String,
    footerText: String,
    // AI
    aiProvider: enum ['groq', 'cohere', 'openai', 'gemini'],
    customPrompt: String (max 2000),
    cachingEnabled: Boolean (default true),
    // Admin
    featureFlags: Mixed
  },
  isActive: Boolean (default true),
  createdAt: Date,
  updatedAt: Date
}

Indexes: slug, subdomain, customDomain, ownerId.

users
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique, lowercase, indexed),
  password: String (bcrypt hash, null for Google-only),
  avatar: String,
  googleId: String,
  tenantId: ObjectId (ref: Tenant, indexed),
  role: enum ['owner', 'admin', 'member', 'viewer'],
  isActive: Boolean,
  emailVerified: Boolean,
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLoginAt: Date,

  // Day 22
  tokenVersion: Number (default 0),
  twoFactor: {
    enabled: Boolean,
    secret: String,
    backupCodes: [String], // bcrypt hashed
    enabledAt: Date
  },

  // Day 26
  lastActiveAt: Date (indexed),
  onboardingStep: Number (0-3),
  trialEndsAt: Date,
  emailPrefs: {
    marketing: Boolean,
    onboarding: Boolean,
    weeklyDigest: Boolean,
    unsubscribedAt: Date
  },

  createdAt: Date,
  updatedAt: Date
}
Indexes: email (unique).

documents
{
  _id: ObjectId,
  userId: ObjectId (ref: User, required),
  tenantId: ObjectId (ref: Tenant, required, indexed),
  fileName: String (required),
  fileSize: Number,
  pageCount: Number,
  wordCount: Number,
  chunkCount: Number,
  status: enum ['processing', 'completed', 'failed'],
  errorMessage: String,
  createdAt: Date,
  updatedAt: Date
}
Indexes: (tenantId, createdAt).

chunks
{
  _id: ObjectId,
  documentId: ObjectId (ref: Document, required, indexed),
  userId: ObjectId (ref: User, required),
  tenantId: ObjectId (ref: Tenant, required, indexed),
  chunkIndex: Number (required),
  text: String (required),
  wordCount: Number,
  embedding: [Number], // 384-dim array
  createdAt: Date
}
Indexes:
(tenantId, documentId)

Vector Search index on embedding (384 dims, cosine) with filters tenantId, documentId, userId.

conversations
{
  _id: ObjectId,
  userId: ObjectId (ref: User, required, indexed),
  tenantId: ObjectId (ref: Tenant, required, indexed),
  title: String (max 100),
  messageCount: Number (default 0),
  lastMessageAt: Date,
  createdAt: Date,
  updatedAt: Date
}
Indexes: (tenantId, userId, lastMessageAt desc).

messages
{
  _id: ObjectId,
  conversationId: ObjectId (ref: Conversation, required, indexed),
  userId: ObjectId (ref: User, required),
  tenantId: ObjectId (ref: Tenant, required, indexed),
  role: enum ['user', 'assistant'],
  content: String (required),
  sources: [{
    sourceNumber: Number,
    chunkId: ObjectId,
    documentId: ObjectId,
    documentName: String,
    chunkIndex: Number,
    text: String,
    score: Number
  }],
  tokensUsed: Number,
  model: String,           // Day 20
  provider: enum ['groq', 'cohere', 'openai', 'gemini'],
  feedback: enum ['up', 'down', null],
  feedbackNote: String,
  feedbackAt: Date,
  cached: Boolean,
  createdAt: Date,
  updatedAt: Date
}
Indexes: (tenantId, conversationId, createdAt), (tenantId, feedback).

sharelinks
{
  _id: ObjectId,
  tenantId: ObjectId (ref: Tenant, indexed),
  documentId: ObjectId (ref: Document, indexed),
  userId: ObjectId (ref: User),
  token: String (unique, indexed),
  expiresAt: Date,
  viewCount: Number (default 0),
  isActive: Boolean (default true),
  createdAt: Date
}

usages
Monthly counters per tenant.
{
  _id: ObjectId,
  tenantId: ObjectId (ref: Tenant, indexed),
  month: String ('YYYY-MM'),
  documentCount: Number (default 0),
  messageCount: Number (default 0),
  aiTokensUsed: Number (default 0),
  createdAt: Date,
  updatedAt: Date
}
Indexes: (tenantId, month) (unique).

subscriptions
{
  _id: ObjectId,
  tenantId: ObjectId (ref: Tenant, indexed),
  plan: enum ['pro', 'business'],
  status: enum ['created', 'active', 'cancelled', 'expired'],
  razorpaySubscriptionId: String,
  razorpayPaymentId: String,
  amount: Number,         // in paise
  currency: String,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  createdAt: Date,
  updatedAt: Date
}

notifications
{
  _id: ObjectId,
  userId: ObjectId (ref: User, required, indexed),
  tenantId: ObjectId (ref: Tenant, required, indexed),
  type: enum [11 types - document_uploaded, plan_upgraded, ...],
  title: String,
  description: String,
  href: String,
  meta: Mixed,
  read: Boolean (default false, indexed),
  readAt: Date,
  createdAt: Date
}
Indexes: (userId, read, createdAt desc).

webhooks
{
  _id: ObjectId,
  tenantId: ObjectId (ref: Tenant, indexed),
  url: String (required),
  events: [String], // 8 supported events
  secret: String (auto-generated whsec_),
  description: String,
  active: Boolean (default true),
  lastTriggeredAt: Date,
  failureCount: Number,
  createdAt: Date,
  updatedAt: Date
}

webhookdeliveries
{
  _id: ObjectId,
  webhookId: ObjectId (ref: Webhook, indexed),
  tenantId: ObjectId (indexed),
  event: String,
  payload: Mixed,
  responseStatus: Number,
  responseBody: String,
  duration: Number,
  success: Boolean,
  error: String,
  createdAt: Date // TTL: 30 days
}

sessions
Tracks active device sessions.
{
  _id: ObjectId,
  userId: ObjectId (ref: User, indexed),
  tokenId: String (unique, indexed), // JWT jti claim
  userAgent: String,
  ipAddress: String,
  browser: String,
  os: String,
  device: String,
  city: String,
  country: String,
  lastActiveAt: Date,
  expiresAt: Date (TTL: auto-delete),
  revokedAt: Date,
  revokedReason: String,
  createdAt: Date
}

Other collections
Collection	Key fields
impersonationlogs	adminUserId, targetUserId, reason, createdAt
moderationlogs	userId, tenantId, contentPreview, categories, action
abusereports	reporterUserId, reportedTenantId, category, status
supporttickets	userId, subject, description, status, priority, replies[]
emailLogs	userId, type (onboarding_1, trial_reminder...), status
queryMetrics	method, path, duration, statusCode (TTL: 7 days)
responseCaches	tenantId, questionHash (unique per tenant), answer, expiresAt (TTL: 1 hour)

🔐 Multi-tenancy isolation
Every query that touches tenant data must include tenantId:

// ✅ Correct
await Document.find({ tenantId: req.tenantId });

// ❌ Wrong — leaks data across tenants
await Document.find({});

Exception: Public share pages filter by token, not tenantId.

🎯 Vector search index
Create in Atlas UI:

Name: vector_index
Collection: chunks
Dimensions: 384
Similarity: cosine

{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "tenantId"
    },
    {
      "type": "filter",
      "path": "documentId"
    }
  ]
}

🔄 Backup strategy
Automated: MongoDB Atlas daily snapshots (M10+)

Manual: GET /api/backup/export (super admin)

Retention: 7 days on free tier, 30 days on paid

📈 Size estimates
At 100 users, 1000 documents:

chunks: ~50,000 docs × 2KB = 100 MB

messages: ~10,000 docs × 1KB = 10 MB

documents: ~1,000 docs × 500B = 500 KB

Everything else: ~5 MB

Total: ~120 MB. Fits in M0 free tier (512 MB).

At 1000 users, M10 ($57/mo) recommended.