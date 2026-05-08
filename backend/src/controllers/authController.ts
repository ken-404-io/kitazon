import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../../config/database';
import { DbUser, DbRefreshToken, AuthPayload } from '../types';
import { sendVerificationEmail, sendPasswordResetEmail, sendLoginAlertEmail } from '../services/email';
import { createOtp, verifyOtp } from '../services/otp';
import { logAudit, logLoginEvent } from '../services/audit';
import { verifyTotpLogin } from './totpController';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const MAX_PASSWORD_LENGTH = 128;

// Access token: short-lived JWT (15 min), id + jti only — no PII
function signAccess(user: DbUser): string {
  return jwt.sign(
    { id: user.id, jti: crypto.randomUUID() },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

// Refresh token: random 48-byte hex, stored as SHA-256 hash in DB
async function createRefreshToken(userId: number): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db('refresh_tokens').insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
  return raw;
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refresh_token', { path: '/api/auth' });
}

const safeUser = (u: DbUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  balance: u.balance,
  referral_code: u.referral_code,
  email_verified: u.email_verified,
  is_admin: u.is_admin ?? false,
  totp_enabled: u.totp_enabled ?? false,
  last_login_at: u.last_login_at ?? null,
  plan: u.plan ?? 'free',
});

// ─── Token blacklist (access tokens; in-memory, clears hourly) ───────────────
export const tokenBlacklist = new Set<string>();
setInterval(() => { tokenBlacklist.clear(); }, 60 * 60 * 1000);

// ─── Account lockout (DB-backed — survives restarts) ─────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;

async function isDbLocked(userId: number): Promise<boolean> {
  const since = new Date(Date.now() - LOCKOUT_MS);
  const [row] = await db('login_events')
    .where({ user_id: userId, success: false })
    .where('created_at', '>', since)
    .count('id as cnt');
  return Number(row.cnt) >= MAX_ATTEMPTS;
}

// ─── Session cap ──────────────────────────────────────────────────────────────
const MAX_SESSIONS = 5;

