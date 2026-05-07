import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = process.env.EMAIL_FROM ?? 'Kitazon <noreply@kitazon.com>';
const BASE   = process.env.FRONTEND_URL ?? 'https://kitazon.com';

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to: [to], subject, html });
  if (error) throw new Error(error.message);
}

/* ─── shared layout ─────────────────────────────────────────────────────────── */
function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1a1d27;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,rgba(249,115,22,0.18),rgba(245,158,11,0.08));border-bottom:1px solid rgba(249,115,22,0.22);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:900;color:#f97316;letter-spacing:-0.5px;">Kitazon</p>
          <p style="margin:4px 0 0;font-size:13px;color:#9ca3af;">Earn · Refer · Withdraw</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
          <p style="margin:0;font-size:11px;color:#6b7280;">© ${new Date().getFullYear()} Kitazon · <a href="${BASE}" style="color:#f97316;text-decoration:none;">kitazon.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const h2  = (t: string)  => `<h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#e8e8e8;">${t}</h2>`;
const p   = (t: string)  => `<p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.6;">${t}</p>`;
const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#f97316;color:#fff;padding:13px 28px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.2px;">${label}</a>`;
const otp = (code: string) =>
  `<div style="background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.25);border-radius:14px;padding:20px;text-align:center;margin:16px 0;">
    <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Your OTP Code</p>
    <p style="margin:0;font-size:42px;font-weight:900;letter-spacing:12px;color:#f97316;">${code}</p>
  </div>`;
const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 0;font-size:13px;color:#9ca3af;">${label}</td><td style="padding:6px 0;font-size:13px;font-weight:700;color:#e8e8e8;text-align:right;">${value}</td></tr>`;
const table = (rows: string) =>
  `<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin:16px 0;">${rows}</table>`;

/* ─── emails ─────────────────────────────────────────────────────────────────── */
export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${BASE}/verify-email?token=${token}`;
  await send(to, 'Verify your Kitazon email', layout('Verify Email', `
    ${h2(`Hi ${name.split(' ')[0]}, welcome! 👋`)}
    ${p('You\'re almost there. Verify your email address to unlock withdrawals and secure your account.')}
    <div style="text-align:center;margin:24px 0;">${btn(link, 'Verify My Email')}</div>
    ${p('This link expires in <strong style="color:#e8e8e8;">24 hours</strong>. If you didn\'t create a Kitazon account, you can safely ignore this email.')}
  `));
}

export async function sendWithdrawalOtp(to: string, name: string, code: string, amount: number): Promise<void> {
  await send(to, 'Kitazon Withdrawal OTP', layout('Withdrawal OTP', `
    ${h2(`Confirm your withdrawal`)}
    ${p(`Enter the code below to confirm your withdrawal of <strong style="color:#f97316;">₱${amount.toFixed(2)}</strong>.`)}
    ${otp(code)}
    ${p('This code expires in <strong style="color:#e8e8e8;">10 minutes</strong>. Never share this code with anyone.')}
    ${p('If you did not request a withdrawal, please change your password immediately.')}
  `));
}

export async function sendLoginAlert(to: string, name: string, ip: string, userAgent: string): Promise<void> {
  await send(to, 'New login to your Kitazon account', layout('Login Alert', `
    ${h2('New login detected')}
    ${p(`Hi ${name.split(' ')[0]}, we noticed a new login to your Kitazon account.`)}
    ${table(
      row('IP Address', ip) +
      row('Device', userAgent.slice(0, 80) + (userAgent.length > 80 ? '…' : '')) +
      row('Time', new Date().toUTCString())
    )}
    ${p('If this was you, no action is needed. If not, <strong style="color:#f97316;">change your password immediately</strong>.')}
  `));
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  await send(to, 'Your Kitazon password was changed', layout('Password Changed', `
    ${h2('Password updated')}
    ${p(`Hi ${name.split(' ')[0]}, your Kitazon account password was successfully changed.`)}
    ${p('If you made this change, no further action is needed. If you did <strong style="color:#ef4444;">not</strong> make this change, contact support immediately.')}
    <div style="text-align:center;margin:20px 0;">${btn(`${BASE}/account`, 'Review Account')}</div>
  `));
}

export async function sendWithdrawalConfirmation(to: string, name: string, amount: number, channel: string): Promise<void> {
  await send(to, 'Kitazon Withdrawal Submitted', layout('Withdrawal Submitted', `
    ${h2('Withdrawal submitted ✓')}
    ${p(`Hi ${name.split(' ')[0]}, your withdrawal request has been received and is pending review.`)}
    ${table(
      row('Amount', `₱${amount.toFixed(2)}`) +
      row('Channel', channel.toUpperCase()) +
      row('Status', 'Pending')
    )}
    ${p('GCash & Maya are processed within <strong style="color:#e8e8e8;">1 hour</strong>. Bank transfers within <strong style="color:#e8e8e8;">24 hours</strong>.')}
  `));
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${BASE}/reset-password?token=${token}`;
  await send(to, 'Reset your Kitazon password', layout('Reset Password', `
    ${h2('Password reset request')}
    ${p(`Hi ${name.split(' ')[0]}, we received a request to reset your Kitazon password.`)}
    <div style="text-align:center;margin:24px 0;">${btn(link, 'Reset My Password')}</div>
    ${p('This link expires in <strong style="color:#e8e8e8;">30 minutes</strong>. If you didn\'t request a reset, you can safely ignore this email.')}
  `));
}

export async function sendWithdrawalStatusEmail(to: string, name: string, amount: number, channel: string, status: string): Promise<void> {
  const statusMsg: Record<string, string> = {
    processing: 'Your withdrawal is being processed and will arrive soon.',
    completed:  'Your withdrawal has been completed! Funds have been sent to your account.',
    failed:     'Your withdrawal could not be processed. Your balance has been refunded. Please contact support if you need help.',
  };
  const statusColor: Record<string, string> = {
    processing: '#f97316',
    completed:  '#22c55e',
    failed:     '#ef4444',
  };
  const label  = status.charAt(0).toUpperCase() + status.slice(1);
  const msg    = statusMsg[status] ?? `Your withdrawal status has been updated to: ${status}.`;
  const color  = statusColor[status] ?? '#f97316';
  await send(to, `Kitazon Withdrawal ${label}`, layout(`Withdrawal ${label}`, `
    ${h2(`Withdrawal ${label.toLowerCase()}`)}
    ${p(`Hi ${name.split(' ')[0]}, ${msg}`)}
    ${table(
      row('Amount',  `₱${amount.toFixed(2)}`) +
      row('Channel', channel.toUpperCase()) +
      row('Status',  `<span style="color:${color};font-weight:800;">${label.toUpperCase()}</span>`)
    )}
    <div style="text-align:center;margin:20px 0;">${btn(`${BASE}/withdraw`, 'View Wallet')}</div>
  `));
}
