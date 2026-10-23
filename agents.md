
---

### 📄 FILE 7: `agents.md`

```markdown
# 🤖 AGENTS.md — LocalBiz AI

**Version:** 1.0
**Last updated:** October 2026
**Purpose:** Instructions for AI coding agents (Claude, Cursor, Copilot, DeepSeek, etc.) working on this codebase.

---

## 🎯 What this is

LocalBiz AI is a multi-tenant RAG SaaS. When an AI agent picks up a task in this repo, these rules apply.

**Read all 6 other docs first:**
- `design_system.md` — UI patterns
- `architecture.md` — System design
- `database.md` — Schema
- `security.md` — Auth, RBAC
- `code_style.md` — Conventions
- `testing.md` — Tests

---

## 🚨 Critical rules

### 1. **Never break multi-tenancy**

Every query that touches tenant data MUST filter by `tenantId`:

```javascript
// ✅ Correct
await Document.find({ tenantId: req.tenantId });

// ❌ NEVER — leaks data
await Document.find({});
Exception: Public share pages filter by token field.

2. Never commit secrets
javascript
// ❌ NEVER
const API_KEY = 'sk_live_abc123...';

// ✅ Always
const API_KEY = process.env.OPENAI_API_KEY;
.env files are gitignored. Only .env.example is committed.

3. Never use bg-white or text-black
Use semantic tokens:

tsx
// ✅ Correct
<div className="bg-background text-foreground">

// ❌ Wrong
<div className="bg-white text-black">
4. Never edit components/ui/*
Those are shadcn primitives. Regenerate them via CLI if needed:

bash
npx shadcn@latest add button
5. Always type-check before committing
bash
cd frontend && npx tsc --noEmit
If it fails, fix before committing.

📋 File organization
Adding a new feature
Backend:

models/MyFeature.js — Mongoose schema

controllers/myfeature.controller.js — handlers

routes/myfeature.routes.js — express routes

Mount in server.js

(optional) services/myfeature.service.js — business logic

Frontend:

lib/myfeature-api.ts — typed API client

app/(dashboard)/myfeature/page.tsx — page

Add link to components/dashboard/sidebar.tsx

Add metadata via layout.tsx if needed

Adding a new endpoint
javascript
// routes/myfeature.routes.js
import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  return protect(req, res, next);
});

router.get('/', listItems);
router.post('/', requireRole('owner', 'admin'), createItem);
🎨 Frontend patterns
Client vs Server
Server component (default): no 'use client'

Client component: 'use client' at top

Add 'use client' when using:

useState, useEffect, useRef

localStorage, window

Event handlers (onClick)

useSearchParams, usePathname

Loading state pattern
tsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  load();
}, []);

async function load() {
  try {
    const res = await api.get('/api/myfeature');
    setData(res.data);
  } catch (err) {
    toast.error('Failed to load');
  } finally {
    setLoading(false);
  }
}

if (loading) return <Skeleton className="h-32" />;
if (!data) return <EmptyState />;
Forms
Use controlled inputs + validation:

tsx
const [email, setEmail] = useState('');
const [error, setError] = useState('');

function validate() {
  if (!email.trim()) {
    setError('Email required');
    return false;
  }
  return true;
}

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!validate()) return;
  
  try {
    await api.post('/api/x', { email });
    toast.success('Saved');
  } catch (err) {
    toast.error('Failed');
  }
}
API errors
tsx
try {
  await api.post('/api/x');
} catch (err: any) {
  const msg = err.response?.data?.error || 'Something went wrong';
  toast.error(msg);
}
🚨 Common pitfalls
Pitfall 1: Duplicate model index
If Mongoose warns "Duplicate schema index on {email: 1}", check:

javascript
// ❌ Both create an index
email: {
  unique: true,
  index: true  // ← remove this
}
Pitfall 2: app.listen on wrong interface
Render requires:

javascript
// ✅ Correct
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
Pitfall 3: .gitignore blocking source folders
Never add bare folder names (like models/ or controllers/) to .gitignore.

Only ignore:

node_modules/

.env*

.cache/ (build artifacts)

.next/ (Next.js build)

uploads/ (user uploads)

Pitfall 4: Nested <button> in Base UI
Base UI's DropdownMenuTrigger renders its own <button>. Don't wrap a <button> inside it:

tsx
// ❌ Nested buttons — hydration error
<DropdownMenuTrigger>
  <button>Click</button>
</DropdownMenuTrigger>

// ✅ Base UI pattern
<DropdownMenuTrigger className="...">
  Click
</DropdownMenuTrigger>
Pitfall 5: <div> inside <p>
tsx
// ❌ Hydration error
<p>
  <div>Content</div>
</p>

// ✅ Use div
<div>
  <div>Content</div>
</div>
Pitfall 6: Stale env vars
Env vars are read at server start. Restart the dev server after changing .env.

🔍 Testing checklist for agents
Before marking a task complete:

□ npx tsc --noEmit passes (frontend)
□ node --check passes on changed backend files
□ No console.log left in code
□ No commented-out code
□ Component tested in light + dark mode
□ Mobile view tested
□ Error states handled
□ Tenant isolation preserved (for data queries)
□ No new secrets committed
🎯 Commit message format
text
<type>: <short description>

<optional body with bullets>

<optional footer>
Types: feat, fix, chore, docs, refactor, test, style

Examples:

text
feat: add 2FA with TOTP backup codes

- Setup endpoint generates QR + secret
- Verify endpoint enables 2FA
- Disable endpoint with code verification
- Backup codes shown once on enablement

Closes #42
text
fix: prevent duplicate email index warning

The User model had both `unique: true` and `index: true` on
email field, causing Mongoose to warn about duplicate index.

Removed redundant `index: true`.
🚀 Deployment checklist (for agents)
Before suggesting a deploy:

□ All tests pass locally
□ All env vars documented in .env.example
□ No new dependencies missing from package.json
□ Backend PORT binding is 0.0.0.0 for Render
□ Frontend API URL points to production backend
□ CORS FRONTEND_URL matches production frontend
🎯 Things to ask the user before doing
Ask before:

Installing a new npm package (side effects, bundle size)

Adding a new database collection (migration needed)

Changing auth flow (breaks existing sessions)

Deleting any user data

Changing DNS or deployment config

Don't ask before:

Adding a new route/controller (isolated)

Adding a new UI component

Refactoring a function (if tests pass)

Fixing a bug (if clearly broken)

🎯 When to stop and ask
Stop and ask the user if:

A file has been corrupted (unexpected content)

Multiple attempts to fix the same error fail

The fix requires breaking API changes

Deploying to production would be involved

A secret was accidentally committed

The user's instructions conflict with this doc

🚨 Emergency procedures
If you accidentally commit a secret
STOP. Tell the user immediately. Then:

Rotate the secret at the provider

Remove from git history (BFG Repo-Cleaner or git filter-repo)

Force push

Update .env locally + on Render

If production is down
Check Render status page

Check Vercel status page

Check MongoDB Atlas status

Check browser console for errors

Paste logs to user

If cross-tenant data leak suspected
Immediately stop the query

Bump tokenVersion for all users

Audit recent access logs

Notify affected users

Fix + test isolation

Deploy fix

