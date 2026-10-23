# 🧠 LocalBiz AI — Backend API

> The multi-tenant RAG API powering **LocalBiz AI** — a SaaS that lets small businesses chat with their documents.

[![Live Demo](https://img.shields.io/badge/Live_Demo-LocalBiz_AI-brightgreen)](https://ai-docqa-frontend-psi.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)

---

## 🚀 What it does

Upload a PDF → ask a question → get a cited answer → share with customers.

This backend handles:
- Multi-tenant workspace isolation
- PDF processing & vector embeddings
- RAG (Retrieval-Augmented Generation) pipeline
- Multi-LLM fallback (Groq → Cohere → Gemini)
- Stripe/Razorpay (mocked) billing
- Webhook delivery with HMAC signatures
- Admin panel + content moderation

---

## 🏗️ Architecture
Frontend (Vercel) ──HTTPS──> Backend (Render) ──Mongo──> MongoDB Atlas
│
├─> Groq / Cohere / Gemini (LLM)
├─> HuggingFace (Embeddings)
└─> Resend (Email)

See [architecture.md](./architecture.md) for full details.

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20+ |
| Framework | Express 4 |
| Database | MongoDB Atlas + Mongoose 8 |
| Vector Search | MongoDB Atlas Vector Search |
| AI | Groq, Cohere, Gemini (LLM), HuggingFace (Embeddings) |
| Auth | JWT + bcrypt + TOTP 2FA |
| Email | Resend |
| Testing | Jest + Supertest + k6 (load) |

---

## ✨ Features

- ✅ **Multi-tenant** — every query isolated by `tenantId`
- ✅ **RAG chat** — vector search + citations
- ✅ **Streaming** — SSE token-by-token response
- ✅ **Multi-LLM** — pick Groq, Cohere, Gemini per workspace
- ✅ **Response caching** — 1-hour TTL, saves API cost
- ✅ **Team invites** — role-based (owner/admin/member/viewer)
- ✅ **2FA** — TOTP + 10 backup codes
- ✅ **Sessions** — device tracking, revoke anywhere
- ✅ **GDPR** — data export + account deletion
- ✅ **Webhooks** — HMAC-SHA256 signed, 8 event types
- ✅ **Marketing automation** — onboarding drip, trial reminders, win-back
- ✅ **Content moderation** — OpenAI Moderation API + blocklist
- ✅ **Super admin** — MRR, tenant management, impersonation

---

## 📚 Documentation

| Doc | What it covers |
|-----|----------------|
| [architecture.md](./architecture.md) | System design, data flows, scaling |
| [database.md](./database.md) | 21 collections, indexes, vector search |
| [security.md](./security.md) | Auth, RBAC, multi-tenancy, incident response |
| [code_style.md](./code_style.md) | Naming, error handling, commits |
| [testing.md](./testing.md) | Manual + automated + load test plans |
| [agents.md](./agents.md) | AI agent instructions |

---

## ⚙️ Local Setup

### 1. Install dependencies

```bash
git clone https://github.com/jragastya9/ai-docqa-backend.git
cd ai-docqa-backend
npm install

2. Configure environment
Copy .env.example to .env and fill in:

env
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/localbizai

# Auth
JWT_SECRET=generate_with_crypto.randomBytes(64).toString('hex')
JWT_EXPIRES_IN=7d

# AI Providers (at least one required)
GROQ_API_KEY=...
COHERE_API_KEY=...
GEMINI_API_KEY=...

# Email
RESEND_API_KEY=...
EMAIL_FROM=LocalBiz AI <onboarding@resend.dev>

# App
FRONTEND_URL=http://localhost:3000
SUPER_ADMIN_EMAILS=you@example.com
3. Start the server
bash
npm run dev
Server runs at http://localhost:5000.

4. Verify
bash
curl http://localhost:5000/api/health
# → {"status":"ok","message":"API running"}
🌐 Environment Variables
Variable	Required	Description
MONGO_URI	✅	MongoDB Atlas connection string
JWT_SECRET	✅	64-byte hex for signing tokens
JWT_EXPIRES_IN	✅	Token lifetime (default 7d)
GROQ_API_KEY	⚠️	Primary LLM (free tier available)
COHERE_API_KEY	⚠️	Backup LLM
GEMINI_API_KEY	⚠️	Backup LLM
HF_API_KEY	✅	HuggingFace embeddings
RESEND_API_KEY	✅	Transactional email
EMAIL_FROM	✅	Sender name + address
FRONTEND_URL	✅	CORS origin (e.g. https://yourapp.vercel.app)
SUPER_ADMIN_EMAILS	✅	Comma-separated admin emails
⚠️ = at least one LLM provider required.

📊 Database
21 collections. Full schema in database.md.

Vector search:

Index: vector_index on chunks.embedding

Dimensions: 384 (MiniLM-L6)

Similarity: cosine

Filters: tenantId, documentId

🚀 Deployment
Render (backend)
Connect ai-docqa-backend repo

Start Command: node server.js

Environment: Add all vars from .env.example

Region: Singapore (for India)

Plan: Free tier (upgrade to Starter $7/mo for production)

MongoDB Atlas
Cluster: M0 free tier (512 MB)

Network Access: 0.0.0.0/0 (or specific Render IPs)

Vector Search index: created via Atlas UI

🧪 Testing
Manual
See testing.md for the 12-section test plan.

Load
bash
k6 run loadtest/k6-smoke.js    # 10 VUs, 30s
k6 run loadtest/k6-load.js     # 100 VUs, 4min
Previous results: 14,392 requests · 0% failures · 1ms avg.

📁 Project Structure
text
backend/
├── config/           env.js, db.js, plans.js
├── controllers/      Route handlers
├── middleware/       auth, rbac, planGuard, rateLimit
├── models/           Mongoose schemas
├── routes/           Express routers
├── services/         LLM, search, usage, email, webhooks
├── jobs/             node-cron scheduler
├── loadtest/         k6 scripts
├── utils/            jwt, deviceParser
└── server.js         Entry point
🔗 Related
Frontend: ai-docqa-frontend

Live Demo: ai-docqa-frontend-psi.vercel.app

📄 License
MIT © 2026 [AGASTYA]