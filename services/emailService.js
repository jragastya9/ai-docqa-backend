import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'LocalBiz AI <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Shared layout wrapper ───
function wrap(bodyHtml) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7f9;padding:40px 20px;">
          <tr>
            <td align="center">
              <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <tr>
                  <td style="padding:32px 40px 16px 40px;">
                    <div style="font-size:20px;font-weight:700;color:#0a0a0a;">LocalBiz AI</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 40px 32px 40px;">
                    ${bodyHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px 32px 40px;border-top:1px solid #f0f0f0;">
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                      You're receiving this email because you have an account on LocalBiz AI.
                      If you didn't expect this, you can safely ignore it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function button(href, label) {
  return `
    <a href="${href}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">
      ${label}
    </a>
  `;
}

function heading(text) {
  return `<h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#0a0a0a;">${text}</h1>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#4b5563;">${text}</p>`;
}

function fallbackLink(url) {
  return `
    <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
      Or copy this link into your browser:<br />
      <span style="color:#0a0a0a;word-break:break-all;">${url}</span>
    </p>
  `;
}

// ─── Send helper ───
async function send({ to, subject, html }) {
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    console.log(`📧 Email sent to ${to}: ${subject}`);
    return result;
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    throw err;
  }
}

// ═══════════════════════════════════════════
// TRANSACTIONAL EMAILS
// ═══════════════════════════════════════════

// ─── Welcome (fired on signup) ───
export async function sendWelcomeEmail({ to, name, tenantName }) {
  const subject = `Welcome to LocalBiz AI, ${name}!`;
  const html = wrap(`
    ${heading(`Welcome, ${name} 👋`)}
    ${paragraph(
      `Your workspace <strong>${tenantName}</strong> is ready. You can now upload PDFs, chat with them, and share Q&amp;A links with your customers.`
    )}
    ${paragraph('Here\'s what to do next:')}
    <ul style="margin:0 0 24px 20px;padding:0;color:#4b5563;font-size:15px;line-height:1.8;">
      <li>Upload your first document</li>
      <li>Ask it a question in Chat</li>
      <li>Invite a teammate</li>
    </ul>
    ${button(`${FRONTEND_URL}/dashboard`, 'Go to dashboard')}
  `);
  return send({ to, subject, html });
}

// ─── Email verification ───
export async function sendVerificationEmail({ to, name, token }) {
  const url = `${FRONTEND_URL}/verify-email?token=${token}`;
  const subject = 'Verify your email address';
  const html = wrap(`
    ${heading('Verify your email')}
    ${paragraph(`Hi ${name}, please confirm your email address to activate your account.`)}
    ${button(url, 'Verify email')}
    ${fallbackLink(url)}
  `);
  return send({ to, subject, html });
}

// ─── Password reset ───
export async function sendPasswordResetEmail({ to, name, token }) {
  const url = `${FRONTEND_URL}/reset-password?token=${token}`;
  const subject = 'Reset your password';
  const html = wrap(`
    ${heading('Reset your password')}
    ${paragraph(`Hi ${name}, we received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour.`)}
    ${button(url, 'Reset password')}
    ${fallbackLink(url)}
  `);
  return send({ to, subject, html });
}