async function enforceSessions(userId: number): Promise<void> {
  // Revoke oldest sessions beyond the cap (keep newest MAX_SESSIONS - 1 to leave room for the new one)
  const active = await db('refresh_tokens')
    .where({ user_id: userId })
    .whereNull('revoked_at')
    .where('expires_at', '>', new Date())
    .orderBy('created_at', 'asc')
    .select('id');
  if (active.length >= MAX_SESSIONS) {
    const toRevoke = active.slice(0, active.length - MAX_SESSIONS + 1).map((r: { id: number }) => r.id);
    await db('refresh_tokens').whereIn('id', toRevoke).update({ revoked_at: new Date() });
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────
function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
}

// ─── hCaptcha verification ────────────────────────────────────────────────────
async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return true; // Skip in dev if not configured
  try {
    const body = new URLSearchParams({ secret, response: token });
    const r = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await r.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// ─── Referral code generator ──────────────────────────────────────────────────
async function generateReferralCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const collision = await db<DbUser>('users').where({ referral_code: code }).first();
    if (!collision) return code;
  }
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

// ─── Controllers ─────────────────────────────────────────────────────────────
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, referral_code, captcha_token } = req.body as {
      name: string; email: string; password: string; referral_code?: string; captcha_token?: string;
    };

    if (captcha_token !== undefined && !(await verifyCaptcha(captcha_token))) {
      res.status(400).json({ message: 'Captcha verification failed.' });
      return;
    }
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ message: 'Name, email, and password are required.' });
      return;
    }
    if (name.trim().length < 2 || name.trim().length > 100) {
      res.status(400).json({ message: 'Name must be between 2 and 100 characters.' });
      return;
    }
    if (!isValidEmail(email)) { res.status(400).json({ message: 'Invalid email address.' }); return; }
    const pwError = validatePassword(password);
    if (pwError) { res.status(400).json({ message: pwError }); return; }

    const normalizedEmail = email.toLowerCase();
    const exists = await db<DbUser>('users').where({ email: normalizedEmail }).first();
    if (exists) { res.status(409).json({ message: 'Email already registered.' }); return; }

    const [hash, code] = await Promise.all([bcrypt.hash(password, 12), generateReferralCode()]);

    const [user] = await db<DbUser>('users').insert({
      name: name.trim(), email: normalizedEmail, password_hash: hash,
      referral_code: code, balance: 0, email_verified: false,
    }).returning('*');

    // Send verification email
    const verifyToken = await createOtp(user.id, 'email_verify', 24 * 60);
    await sendVerificationEmail(user.email, user.name, verifyToken).catch(() => {});

    // Referral signup bonus (in transaction, idempotency-guarded)
    if (referral_code) {
      const upperCode = referral_code.toUpperCase().trim();
      if (upperCode.length > 0 && upperCode !== code) {
        const referrer = await db<DbUser>('users').where({ referral_code: upperCode, is_active: true }).first();
        if (referrer && referrer.id !== user.id) {
          await db.transaction(async (trx) => {
            const existing = await trx('referrals').where({ referred_id: user.id }).first();
            if (existing) return;
            await trx('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, commission_earned: 0 });
            await trx('earnings').insert({ user_id: referrer.id, task_id: null, amount: 50, type: 'referral_signup', description: `Referral signup bonus — ${name.trim()}` });
            await trx<DbUser>('users').where({ id: referrer.id }).increment('balance', 50);
          });
        }
      }
    }

    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(signAccess(user)),
      createRefreshToken(user.id),
    ]);
    await logAudit(user.id, 'register', req);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ token: accessToken, user: safeUser(user) });
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, captcha_token, totp_code } = req.body as { email: string; password: string; captcha_token?: string; totp_code?: string };

    if (captcha_token !== undefined && !(await verifyCaptcha(captcha_token))) {
      res.status(400).json({ message: 'Captcha verification failed.' });
      return;
    }
    if (!email?.trim() || !password) { res.status(400).json({ message: 'Email and password required.' }); return; }
    if (!isValidEmail(email)) { res.status(400).json({ message: 'Invalid email address.' }); return; }
    if (password.length > MAX_PASSWORD_LENGTH) { res.status(400).json({ message: 'Invalid credentials.' }); return; }

    const normalizedEmail = email.toLowerCase();

    const user = await db<DbUser>('users').where({ email: normalizedEmail }).first();
    if (!user) {
      // Constant-time dummy compare to prevent user-enumeration via timing
      await bcrypt.compare(password, '$2b$12$invalidhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      await logLoginEvent(0, false, req);
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }
    if (!user.is_active) {
      res.status(403).json({ message: 'Account is disabled. Please contact support.' });
      return;
    }

    // DB-backed lockout: count recent failures from login_events
    if (await isDbLocked(user.id)) {
      res.status(429).json({ message: 'Account locked for 15 minutes due to too many failed attempts.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await logLoginEvent(user.id, false, req);
      const stillLocked = await isDbLocked(user.id);
      res.status(401).json({ message: stillLocked ? 'Account locked for 15 minutes due to too many failed attempts.' : 'Invalid email or password.' });
      return;
    }

    // 2FA check
    if (user.totp_enabled) {
      if (!totp_code) {
        res.status(200).json({ requires_totp: true });
        return;
      }
      const totpOk = await verifyTotpLogin(user.id, totp_code);
      if (!totpOk) {
        await logLoginEvent(user.id, false, req);
        res.status(401).json({ message: 'Invalid 2FA code.' });
        return;
      }
    }

    await logLoginEvent(user.id, true, req);
    await logAudit(user.id, 'login', req);

    // Update last login info; alert if signing in from a new IP
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
    if (ip && user.last_login_ip && user.last_login_ip !== ip) {
      sendLoginAlertEmail(user.email, user.name, ip, new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })).catch(() => {});
    }
    await db('users').where({ id: user.id }).update({ last_login_at: new Date(), last_login_ip: ip });

    // Enforce concurrent session cap before issuing new token
    await enforceSessions(user.id);

    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(signAccess(user)),
      createRefreshToken(user.id),
    ]);
    setRefreshCookie(res, refreshToken);
    res.set('Cache-Control', 'no-store');
    res.json({ token: accessToken, user: safeUser(user) });
  } catch (err) { next(err); }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = req.cookies?.refresh_token as string | undefined;
    if (!raw) { res.status(401).json({ message: 'No refresh token.' }); return; }

    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');

    // Check if this token exists at all (including revoked)
    const anyRecord = await db<DbRefreshToken>('refresh_tokens')
      .where({ token_hash: tokenHash })
      .first();

    if (anyRecord?.revoked_at) {
      // Token was already revoked — possible theft. Revoke ALL sessions for this user.
      await db('refresh_tokens').where({ user_id: anyRecord.user_id }).update({ revoked_at: new Date() });
      clearRefreshCookie(res);
      res.status(401).json({ message: 'Session invalidated due to suspicious activity. Please log in again.' });
      return;
    }

    const record = anyRecord && !anyRecord.revoked_at && anyRecord.expires_at > new Date() ? anyRecord : null;

    if (!record) {
      clearRefreshCookie(res);
      res.status(401).json({ message: 'Invalid or expired refresh token.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: record.user_id, is_active: true }).first();
    if (!user) {
      clearRefreshCookie(res);
      res.status(401).json({ message: 'User not found.' });
      return;
    }

    // Token rotation: revoke old, issue new
    await db('refresh_tokens').where({ id: record.id }).update({ revoked_at: new Date() });
    const newRefreshToken = await createRefreshToken(user.id);

    setRefreshCookie(res, newRefreshToken);
    res.set('Cache-Control', 'no-store');
    res.json({ token: signAccess(user), user: safeUser(user) });
  } catch (err) { next(err); }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = req.user as AuthPayload & { jti?: string };
    if (payload?.jti) tokenBlacklist.add(payload.jti);

    // Revoke refresh token
    const raw = req.cookies?.refresh_token as string | undefined;
    if (raw) {
      const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
      await db('refresh_tokens').where({ token_hash: tokenHash }).update({ revoked_at: new Date() });
    }
    await logAudit(req.user!.id, 'logout', req);
    clearRefreshCookie(res);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) { next(err); }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.query as { token: string };
    if (!token || typeof token !== 'string') {
      res.status(400).json({ message: 'Verification token is required.' });
      return;
    }

    // Find user by hashed token (stored in otp_tokens)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const otpRecord = await db('otp_tokens')
      .where({ token_hash: tokenHash, purpose: 'email_verify' })
      .whereNull('used_at')
      .where('expires_at', '>', new Date())
      .first();

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired verification link.' });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('otp_tokens').where({ id: otpRecord.id }).update({ used_at: new Date() });
      await trx('users').where({ id: otpRecord.user_id }).update({ email_verified: true });
    });

    res.json({ message: 'Email verified successfully. You can now make withdrawals.' });
  } catch (err) { next(err); }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    if (user.email_verified) { res.status(400).json({ message: 'Email is already verified.' }); return; }

    const token = await createOtp(user.id, 'email_verify', 24 * 60);
    await sendVerificationEmail(user.email, user.name, token);
    res.json({ message: 'Verification email sent.' });
  } catch (err) { next(err); }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    res.json(safeUser(user));
  } catch (err) { next(err); }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as { email: string };
    if (!email?.trim() || !isValidEmail(email)) {
      // Always return 200 to prevent email enumeration
      res.json({ message: 'If that email is registered you will receive a reset link shortly.' });
      return;
    }
    const user = await db<DbUser>('users').where({ email: email.toLowerCase().trim(), is_active: true }).first();
    if (user) {
      const token = await createOtp(user.id, 'password_reset', 30);
      sendPasswordResetEmail(user.email, user.name, token).catch(() => {});
    }
    res.json({ message: 'If that email is registered you will receive a reset link shortly.' });
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = req.body as { token: string; password: string };
    if (!token || typeof token !== 'string') {
      res.status(400).json({ message: 'Reset token is required.' });
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) { res.status(400).json({ message: pwError }); return; }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const otpRecord = await db('otp_tokens')
      .where({ token_hash: tokenHash, purpose: 'password_reset' })
      .whereNull('used_at')
      .where('expires_at', '>', new Date())
      .first();

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired reset link.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: otpRecord.user_id, is_active: true }).first();
    if (!user) { res.status(400).json({ message: 'Invalid or expired reset link.' }); return; }

    const newHash = await bcrypt.hash(password, 12);

    await db.transaction(async (trx) => {
      await trx('otp_tokens').where({ id: otpRecord.id }).update({ used_at: new Date() });
      await trx('users').where({ id: user.id }).update({ password_hash: newHash });
      // Revoke all refresh tokens so old sessions cannot be reused
      await trx('refresh_tokens').where({ user_id: user.id }).update({ revoked_at: new Date() });
    });

    res.json({ message: 'Password reset successfully. Please log in with your new password.' });
  } catch (err) { next(err); }
}

export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [today] = await db('earnings').where({ user_id: req.user!.id }).where('created_at', '>=', todayStart).sum('amount as total');
    const [week] = await db('earnings').where({ user_id: req.user!.id }).where('created_at', '>=', weekStart).sum('amount as total');
    const [total] = await db('earnings').where({ user_id: req.user!.id }).sum('amount as total');

    res.json({ balance: user?.balance ?? 0, today: today?.total ?? 0, week: week?.total ?? 0, total: total?.total ?? 0 });
  } catch (err) { next(err); }
}
