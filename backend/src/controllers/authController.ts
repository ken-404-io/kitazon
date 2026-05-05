import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../../config/database';
import { DbUser, AuthPayload } from '../types';

// Short-lived access token; use refresh tokens in production for longer sessions
const TOKEN_TTL = '2h';

const sign = (user: DbUser): string =>
  jwt.sign(
    { id: user.id, email: user.email, jti: crypto.randomUUID() },
    process.env.JWT_SECRET as string,
    { expiresIn: TOKEN_TTL }
  );

const safeUser = (u: DbUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  balance: u.balance,
  referral_code: u.referral_code,
});

// ─── Token blacklist (in-memory; use Redis in production) ────────────────────
export const tokenBlacklist = new Set<string>();

// Prune expired JTIs every hour so memory doesn't grow unbounded
setInterval(() => {
  // We can't inspect expiry without decoding, so clear the full set hourly.
  // Tokens expire in 2h, so any JTI older than that is already invalid.
  tokenBlacklist.clear();
}, 60 * 60 * 1000);

// ─── Account lockout (in-memory; use Redis in production) ───────────────────
interface LockoutEntry { attempts: number; lockedUntil: Date | null; }
const loginAttempts = new Map<string, LockoutEntry>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function checkLockout(key: string, res: Response): boolean {
  const entry = loginAttempts.get(key);
  if (entry?.lockedUntil && entry.lockedUntil > new Date()) {
    const mins = Math.ceil((entry.lockedUntil.getTime() - Date.now()) / 60000);
    res.status(429).json({ message: `Account locked. Try again in ${mins} minute(s).` });
    return true;
  }
  return false;
}

function recordFailure(key: string): void {
  const entry = loginAttempts.get(key) ?? { attempts: 0, lockedUntil: null };
  entry.attempts += 1;
  entry.lockedUntil = entry.attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
  loginAttempts.set(key, entry);
}

function clearAttempts(key: string): void {
  loginAttempts.delete(key);
}

// ─── Password strength ───────────────────────────────────────────────────────
function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

// ─── Email format ────────────────────────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
}

// ─── Controllers ─────────────────────────────────────────────────────────────
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, referral_code } = req.body as {
      name: string; email: string; password: string; referral_code?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ message: 'Name, email, and password are required.' });
      return;
    }
    if (name.trim().length < 2 || name.trim().length > 100) {
      res.status(400).json({ message: 'Name must be between 2 and 100 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'Invalid email address.' });
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) { res.status(400).json({ message: pwError }); return; }

    const normalizedEmail = email.toLowerCase();

    const exists = await db<DbUser>('users').where({ email: normalizedEmail }).first();
    if (exists) {
      res.status(409).json({ message: 'Email already registered.' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);

    // Generate referral code with collision retry
    let code: string;
    let attempts = 0;
    do {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const collision = await db<DbUser>('users').where({ referral_code: code }).first();
      if (!collision) break;
      attempts++;
    } while (attempts < 5);

    const [user] = await db<DbUser>('users').insert({
      name: name.trim(),
      email: normalizedEmail,
      password_hash: hash,
      referral_code: code!,
      balance: 0,
    }).returning('*');

    if (referral_code) {
      const upperCode = referral_code.toUpperCase().trim();
      if (upperCode !== code && upperCode.length > 0) {
        const referrer = await db<DbUser>('users').where({ referral_code: upperCode, is_active: true }).first();
        if (referrer && referrer.id !== user.id) {
          await db('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, commission_earned: 0 });
          await db('earnings').insert({ user_id: referrer.id, task_id: null, amount: 50, type: 'referral_signup', description: `Referral signup bonus — ${name.trim()}` });
          await db<DbUser>('users').where({ id: referrer.id }).increment('balance', 50);
        }
      }
    }

    res.status(201).json({ token: sign(user), user: safeUser(user) });
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email?.trim() || !password) {
      res.status(400).json({ message: 'Email and password required.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'Invalid email address.' });
      return;
    }

    const normalizedEmail = email.toLowerCase();
    const lockKey = `login:${normalizedEmail}`;

    if (checkLockout(lockKey, res)) return;

    const user = await db<DbUser>('users').where({ email: normalizedEmail }).first();
    if (!user) {
      recordFailure(lockKey);
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ message: 'Account is disabled. Please contact support.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      recordFailure(lockKey);
      const entry = loginAttempts.get(lockKey);
      const isLocked = entry?.lockedUntil && entry.lockedUntil > new Date();
      res.status(401).json({
        message: isLocked
          ? 'Account locked for 15 minutes due to too many failed attempts.'
          : 'Invalid email or password.',
      });
      return;
    }

    clearAttempts(lockKey);
    res.json({ token: sign(user), user: safeUser(user) });
  } catch (err) { next(err); }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const payload = req.user as AuthPayload & { jti?: string };
  if (payload?.jti) {
    tokenBlacklist.add(payload.jti);
  }
  res.json({ message: 'Logged out successfully.' });
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    res.json(safeUser(user));
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

    res.json({
      balance: user?.balance ?? 0,
      today: today?.total ?? 0,
      week: week?.total ?? 0,
      total: total?.total ?? 0,
    });
  } catch (err) { next(err); }
}
