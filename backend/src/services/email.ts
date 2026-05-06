import nodemailer from 'nodemailer';

const isDev = !process.env.EMAIL_HOST;

const transporter = isDev
  ? null
  : nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT ?? 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

const FROM = process.env.EMAIL_FROM ?? 'Kitazon <noreply@kitazon.com>';

async function send(to: string, subject: string, html: string): Promise<void> {
  if (isDev) {
    console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}\n${html}\n`);
    return;
  }
  await transporter!.sendMail({ from: FROM, to, subject, html });
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/verify-email?token=${token}`;
  await send(to, 'Verify your Kitazon email', `
    <h2>Hi ${name},</h2>
    <p>Welcome to Kitazon! Please verify your email address to enable withdrawals.</p>
    <p><a href="${link}" style="background:#f59e0b;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Verify Email</a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you did not create this account, ignore this email.</p>
  `);
}

export async function sendWithdrawalOtp(to: string, name: string, otp: string, amount: number): Promise<void> {
  await send(to, 'Kitazon Withdrawal OTP', `
    <h2>Hi ${name},</h2>
    <p>Your one-time code to confirm your withdrawal of <strong>₱${amount.toFixed(2)}</strong> is:</p>
    <h1 style="font-size:48px;letter-spacing:8px;color:#f59e0b;">${otp}</h1>
    <p>This code expires in <strong>10 minutes</strong>.</p>
    <p>If you did not request this withdrawal, please change your password immediately.</p>
  `);
}

export async function sendLoginAlert(to: string, name: string, ip: string, userAgent: string): Promise<void> {
  await send(to, 'New login to your Kitazon account', `
    <h2>Hi ${name},</h2>
    <p>A new login was detected on your Kitazon account.</p>
    <ul>
      <li><strong>IP:</strong> ${ip}</li>
      <li><strong>Device:</strong> ${userAgent.slice(0, 120)}</li>
      <li><strong>Time:</strong> ${new Date().toUTCString()}</li>
    </ul>
    <p>If this was you, no action is needed. If not, please change your password immediately.</p>
  `);
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  await send(to, 'Your Kitazon password was changed', `
    <h2>Hi ${name},</h2>
    <p>Your Kitazon account password was successfully changed.</p>
    <p>If you did not make this change, please contact support immediately.</p>
  `);
}

export async function sendWithdrawalConfirmation(to: string, name: string, amount: number, channel: string): Promise<void> {
  await send(to, 'Kitazon Withdrawal Submitted', `
    <h2>Hi ${name},</h2>
    <p>Your withdrawal request has been submitted successfully.</p>
    <ul>
      <li><strong>Amount:</strong> ₱${amount.toFixed(2)}</li>
      <li><strong>Channel:</strong> ${channel.toUpperCase()}</li>
      <li><strong>Status:</strong> Pending review</li>
    </ul>
    <p>You will receive your funds within 1–24 hours depending on your chosen channel.</p>
  `);
}