// ─── Team invite ───
export async function sendTeamInviteEmail({
  to,
  inviterName,
  tenantName,
  role,
  inviteUrl,
  expiresInDays = 7,
}) {
  const subject = `You've been invited to join ${tenantName} on LocalBiz AI`;
  const html = wrap(`
    ${heading('You\'ve been invited to join a team')}
    ${paragraph(
      `<strong>${inviterName}</strong> has invited you to join <strong>${tenantName}</strong> on LocalBiz AI as a <strong>${role}</strong>.`
    )}
    ${paragraph(
      'LocalBiz AI is a workspace where you can chat with your documents, get cited answers, and share knowledge with your team.'
    )}
    ${button(inviteUrl, 'Accept invitation')}
    ${fallbackLink(inviteUrl)}
    ${paragraph(
      `<span style="font-size:12px;color:#9ca3af;">This invitation expires in ${expiresInDays} days. If you didn't expect this email, you can safely ignore it.</span>`
    )}
  `);
  return send({ to, subject, html });
}

// ─── New device login alert ───
export async function sendNewDeviceAlert({
  to,
  name,
  device,
  browser,
  os,
  ipAddress,
  city,
  country,
  time,
  revokeUrl,
}) {
  const location =
    city && country ? `${city}, ${country}` : country || 'Unknown location';
  const subject = 'New sign-in to your LocalBiz AI account';

  const html = wrap(`
    ${heading('New sign-in detected')}
    ${paragraph(
      `Hi ${name}, we noticed a new sign-in to your account from a device you haven't used before.`
    )}
    <table style="width:100%;margin:16px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#6b7280;width:120px;">Device</td>
        <td style="padding:8px 0;font-size:14px;color:#0a0a0a;">${device} · ${browser} on ${os}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#6b7280;">Location</td>
        <td style="padding:8px 0;font-size:14px;color:#0a0a0a;">${location}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#6b7280;">IP address</td>
        <td style="padding:8px 0;font-size:14px;color:#0a0a0a;">${ipAddress || 'Unknown'}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#6b7280;">Time</td>
        <td style="padding:8px 0;font-size:14px;color:#0a0a0a;">${time}</td>
      </tr>
    </table>
    ${paragraph(
      'If this was you, you can safely ignore this email. If this wasn&#39;t you, secure your account immediately.'
    )}
    ${button(revokeUrl, 'Review active sessions')}
    ${fallbackLink(revokeUrl)}
  `);

  return send({ to, subject, html });
}

// ═══════════════════════════════════════════
// MARKETING EMAILS (Day 26)
// ═══════════════════════════════════════════

function unsubscribeLink(userId, type) {
  const url = `${FRONTEND_URL}/unsubscribe?u=${userId}&t=${type}`;
  return `
    <p style="margin:24px 0 0 0;font-size:11px;line-height:1.6;color:#9ca3af;text-align:center;">
      Don't want these emails? <a href="${url}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
    </p>
  `;
}

// ─── Onboarding #1 (day 0 — right after signup) ───
export async function sendOnboarding1({ to, name, userId }) {
  const subject = 'Your first 5 minutes with LocalBiz AI';
  const html = wrap(`
    ${heading('Ready to chat with your documents?')}
    ${paragraph(`Hi ${name}, here's the fastest way to get value from LocalBiz AI:`)}
    <ol style="margin:0 0 24px 20px;padding:0;color:#4b5563;font-size:15px;line-height:1.8;">
      <li><strong>Upload a PDF</strong> — any document you want to chat with</li>
      <li><strong>Ask a question</strong> in the Chat tab</li>
      <li><strong>Get cited answers</strong> — every response shows its sources</li>
    </ol>
    ${paragraph('Takes about 2 minutes to upload, then your documents become searchable forever.')}
    ${button(`${FRONTEND_URL}/documents`, 'Upload your first PDF')}
    ${unsubscribeLink(userId, 'onboarding')}
  `);
  return send({ to, subject, html });
}

// ─── Onboarding #2 (day 1) ───
export async function sendOnboarding2({ to, name, userId, docCount }) {
  const subject = docCount
    ? 'Did you know you can share your AI?'
    : 'Need a hand getting started?';
  const html = wrap(`
    ${heading(docCount ? 'Share your AI with customers' : 'Stuck? Let\'s fix that')}
    ${
      docCount
        ? paragraph(
            `You've uploaded ${docCount} document${docCount > 1 ? 's' : ''}. Now you can turn it into a public Q&A page for your customers — no coding needed.`
          ) +
          paragraph(
            'Every share link gets its own QR code you can print, or embed on your website.'
          )
        : paragraph(
            "If you're not sure where to start, reply to this email. We'll help you personally."
          )
    }
    ${button(
      `${FRONTEND_URL}/${docCount ? 'share' : 'documents'}`,
      docCount ? 'Create your share link' : 'Upload a document'
    )}
    ${unsubscribeLink(userId, 'onboarding')}
  `);
  return send({ to, subject, html });
}

// ─── Onboarding #3 (day 3) ───
export async function sendOnboarding3({ to, name, userId }) {
  const subject = 'Unlock Pro features for your workspace';
  const html = wrap(`
    ${heading('Upgrade when you need more')}
    ${paragraph(`${name}, you're on the Free plan with:`)}
    <ul style="margin:0 0 24px 20px;padding:0;color:#4b5563;font-size:15px;line-height:1.8;">
      <li>1 document</li>
      <li>100 AI messages/month</li>
      <li>1 team member</li>
    </ul>
    ${paragraph('Need more? Pro unlocks:')}
    <ul style="margin:0 0 24px 20px;padding:0;color:#4b5563;font-size:15px;line-height:1.8;">
      <li>10 documents</li>
      <li>5,000 messages/month</li>
      <li>5 team members</li>
      <li>Custom branding &amp; QR codes</li>
    </ul>
    ${paragraph('Just ₹499/month. Cancel anytime.')}
    ${button(`${FRONTEND_URL}/billing`, 'See plans')}
    ${unsubscribeLink(userId, 'onboarding')}
  `);
  return send({ to, subject, html });
}

// ─── Trial ending reminder (2 days before) ───
export async function sendTrialReminder({ to, name, userId, daysLeft }) {
  const subject = `Your Pro trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
  const html = wrap(`
    ${heading(`⏰ ${daysLeft} days left on your Pro trial`)}
    ${paragraph(`${name}, your Pro trial ends soon. After that, your account moves back to the Free plan (1 document, 100 messages/month).`)}
    ${paragraph('Keep your documents, messages, and team by upgrading now:')}
    ${button(`${FRONTEND_URL}/billing`, 'Upgrade to Pro — ₹499/month')}
    ${paragraph('<span style="font-size:12px;color:#9ca3af;">Cancel anytime. No contracts.</span>')}
    ${unsubscribeLink(userId, 'marketing')}
  `);
  return send({ to, subject, html });
}

