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

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${BASE}/reset-password?token=${token}`;
  await send(to, 'Reset your Kitazon password', layout('Reset Password', `
    ${h2('Password reset request')}
    ${p(`Hi ${name.split(' ')[0]}, we received a request to reset your Kitazon password.`)}
    <div style="text-align:center;margin:24px 0;">${btn(link, 'Reset My Password')}</div>
    ${p('This link expires in <strong style="color:#e8e8e8;">30 minutes</strong>. If you didn\'t request a reset, you can safely ignore this email.')}
  `));
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  const resetLink = `${BASE}/forgot-password`;
  await send(to, 'Your Kitazon password was changed', layout('Password Changed', `
    ${h2('Password changed')}
    ${p(`Hi ${name.split(' ')[0]}, your Kitazon account password was just changed successfully.`)}
    ${p('All your active sessions have been logged out as a security precaution.')}
    ${p('If you did <strong style="color:#e8e8e8;">not</strong> make this change, your account may be compromised — <a href="${resetLink}" style="color:#f97316;">reset your password immediately</a> and contact support.')}
  `));
}

export async function sendLoginAlertEmail(to: string, name: string, ip: string, time: string): Promise<void> {
  const resetLink = `${BASE}/forgot-password`;
  await send(to, 'New sign-in to your Kitazon account', layout('New Sign-in Detected', `
    ${h2('New sign-in detected')}
    ${p(`Hi ${name.split(' ')[0]}, we noticed a sign-in to your account from a new location.`)}
    ${table(row('IP Address', ip) + row('Time', time))}
    ${p('If this was you, no action is needed. If you don\'t recognize this sign-in, <a href="${resetLink}" style="color:#f97316;">reset your password immediately</a>.')}
  `));
}

export async function sendSuspiciousWithdrawalEmail(to: string, name: string, amount: number, flags: string[]): Promise<void> {
  const resetLink = `${BASE}/forgot-password`;
  await send(to, 'Suspicious withdrawal detected on your Kitazon account', layout('Suspicious Activity', `
    ${h2('Unusual withdrawal activity')}
    ${p(`Hi ${name.split(' ')[0]}, we detected unusual activity on a withdrawal request of <strong style="color:#f97316;">₱${amount.toFixed(2)}</strong> from your account.`)}
    ${table(row('Flags', flags.join(', ')))}
    ${p('The withdrawal is being held for manual review. If this was you, no action is needed and you\'ll be notified once it\'s processed.')}
    ${p('If this was <strong style="color:#e8e8e8;">not</strong> you, <a href="${resetLink}" style="color:#f97316;">change your password immediately</a> and contact support.')}
  `));
}

export async function sendWithdrawalStatusEmail(to: string, name: string, status: 'completed' | 'failed', amount: number, channel: string, netAmount: number): Promise<void> {
  const isCompleted = status === 'completed';
  const subject = isCompleted ? 'Your Kitazon withdrawal is complete!' : 'Kitazon withdrawal could not be processed';
  const title   = isCompleted ? 'Withdrawal Complete' : 'Withdrawal Failed';
  const icon    = isCompleted ? '✅' : '❌';
  const color   = isCompleted ? '#22c55e' : '#ef4444';
  const supportLink = `${BASE}/account`;
  await send(to, subject, layout(title, `
    ${h2(`${icon} ${isCompleted ? 'Your withdrawal was processed!' : 'Withdrawal could not be processed'}`)}
    ${p(`Hi ${name.split(' ')[0]}, ${isCompleted
      ? `your withdrawal of <strong style="color:#f97316;">₱${amount.toFixed(2)}</strong> has been successfully processed.`
      : `we were unable to process your withdrawal of <strong style="color:#f97316;">₱${amount.toFixed(2)}</strong>. Your balance has been refunded.`
    }`)}
    ${table(
      row('Amount', `₱${amount.toFixed(2)}`) +
      row('You received', `₱${netAmount.toFixed(2)}`) +
      row('Channel', channel.toUpperCase()) +
      row('Status', `<span style="color:${color};font-weight:800;">${status.toUpperCase()}</span>`)
    )}
    ${isCompleted
      ? p('Thank you for using Kitazon. Keep earning!')
      : p(`Your balance has been restored. If you have questions, <a href="${supportLink}" style="color:#f97316;">contact support</a>.`)
    }
  `));
}

export async function sendWithdrawalSubmittedEmail(to: string, name: string, amount: number, channel: string, netAmount: number, fee: number): Promise<void> {
  await send(to, 'Kitazon Withdrawal Submitted', layout('Withdrawal Submitted', `
    ${h2('Withdrawal request received')}
    ${p(`Hi ${name.split(' ')[0]}, your withdrawal request has been submitted and is now being processed.`)}
    ${table(
      row('Amount', `₱${amount.toFixed(2)}`) +
      row('Fee', fee > 0 ? `₱${fee.toFixed(2)}` : 'None') +
      row('You receive', `₱${netAmount.toFixed(2)}`) +
      row('Channel', channel.toUpperCase())
    )}
    ${p('Processing takes 1–24 hours depending on your payment channel.')}
    ${p('If you did <strong style="color:#e8e8e8;">not</strong> request this withdrawal, contact support immediately.')}
  `));
}

export async function sendPlanUpgradeEmail(to: string, name: string, plan: string, expiresAt: Date): Promise<void> {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const expiryStr = expiresAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const dashboardLink = `${BASE}/dashboard`;
  await send(to, `You're now on Kitazon ${planLabel}! 🎉`, layout(`Plan Upgraded to ${planLabel}`, `
    ${h2(`Welcome to ${planLabel}, ${name.split(' ')[0]}! 🚀`)}
    ${p(`Your Kitazon account has been upgraded to the <strong style="color:#f97316;">${planLabel} Plan</strong>. Enjoy your new benefits!`)}
    ${table(
      row('Plan', `<span style="color:#f97316;font-weight:800;">${planLabel}</span>`) +
      row('Valid Until', expiryStr)
    )}
    ${p('Your plan will automatically revert to Free at the end of the period. Renew anytime to keep your benefits.')}
    <div style="text-align:center;margin:24px 0;">${btn(dashboardLink, 'Go to Dashboard')}</div>
    ${p('Thank you for supporting Kitazon!')}
  `));
}

export async function sendBroadcastEmail(to: string, name: string, subject: string, message: string): Promise<void> {
  const dashboardLink = `${BASE}/dashboard`;
  await send(to, subject, layout(subject, `
    ${h2(`Hi ${name.split(' ')[0]},`)}
    ${p(message.replace(/\n/g, '<br>'))}
    <div style="text-align:center;margin:24px 0;">${btn(dashboardLink, 'Go to Dashboard')}</div>
    ${p('Thank you for being part of the Kitazon community.')}
  `));
}

export async function sendReferralEarnedEmail(to: string, name: string, referredName: string, amount: number): Promise<void> {
  const dashboardLink = `${BASE}/dashboard`;
  await send(to, `You earned ₱${amount.toFixed(2)} from a referral!`, layout('Referral Bonus Earned', `
    ${h2(`You earned a referral bonus! 🎉`)}
    ${p(`Hi ${name.split(' ')[0]}, <strong style="color:#e8e8e8;">${referredName}</strong> just signed up using your referral link and you've earned a bonus.`)}
    ${table(
      row('Referred User', referredName) +
      row('Bonus Earned', `<span style="color:#22c55e;font-weight:800;">+₱${amount.toFixed(2)}</span>`)
    )}
    ${p('The bonus has been credited to your Kitazon balance. Keep sharing your referral link to earn more!')}
    <div style="text-align:center;margin:24px 0;">${btn(dashboardLink, 'View My Balance')}</div>
  `));
}
