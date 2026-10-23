
---

### 📄 FILE 5: `code_style.md`

```markdown
# 📝 Code Style — LocalBiz AI

**Version:** 1.0
**Last updated:** October 2026

Conventions for writing readable, maintainable code across the project.

---

## 🎯 General principles

1. **Readability > cleverness.** A junior dev should understand any file in 5 minutes.
2. **Consistency > personal preference.** Follow existing patterns.
3. **Small files > large files.** If a file exceeds 400 lines, consider splitting.
4. **Explicit > implicit.** No magic. No hidden side effects.
5. **Fail loudly in dev, silently in prod.** Log errors, return clean messages.

---

## 📝 JavaScript / TypeScript

### Naming

| Type | Convention | Example |
|------|-----------|---------|
| Variables | camelCase | `userName`, `documentId` |
| Functions | camelCase | `fetchDocuments()` |
| Classes | PascalCase | `ChatService` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| React components | PascalCase | `StatCard`, `ChatSidebar` |
| Files (frontend) | kebab-case | `stat-card.tsx`, `chat-sidebar.tsx` |
| Files (backend) | kebab-case | `usage-service.js`, `plan-guard.js` |
| DB collections | lowercase plural | `users`, `documents` |
| DB fields | camelCase | `tenantId`, `createdAt` |
| Env vars | UPPER_SNAKE_CASE | `MONGO_URI` |

### Functions

**Use `function` for named functions** (readable in stack traces):

```javascript
export async function fetchUser(id) {
  // ...
}

Use arrow functions for callbacks only:

javascript
const names = users.map((u) => u.name);
Async/await
Prefer async/await over .then(). Exception: when the promise is created directly.

javascript
// ✅ Good
try {
  const user = await User.findById(id);
  await user.save();
} catch (err) {
  console.error(err);
}

// ❌ Avoid
User.findById(id).then(user => user.save()).catch(err => console.error(err));
Error handling
Backend: always try/catch controllers. Return JSON errors.

javascript
export async function getUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    return res.json({ success: true, user });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
Frontend: catch, toast, fallback.

typescript
async function load() {
  try {
    const data = await api.get('/api/user');
    setUser(data);
  } catch (err) {
    toast.error('Failed to load user');
    console.error(err);
  }
}
Import order
Node built-ins (fs, crypto)

Third-party packages (express, mongoose)

Internal absolute imports (@/lib/..., ../models/...)

Types (only at end)

typescript
import crypto from 'crypto';
import express from 'express';
import mongoose from 'mongoose';

import { requireRole } from '../middleware/rbac.js';
import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';
⚛️ React / Next.js
Component structure
tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  title: string;
  onSubmit: (data: string) => void;
}

export function MyComponent({ title, onSubmit }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    // side effects
  }, []);

  function handleClick() {
    onSubmit(value);
  }

  return (
    <div>
      <h1>{title}</h1>
      <Button onClick={handleClick}>Submit</Button>
    </div>
  );
}
Client vs Server components
Default: Server component (no 'use client')

Add 'use client' when using:

useState, useEffect, useRef

Browser APIs (window, localStorage)

Event handlers (onClick)

Third-party client libraries

Props naming
Booleans: isX, hasX, showX, canX

Callbacks: onX (e.g. onClick, onSubmit)

Data: singular user, plural users

Hooks
One useEffect per concern. Don't combine unrelated effects.

Cleanup all subscriptions (return a function).

No conditional hooks. Hooks at top of component only.

tsx
// ✅ Good
useEffect(() => {
  const unsub = tenantStore.subscribe(setTenant);
  return unsub;
}, []);

// ❌ Bad — missing cleanup
useEffect(() => {
  tenantStore.subscribe(setTenant);
}, []);
🎨 CSS / Tailwind
Class ordering (rough)
Layout (flex, grid, block)

Positioning (relative, absolute)

Sizing (w-full, h-16)

Spacing (p-4, m-2, gap-2)

Typography (text-sm, font-bold)

Colors (bg-card, text-muted-foreground)

States (hover:, focus:, disabled:)

tsx
<div className="flex items-center justify-between w-full p-4 border-b border-border hover:bg-accent/50 transition">
Conditional classes
Use cn() helper:

tsx
import { cn } from '@/lib/utils';

<div className={cn(
  'base classes',
  isActive && 'active classes',
  disabled && 'opacity-50 cursor-not-allowed'
)} />
Never
❌ bg-white / bg-black / text-black / text-white (use tokens)

❌ Inline style={{ color: '#fff' }} for colors

❌ !important (Tailwind's ! prefix is worse)

❌ Custom CSS files (use Tailwind + globals.css)

🎯 File organization
Frontend
text
app/
├── (auth)/              Route group — no sidebar
├── (dashboard)/         Route group — with sidebar
├── api/                 API routes (minimal)
├── legal/               Legal pages
└── layout.tsx           Root layout

components/
├── ui/                  shadcn primitives — DO NOT EDIT
├── dashboard/           Dashboard-specific components
├── marketing/           Landing page components
└── shared/              Cross-page components

lib/
├── api.ts               Axios instance
├── {feature}-api.ts     Typed API clients
└── utils.ts             cn() helper
Backend
text
backend/
├── config/              env.js, db.js, plans.js
├── controllers/         Route handlers (one per feature)
├── middleware/          auth, rbac, planGuard, rateLimit, cache
├── models/              Mongoose schemas (one per collection)
├── routes/              Express routers
├── services/            Business logic (LLM, search, usage, email)
├── jobs/                node-cron scheduler
├── utils/               Helpers (jwt, deviceParser)
└── server.js            Entry point
📊 API response format
Always return { success, ... }:

javascript
// ✅ Success
res.json({
  success: true,
  user: { id, name, email }
});

// ✅ Error
res.status(400).json({
  success: false,
  error: 'Human-readable message',
  code: 'OPTIONAL_MACHINE_CODE'
});

// ❌ Never return raw data
res.json({ id, name, email });
🧪 Testing (see testing.md)
Backend: Jest + Supertest

Frontend: React Testing Library

E2E: Playwright (future)

🚨 Comments
Write comments for the "why", not the "what".

javascript
// ❌ Useless
// Increment counter by 1
counter++;

// ✅ Explains decision
// Bump tokenVersion to invalidate all existing JWTs
user.tokenVersion += 1;
Use TODO markers:

javascript
// TODO(day-31): Add streaming to share page
// FIXME: Handle expired tokens more gracefully
Never commit:

console.log (use console.error for errors only, remove debug logs)

Commented-out code

// @ts-ignore without explanation

🎯 Commit messages
Format: <type>: <subject>

Type	Usage
feat	New feature
fix	Bug fix
chore	Tooling, deps, config
docs	Documentation only
refactor	Code change, no feature/fix
test	Adding/fixing tests
style	Formatting only
Examples:

text
feat: add 2FA with TOTP backup codes
fix: prevent double-booking in document slots
chore: upgrade Next.js to 16.4
docs: add Day 22 security hardening notes
Body (optional):

text
feat: add webhook HMAC signing

- Sign all webhook payloads with HMAC-SHA256
- Include X-LocalBiz-Signature header
- Add secret rotation UI in Settings
- Add delivery logs with response status
🎯 Git workflow
Branch: main (single branch, ship small)

Commits: 1 feature = 1 commit

Push: after every working state

Never: force push to main (unless you're the only committer)

📋 PR review checklist (self)
□ tsc --noEmit passes
□ No console.log left
□ No commented-out code
□ No .env secrets in diff
□ Component tested in both light + dark mode
□ Mobile view tested
□ API errors handled gracefully
□ Commit message follows format