import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'LocalBiz AI <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send a welcome email after signup.
 */
export async function sendWelcomeEmail({ to, name }) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to LocalBiz AI</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 40px 20px; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
        <div style="display: inline-block; width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; line-height: 48px; font-size: 24px;">✨</div>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px;">
        <h1 style="margin: 0 0 16px; font-size: 24px; color: #0f172a;">Welcome aboard, ${name}! 🎉</h1>
        <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
          You've just joined LocalBiz AI — the AI that answers questions about your documents.
        </p>
        <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
          Here's how to get started in 60 seconds:
        </p>
        <ol style="margin: 0 0 32px; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
          <li><strong>Upload a PDF</strong> — a menu, price list, or policy doc</li>
          <li><strong>Wait ~30 seconds</strong> while our AI learns it</li>
          <li><strong>Ask any question</strong> and get instant answers with sources</li>
        </ol>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background: #6366f1; border-radius: 8px; padding: 12px 24px;">
              <a href="${FRONTEND_URL}/documents" style="color: white; text-decoration: none; font-weight: 600; font-size: 14px;">Upload your first document →</a>
            </td>
          </tr>
        </table>
        <p style="margin: 32px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
          Questions? Reply to this email — we read every one.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 40px; background: #f8fafc; text-align: center; color: #94a3b8; font-size: 12px;">
        © 2026 LocalBiz AI · <a href="${FRONTEND_URL}" style="color: #94a3b8;">localbizai.com</a>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Welcome to LocalBiz AI',
      html,
    });
    console.log('Welcome email sent:', result);
    return result;
  } catch (error) {
    console.error('Email failed:', error);
    throw error;
  }
}

/**
 * Send email verification link.
 */
export async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 40px 20px; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
    <tr>
      <td style="padding: 40px;">
        <h1 style="margin: 0 0 16px; font-size: 22px; color: #0f172a;">Verify your email</h1>
        <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
          Hi ${name}, please verify your email to start using LocalBiz AI.
        </p>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background: #6366f1; border-radius: 8px; padding: 12px 24px;">
              <a href="${verifyUrl}" style="color: white; text-decoration: none; font-weight: 600; font-size: 14px;">Verify email →</a>
            </td>
          </tr>
        </table>
        <p style="margin: 32px 0 0; color: #94a3b8; font-size: 13px;">
          Or copy this link: <br>
          <code style="color: #6366f1; word-break: break-all;">${verifyUrl}</code>
        </p>
        <p style="margin: 24px 0 0; color: #94a3b8; font-size: 13px;">
          This link expires in 24 hours.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Verify your email — LocalBiz AI',
    html,
  });
}

/**
 * Send password reset link.
 */
export async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 40px 20px; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
    <tr>
      <td style="padding: 40px;">
        <h1 style="margin: 0 0 16px; font-size: 22px; color: #0f172a;">Reset your password</h1>
        <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
          Hi ${name}, we received a request to reset your password. Click the button below to set a new one.
        </p>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background: #6366f1; border-radius: 8px; padding: 12px 24px;">
              <a href="${resetUrl}" style="color: white; text-decoration: none; font-weight: 600; font-size: 14px;">Reset password →</a>
            </td>
          </tr>
        </table>
        <p style="margin: 32px 0 0; color: #94a3b8; font-size: 13px;">
          Or copy this link: <br>
          <code style="color: #6366f1; word-break: break-all;">${resetUrl}</code>
        </p>
        <p style="margin: 24px 0 0; color: #94a3b8; font-size: 13px;">
          This link expires in 1 hour. If you didn't request this, ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Reset your password — LocalBiz AI',
    html,
  });
}