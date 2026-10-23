# 🏗️ System Architecture — LocalBiz AI

**Version:** 1.0
**Last updated:** October 2026

How LocalBiz AI is built, deployed, and scaled.

---

## 🎯 Overview

LocalBiz AI is a **multi-tenant RAG SaaS** for small businesses. Users upload PDFs, chat with them via AI, and share Q&A links with customers.

### High-level architecture
┌─────────────┐
│ Browser │
└──────┬──────┘
│ HTTPS
┌──────▼───────────────┐
│ Vercel (Next.js 16) │
│ - SSR + client │
│ - API routes │
└──────┬───────────────┘
│ HTTPS + JWT
┌──────▼───────────────┐
│ Render (Express) │
│ - REST API │
│ - SSE streams │
│ - Webhook dispatcher │
└──────┬───────────────┘
│ MongoDB driver
┌──────▼───────────────┐
│ MongoDB Atlas │
│ - 18 collections │
│ - Vector search │
│ - Auto-backups │
└──────────────────────┘

External services:

Groq, Cohere, Gemini (LLM inference)

HuggingFace (embeddings)

Resend (transactional email)

Razorpay (payments - mocked)
---

## 🧱 Layer breakdown

### 1. Frontend — Next.js 16 (Vercel)

**Responsibilities:**
- SSR marketing pages for SEO
- Client-side dashboard
- SSE consumption (chat streaming, notifications)
- PWA + offline support
- PWA installable

**Key folders:**
app/
├── (auth)/ Auth pages (login, signup, verify)
├── (dashboard)/ Authenticated app (billing, chat, docs...)
├── legal/ Privacy, Terms, Refund, Cookies
├── launch/ Public launch page
├── changelog/ Product updates
├── roadmap/ Public roadmap
└── share/[token]/ Public share pages (no auth)

**State management:**
- Server state: React Query (not used yet — direct axios)
- Client state: React useState + Context (Notifications)
- Global pub-sub: `tenantStore` (custom)

**Deployment:** Vercel Hobby (free) → Pro when scaling.

### 2. Backend — Express 4 (Render)

**Responsibilities:**
- REST API (60+ endpoints)
- Auth middleware (JWT + RBAC)
- RAG pipeline orchestration
- Streaming responses (SSE)
- Webhook delivery with HMAC signing
- Cron jobs (marketing automation)

**Key folders:**
backend/
├── config/ env.js, db.js, plans.js
├── controllers/ Route handlers (auth, billing, chat, ...)
├── middleware/ auth, rbac, planGuard, rateLimit, cache
├── models/ Mongoose schemas (18 files)
├── routes/ Express routers
├── services/ Business logic (LLM, search, usage, ...)
├── jobs/ node-cron scheduler
└── server.js Entry point


**Deployment:** Render free → Starter ($7/mo) when scaling.

### 3. Database — MongoDB Atlas (M0 Free → M10 paid)

**Structure:**
- 18 collections
- Vector search index on `chunks.embedding`
- Compound indexes on `(tenantId, ...)` for isolation
- TTL indexes on ephemeral collections (sessions, caches)

See `database.md` for full schema.

### 4. External services

| Service | Purpose | Cost |
|---------|---------|------|
| **Groq** | Primary LLM (fast) | Free tier |
| **Cohere** | Backup LLM (citations) | Free trial |
| **Gemini** | Backup LLM (long context) | Free tier |
| **OpenAI** | Premium LLM (optional) | $5 min |
| **HuggingFace** | Embeddings (MiniLM-L6) | Free tier |
| **Resend** | Transactional email | Free 3k/mo |
| **Razorpay** | Payments (currently mocked) | 2% per txn |
| **Sentry** | Error tracking | Free 5k/mo |
| **UptimeRobot** | Uptime monitoring | Free |

---

## 🔄 Core flows

