
---

### 📄 FILE 6: `testing.md`

```markdown
# 🧪 Testing — LocalBiz AI

**Version:** 1.0
**Last updated:** October 2026

How we test the platform end-to-end.

---

## 🎯 Testing philosophy

1. **Test the critical path first.** Auth, upload, chat, payments.
2. **Test behavior, not implementation.** "User can log in" not "login function is called".
3. **Fail fast in CI.** Every push runs type check + tests.
4. **Manual E2E before every deploy.** Automated tests catch regressions, not UX issues.

---

## 📊 Test pyramid
┌──────────┐
│ E2E │ ~5% (Playwright, future)
│ (UI) │
├──────────┤
│Integration│ ~25% (Supertest + Jest)
│ (API) │
├──────────┤
│ Unit │ ~70% (Jest for services, RTL for components)
│ (Logic) │
└──────────┘

text

**Currently:** ~0% automated. **Target for month 2:** 40% coverage on critical paths.

---

## ✅ Pre-launch manual test plan

Run this before every deploy. ~15 minutes.

### Section 1 — Auth

- [ ] Sign up with valid email → welcome email arrives
- [ ] Sign up with duplicate email → error toast
- [ ] Login with correct credentials → redirects to dashboard
- [ ] Login with wrong password → error toast
- [ ] Forgot password → reset email arrives
- [ ] Reset password → can log in with new password
- [ ] Google login → lands on dashboard
- [ ] Change password in Settings → logged out, can log in with new one
- [ ] Logout → redirected to /login
- [ ] Logout all sessions → all devices logged out

### Section 2 — Documents

- [ ] Upload PDF → processing completes, appears in list
- [ ] Upload >100MB PDF → rejected with error
- [ ] Upload non-PDF → rejected with error
- [ ] Upload on Free plan → blocked after 1st document
- [ ] Upload on Pro plan → allows up to 10
- [ ] Delete document → removed from list + chunks deleted
- [ ] Document count matches actual files

### Section 3 — Chat

- [ ] Ask question → gets cited answer
- [ ] Answer streams token-by-token
- [ ] Sources panel shows correct citations
- [ ] Follow-up question → keeps context
- [ ] Stop button cancels mid-stream
- [ ] Ask same question twice → second one cached (⚡ badge)
- [ ] Thumbs up → feedback saved
- [ ] Thumbs down → feedback saved
- [ ] New conversation → old one still accessible
- [ ] Delete conversation → gone from sidebar

### Section 4 — Share links

- [ ] Create share link for doc → URL generated
- [ ] Open share link in incognito → chat works (no auth)
- [ ] QR code renders
- [ ] Expired link → error page
- [ ] Deleted doc → share link returns error

### Section 5 — Billing

- [ ] Free plan shows correct limits
- [ ] Upgrade to Pro → success toast, plan updates
- [ ] Sidebar shows "pro plan"
- [ ] Usage bars reflect new limits
- [ ] Downgrade to Free → back to free limits
- [ ] Invoice/subscription record created

### Section 6 — Team

- [ ] Invite teammate → email arrives
- [ ] Accept invite → new user joins workspace
- [ ] Change role → reflected in list
- [ ] Remove member → removed from workspace
- [ ] Owner can't be removed
- [ ] Last owner can't leave

### Section 7 — Security

- [ ] Enable 2FA → QR code scans
- [ ] Enter TOTP code → enabled, backup codes shown
- [ ] Log out → log in requires TOTP
- [ ] Disable 2FA with code → works
- [ ] Sessions list shows current device
- [ ] Revoke session → device logged out
- [ ] Download my data → JSON file downloads
- [ ] Delete account → confirmation, account gone

### Section 8 — Notifications

- [ ] Upload document → notification appears
- [ ] Upgrade plan → notification appears
- [ ] Notification bell shows unread count
- [ ] Mark as read → badge decrements
- [ ] Mark all as read → badge disappears
- [ ] Two tabs open → both update in real-time

### Section 9 — Search

- [ ] Cmd+K / Ctrl+K opens palette
- [ ] Type "doc" → shows matching documents
- [ ] Type conversation title → shows matching
- [ ] Arrow keys navigate results
- [ ] Enter opens result
- [ ] Esc closes palette

### Section 10 — Admin (super admin only)

- [ ] Admin dashboard shows MRR/ARR
- [ ] Tenants list loads
- [ ] Click tenant → detail page loads
- [ ] Impersonate → logged in as tenant
- [ ] Change plan → reflected in tenant record
- [ ] Feature flags toggle
- [ ] Backup export downloads JSON

### Section 11 — Mobile

- [ ] Landing page responsive
- [ ] Signup works on mobile
- [ ] Dashboard loads
- [ ] Sidebar is drawer
- [ ] Bottom nav works
- [ ] Chat streams on mobile
- [ ] PWA installable

### Section 12 — Dark mode

- [ ] Toggle works everywhere
- [ ] No white patches
- [ ] No unreadable text
- [ ] Charts adapt
- [ ] System preference detected

---

## 🧪 Automated testing (future)

### Backend — Jest + Supertest

```javascript
// backend/tests/auth.test.js
import request from 'supertest';
import app from '../server.js';