// ─── Usage warning (80% of monthly limit) ───
export async function sendUsageWarning({
  to,
  name,
  userId,
  percentUsed,
  resource,
  used,
  limit,
}) {
  const subject = `You've used ${percentUsed}% of your monthly ${resource}`;
  const html = wrap(`
    ${heading(`Heads up — ${percentUsed}% of your ${resource} used`)}
    ${paragraph(`${name}, you've used <strong>${used} of ${limit}</strong> ${resource} this month.`)}
    ${paragraph('When you hit the limit, new messages will be paused until next month or you upgrade.')}
    ${button(`${FRONTEND_URL}/billing`, 'Upgrade to Pro')}
    ${unsubscribeLink(userId, 'marketing')}
  `);
  return send({ to, subject, html });
}

// ─── Win-back (14+ days inactive) ───
export async function sendWinBack({ to, name, userId }) {
  const subject = "We haven't seen you in a while 👋";
  const html = wrap(`
    ${heading('Need help getting started?')}
    ${paragraph(`${name}, we noticed you haven't logged in for a couple of weeks.`)}
    ${paragraph('Here are 3 things that might help:')}
    <ul style="margin:0 0 24px 20px;padding:0;color:#4b5563;font-size:15px;line-height:1.8;">
      <li>Try uploading a different type of document (invoices, FAQs, contracts)</li>
      <li>Ask a question you'd normally have to search for</li>
      <li>Reply to this email — we'll walk you through it personally</li>
    </ul>
    ${button(`${FRONTEND_URL}/dashboard`, 'Come back to dashboard')}
    ${paragraph('<span style="font-size:12px;color:#9ca3af;">If you\'d rather not receive these, use the unsubscribe link below.</span>')}
    ${unsubscribeLink(userId, 'marketing')}
  `);
  return send({ to, subject, html });
}

// ─── Weekly digest ───
export async function sendWeeklyDigest({
  to,
  name,
  userId,
  stats,
  topQuestions,
}) {
  const subject = `Your week on LocalBiz AI — ${stats.messages} messages answered`;
  const topQ = (topQuestions || [])
    .slice(0, 3)
    .map(
      (q) =>
        `<li style="margin-bottom:6px;"><em>"${q.question.slice(0, 60)}"</em> — asked ${q.count} time${q.count > 1 ? 's' : ''}</li>`
    )
    .join('');

  const html = wrap(`
    ${heading('Your weekly digest')}
    ${paragraph(`Hi ${name}, here's what happened in your workspace this week:`)}
    <table style="width:100%;margin:16px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;font-size:14px;color:#6b7280;">Messages</td>
        <td style="padding:10px 0;font-size:20px;font-weight:700;color:#0a0a0a;text-align:right;">${stats.messages}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-size:14px;color:#6b7280;">Conversations</td>
        <td style="padding:10px 0;font-size:20px;font-weight:700;color:#0a0a0a;text-align:right;">${stats.conversations}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-size:14px;color:#6b7280;">Documents</td>
        <td style="padding:10px 0;font-size:20px;font-weight:700;color:#0a0a0a;text-align:right;">${stats.documents}</td>
      </tr>
    </table>
    ${
      topQ
        ? paragraph('<strong>Top questions this week:</strong>') +
          `<ul style="margin:0 0 24px 20px;padding:0;color:#4b5563;font-size:14px;line-height:1.6;">${topQ}</ul>`
        : ''
    }
    ${button(`${FRONTEND_URL}/analytics`, 'View full analytics')}
    ${unsubscribeLink(userId, 'weeklyDigest')}
  `);
  return send({ to, subject, html });
}