### Flow 1 — Signup + workspace creation
Client POST /api/auth/signup
→ Server creates Tenant
→ Server creates User (role: owner, tenantId)
→ Server signs JWT (id, email, tenantId, role, tokenVersion)
→ Server sends welcome email (async)
→ Server returns { token, user, tenant }
→ Client stores in localStorage
→ Redirects to /dashboard
### Flow 2 — Document upload
Client POST /api/documents/upload (multipart)
→ multer receives file → buffer
→ Document record created (status: processing)
→ extractTextFromPDF(buffer)
→ cleanText(text)
→ chunkText(cleaned, chunkSize=500, overlap=50)
→ For each chunk:
→ generateEmbedding(chunk.text) [HF API]
→ Chunk.insertMany(chunks with embeddings)
→ Document updated (status: completed, counts)
→ incrementDocuments(tenantId)
→ notify(owner, "Document processed")
→ fireWebhook("document.uploaded")
→ Return { document: {...} }
### Flow 3 — Chat with RAG
Client POST /api/chat/stream
→ SSE headers set
→ moderateContent(question) [OpenAI Moderation]
→ Find or create Conversation
→ Load last 10 messages (memory)
→ searchChunks(question, tenantId, topK=5)
→ embedQuestion(question) → 384-dim vector
→ MongoDB $search (vector similarity + tenantId filter)
→ Return top 5 chunks
→ Check response cache (questionHash)
→ Hit? Stream cached answer + return
→ streamAnswer(question, chunks, history, provider)
→ Groq/Cohere/Gemini streaming API
→ Yield each token as SSE
→ On done:
→ Save Message (assistant, fullText, sources)
→ Cache response
→ incrementMessages + incrementTokens
### Flow 4 — Subscription upgrade (mock)
Client POST /api/billing/subscribe { plan: 'pro' }
→ Server returns mock order { id, amount }
Client POST /api/billing/verify { plan: 'pro' }
→ Server updates Tenant.plan = 'pro'
→ Server creates Subscription record
→ notify(user, "Upgraded to Pro")
→ fireWebhook("subscription.upgraded")
→ Return { tenant: { plan: 'pro' } }
### Flow 5 — Webhook delivery
Event fires (e.g., document.uploaded)
→ fireWebhook({ tenantId, event, data })
→ Query active Webhooks for tenant + event
→ For each hook:
→ Sign payload with HMAC-SHA256
→ POST to webhook.url with headers:
X-LocalBiz-Event
X-LocalBiz-Signature
X-LocalBiz-Delivery
→ Log delivery (status, duration, response body)
→ Update lastTriggeredAt, failureCount
---

## 🔐 Auth flow

### JWT structure

```json
{
  "id": "user_object_id",
  "email": "user@example.com",
  "tenantId": "tenant_object_id",
  "role": "owner",
  "tv": 0,
  "jti": "random_16_hex",
  "iat": 1792000000,
  "exp": 1792604800
}

tv = token version (invalidates all sessions on bump)

jti = unique token ID (for session tracking)
Request → protect → tenant → requireRole → controller

1. protect: Verifies JWT, loads User, checks tv matches
2. tenant: Sets req.tenantId = user.tenantId
3. requireRole: Checks req.user.role against allowed roles

📈 Scaling strategy
Phase 1 — Free tier (current)
Vercel Hobby + Render Free + Atlas M0

Handles ~100 concurrent users

Cold starts after idle

Phase 2 — $7/mo Render Starter
No cold starts

99.95% SLA

Recommended when you get first paying customer

Phase 3 — Paid tier
Vercel Pro ($20/mo)

Render Standard ($25/mo)

Atlas M10 ($57/mo)

Redis cache layer (Upstash)

Sentry + UptimeRobot

Phase 4 — Scale
Read replicas for MongoDB

Redis for session store

CDN for static assets

Message queue (BullMQ) for webhooks

Separate worker dynos

🚨 Failure modes & mitigations
Failure	Impact	Mitigation
Render cold start (15 min idle)	30-60s first request	UptimeRobot ping every 5 min
LLM provider outage	Chat broken	Fallback chain: Groq → Cohere → Gemini
MongoDB Atlas pause (idle)	DB unreachable	Keep-alive ping
Resend quota exceeded	No emails	Queue + retry, fallback SMTP
Webhook endpoint down	Events lost	Retry queue (future)
Render memory limit	Backend crash	Monitor logs, upgrade tier