describe('POST /api/auth/signup', () => {
  it('creates a new user + tenant', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: `test${Date.now()}@test.com`,
        password: 'password123',
        businessName: 'Test Co'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    // ...
  });
});
Run: npm test

Frontend — React Testing Library
typescript
// frontend/components/__tests__/stat-card.test.tsx
import { render, screen } from '@testing-library/react';
import { StatCard } from '../stat-card';
import { FileText } from 'lucide-react';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(
      <StatCard label="Documents" value={42} icon={FileText} />
    );
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    render(
      <StatCard label="Docs" value={0} icon={FileText} loading />
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
Run: npm test in frontend/

E2E — Playwright (future)
typescript
// e2e/signup-flow.spec.ts
import { test, expect } from '@playwright/test';

test('user can sign up and chat', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Get Started');
  await page.fill('input[name="email"]', `e2e${Date.now()}@test.com`);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL(/\/dashboard/);
  
  // Upload PDF
  await page.goto('/documents');
  await page.setInputFiles('input[type="file"]', 'fixtures/sample.pdf');
  await expect(page.locator('text=sample.pdf')).toBeVisible();
  
  // Chat
  await page.goto('/chat');
  await page.fill('input[placeholder*="question"]', 'What is this doc?');
  await page.press('input', 'Enter');
  await expect(page.locator('.streaming-cursor')).toBeVisible();
});
🎯 Load testing — k6
Smoke test (10 VUs, 30s)
javascript
// backend/loadtest/k6-smoke.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:5000/api/health');
  check(res, { 'health ok': (r) => r.status === 200 });
}
Run: k6 run backend/loadtest/k6-smoke.js

Results from previous run
14,392 requests in 4 minutes

0% failures

Avg response: 1ms

P95: 1ms

100 concurrent users

See backend/loadtest/ for full scripts.

🐛 Bug tracking
Severity levels
Level	Definition	SLA
P0	Site down, data loss, security breach	Fix in 4 hours
P1	Major feature broken, no workaround	Fix in 24 hours
P2	Feature broken, workaround exists	Fix in 72 hours
P3	Cosmetic, minor UX	Next sprint
Bug report template
text
**Title:** [Short description]

**Severity:** P0/P1/P2/P3

**Environment:** Production / Staging / Local

**Steps to reproduce:**
1. 
2. 
3. 

**Expected:**
[what should happen]

**Actual:**
[what actually happens]

**Screenshot/Video:**
[attach]

**Browser/Device:**
[e.g. Chrome 130 on Windows 11]

**Logs:**
[paste from Sentry or browser console]
🔍 Testing checklist before launch
□ All 12 sections of manual test plan pass
□ Load test: 0% failures at 100 VUs
□ Lighthouse score: Performance 90+, SEO 100
□ Mobile: iOS Safari + Android Chrome
□ Dark mode: every page checked
□ Cookie banner appears and persists
□ Legal pages load
□ Email deliverability tested (check inbox + spam)
□ Sentry error rate < 1%
□ UptimeRobot ping every 5 min
