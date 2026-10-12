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