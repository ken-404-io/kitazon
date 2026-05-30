import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dns from 'dns/promises';
import db from '../../config/database';
import { DbUser, DbRefreshToken, AuthPayload } from '../types';
import { sendVerificationEmail, sendPasswordResetEmail, sendLoginAlertEmail, sendReferralEarnedEmail, sendAccountSuspendedEmail } from '../services/email';
import { createOtp, verifyOtp } from '../services/otp';
import { logAudit, logLoginEvent } from '../services/audit';
import { verifyTotpLogin } from './totpController';

const ACCESS_TOKEN_TTL = '60d';
const REFRESH_TOKEN_TTL_DAYS = 60;
// Grace window for refresh-token rotation. When several tabs/devices refresh at
// nearly the same time they all present the same cookie; the first request wins
// the rotation and the rest arrive carrying a token that was *just* revoked.
// Treat a token revoked within this window as a benign concurrent-rotation race
// (re-issue a fresh session) instead of nuking every session as suspected theft.
const REFRESH_GRACE_MS = 60_000;
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
  avatar_url: u.avatar_url ?? null,
  welcome_bonus_claimed: !!u.welcome_bonus_claimed_at,
});

// ─── Token blacklist (access tokens; in-memory, clears hourly) ───────────────
export const tokenBlacklist = new Set<string>();
setInterval(() => { tokenBlacklist.clear(); }, 60 * 60 * 1000);

// ─── Registration fraud guards ────────────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamail.info','guerrillamail.biz',
  'guerrillamail.de','guerrillamail.net','guerrillamail.org','guerrillamailblock.com',
  'grr.la','sharklasers.com','spam4.me','yopmail.com','yopmail.fr','cool.fr.nf',
  'jetable.fr.nf','nospam.ze.tc','nomail.xl.cx','mega.zik.dj','speed.1s.fr',
  'courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
  'temp-mail.org','temp-mail.io','throwam.com','throwaway.email','dispostable.com',
  'maildrop.cc','mailnull.com','spamgourmet.com','spamgourmet.net','spamgourmet.org',
  'discard.email','fakeinbox.com','tempr.email','getairmail.com','filzmail.com',
  'owlpic.com','tempinbox.com','chacuo.net','mailtemp.net','mt2014.com','mt2015.com',
  'spamfree24.org','spammotel.com','spamspot.com','trashmail.com','trashmail.me',
  'trashmail.net','trashmail.org','trashmail.io','trashmail.at','trashmail.xyz',
  'trashmail.app','mailnesia.com','getnada.com','zetmail.com','mintemail.com',
  'spamwc.de','tempail.com','10minutemail.com','10minutemail.net','10minutemail.org',
  '10minutemail.co.uk','10minutemail.us','burnermail.io','tempmail.com','tempmail.net',
  'tempmail.org','tempmail.us','mailsac.com','mohmal.com','crazydomain.com',
  'fakemail.net','mailforspam.com','throwam.com','anonbox.net','anonymail.dk',
  'mailexpire.com','spamgob.com','wegwerfmail.de','wegwerfmail.net','wegwerfmail.org',
  'trashdevil.com','trashdevil.de','mailscrap.com','spamfree.eu','spamthis.co.uk',
  'spamoff.de','emailsensei.com','spamgourmet.net','mytrashmail.com','no-spam.ws',
  'nospamfor.us','nospam4.us','spambox.us','spamcon.org','spamcorner.com',
  'spamday.com','spamdecoy.net','spamex.com','spamfighter.cf','spamfree24.org',
  'spamgob.com','spamhereplease.com','spamhole.com','spamify.com','spaminmotion.com',
  'tempinbox.com','throwam.com','tempr.email','tempemail.net','spamgourmet.com',
]);

// Block known bot/scraper user-agents
const BLOCKED_UA_PATTERNS = [
  /^python-requests/i, /^curl\//i, /^wget\//i, /^httpie/i, /^go-http/i,
  /^java\//i, /^php\//i, /^ruby/i, /^perl/i, /^libwww/i, /HeadlessChrome/i,
  /PhantomJS/i, /Selenium/i, /puppeteer/i, /playwright/i, /^axios\//i,
];

// Top common passwords to reject
const COMMON_PASSWORDS = new Set([
  'password','password1','password123','123456','123456789','12345678','1234567',
  'qwerty','abc123','monkey','dragon','111111','baseball','iloveyou','master',
  'sunshine','ashley','bailey','passw0rd','shadow','123123','654321','superman',
  'michael','football','letmein','welcome','hello','charlie','donald','password2',
  'qwerty123','1q2w3e4r','admin','admin123','root','toor','pass','test','guest',
  'login','welcome1','hello123','changeme','secret','trustno1','starwars','solo',
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return DISPOSABLE_DOMAINS.has(domain);
}

// Normalise Gmail address: remove dots and strip +alias so duplicates are caught
function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split('@');
  if (!local || !domain) return email.toLowerCase();
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const stripped = local.split('+')[0].replace(/\./g, '');
    return `${stripped}@gmail.com`;
  }
  // Strip +alias for other major providers too
  const strippedLocal = local.split('+')[0];
  return `${strippedLocal}@${domain}`;
}

function isLikelyFakeName(name: string): boolean {
  const clean = name.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (clean.length < 2) return true;
  // No vowels at all
  if (!/[aeiou]/.test(clean)) return true;
  // Consonant ratio > 80% for names longer than 5 chars
  const vowels = (clean.match(/[aeiou]/g) ?? []).length;
  if (clean.length > 5 && vowels / clean.length < 0.15) return true;
  // Contains commas or obvious gibberish patterns
  if (/[,;@#$%^&*=+|<>]/.test(name)) return true;
  // All digits
  if (/^\d+$/.test(name.trim())) return true;
  // Repeating characters (e.g. "aaaaaa", "ababab")
  if (/^(.)\1{4,}$/.test(clean)) return true;
  // Keyboard walk patterns (qwerty, asdfgh, zxcvbn, etc.)
  if (/^(qwert|asdfg|zxcvb|qwerty|asdfgh|zxcvbn)/i.test(clean)) return true;
  // Obviously fake: "test", "user", "admin", "fake", "null", "none", "anonymous"
  if (/^(test|user|admin|fake|null|none|anonymous|unknown|noname|bot|robot)$/i.test(clean)) return true;
  // Name is just numbers appended to a generic word (e.g. "user12345")
  if (/^(user|test|admin)\d+$/i.test(name.trim())) return true;
  return false;
}

// Detect if password is too similar to the email or name (e.g. password = email username)
function isPasswordTooSimilar(password: string, email: string, name: string): boolean {
  const pw = password.toLowerCase();
  const emailUser = email.split('@')[0].toLowerCase();
  const nameLower = name.toLowerCase().replace(/\s+/g, '');
  if (pw.includes(emailUser) && emailUser.length > 3) return true;
  if (pw.includes(nameLower) && nameLower.length > 4) return true;
  return false;
}

function isBlockedUserAgent(ua: string): boolean {
  return BLOCKED_UA_PATTERNS.some((p) => p.test(ua));
}

function getIp(req: Request): string {
  return ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) ?? req.ip ?? '';
}

// Verify email domain has real MX records (catches invented domains)
async function hasMxRecord(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

// Check if IP matches referrer — falls back to last_login_ip when registration_ip is null
function isSameIpAsReferrer(ip: string, referrer: DbUser & { registration_ip?: string | null }): boolean {
  if (!ip) return false;
  if (referrer.registration_ip && referrer.registration_ip === ip) return true;
  if (referrer.last_login_ip && referrer.last_login_ip === ip) return true;
  return false;
}

// Levenshtein distance — detect suspiciously similar email usernames across referrals
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

async function hasEmailCluster(newEmail: string, referrerId: number): Promise<boolean> {
  const newUser = newEmail.split('@')[0].toLowerCase();
  // Get email usernames of the last 10 referred users for this referrer
  const recent = await db('referrals')
    .join('users as referred', 'referrals.referred_id', 'referred.id')
    .where('referrals.referrer_id', referrerId)
    .orderBy('referrals.id', 'desc')
    .limit(10)
    .pluck('referred.email') as string[];
  for (const email of recent) {
    const existing = email.split('@')[0].toLowerCase();
    // Flag if username differs by only 1-2 chars (e.g. user1, user2, user3)
    if (existing.length > 3 && levenshtein(newUser, existing) <= 2) return true;
  }
  return false;
}

// Referrer eligibility: verified email + account >= 3 days old
async function isReferrerEligible(referrer: DbUser): Promise<boolean> {
  if (!referrer.email_verified) return false;
  const ageMs = Date.now() - new Date(referrer.created_at).getTime();
  if (ageMs < 3 * 24 * 60 * 60 * 1000) return false; // account < 3 days old
  return true;
}

// Referral velocity: block bonus if referrer already got 3+ bonuses in the last 24h
async function referrerExceedsDailyLimit(referrerId: number): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db('earnings')
    .where({ user_id: referrerId, type: 'referral_signup' })
    .where('created_at', '>', since)
    .count('id as cnt');
  return Number(row.cnt) >= 3;
}

// Auto-suspend a referrer who has accumulated >= 100 unverified referred accounts.
// Called non-blocking after every referral insert.
export async function checkAndSuspendForFakeReferrals(referrerId: number): Promise<void> {
  try {
    const row = await db('referrals')
      .join('users as referred', 'referrals.referred_id', 'referred.id')
      .where('referrals.referrer_id', referrerId)
      .where('referred.email_verified', false)
      .count('referrals.id as cnt')
      .first();
    const unverifiedCount = Number((row as { cnt?: unknown })?.cnt ?? 0);
    if (unverifiedCount >= 100) {
      const referrer = await db<DbUser>('users').where({ id: referrerId }).first();
      await db('users').where({ id: referrerId }).update({ is_active: false });
      await db('audit_logs').insert({
        user_id: referrerId,
        action: 'auto_suspend_fake_referrals',
        amount: null,
        ip_address: null,
        user_agent: null,
        metadata: JSON.stringify({ unverified_referral_count: unverifiedCount }),
      }).catch(() => {});
      console.warn(`[AUTO-SUSPEND] Referrer ${referrerId} suspended: ${unverifiedCount} unverified referrals.`);
      if (referrer?.email) {
        sendAccountSuspendedEmail(
          referrer.email,
          referrer.name,
          `Your account was automatically suspended because ${unverifiedCount} of your referred accounts have not verified their email address. This is a violation of our referral policy. If you believe this is a mistake, please contact support at support@kitazon.com.`
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[checkAndSuspendForFakeReferrals] error:', err);
  }
}

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
      name: string; email: string; password: string; referral_code?: string; captcha_token?: string; _t?: string; website?: string; _fp?: string;
    };
    const deviceFingerprint = (req.body as { _fp?: string })._fp ?? null;

    // ── Honeypot: bots fill hidden fields, humans don't ──
    if ((req.body as { website?: string }).website) {
      res.status(400).json({ message: 'Registration failed.' });
      return;
    }

    // ── Block known bot/scraper user-agents ──
    const ua = req.headers['user-agent'] ?? '';
    if (!ua || isBlockedUserAgent(ua)) {
      res.status(400).json({ message: 'Registration failed.' });
      return;
    }

    // ── Form timing: reject if submitted impossibly fast (< 3 s) ──
    const formMs = Number((req.body as { _t?: string })._t ?? 0);
    if (formMs > 0 && Date.now() - formMs < 3000) {
      console.warn(`[FRAUD] register too fast: ip=${getIp(req)} elapsed=${Date.now() - formMs}ms`);
      res.status(400).json({ message: 'Registration failed.' });
      return;
    }

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
    if (isLikelyFakeName(name.trim())) {
      res.status(400).json({ message: 'Please enter your real full name.' });
      return;
    }
    if (!isValidEmail(email)) { res.status(400).json({ message: 'Invalid email address.' }); return; }
    if (isDisposableEmail(email)) {
      res.status(400).json({ message: 'Disposable or temporary email addresses are not allowed. Please use a real email.' });
      return;
    }
    // Verify the email domain has real MX records — catches invented domains like @fake-xyz.com
    const mxValid = await hasMxRecord(email);
    if (!mxValid) {
      res.status(400).json({ message: 'Email domain does not appear to be valid. Please use a real email address.' });
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) { res.status(400).json({ message: pwError }); return; }

    // ── Common password check ──
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      res.status(400).json({ message: 'This password is too common. Please choose a stronger one.' });
      return;
    }

    // ── Password too similar to email/name ──
    if (isPasswordTooSimilar(password, email, name.trim())) {
      res.status(400).json({ message: 'Password must not be similar to your name or email.' });
      return;
    }

    // ── IP multi-account guard: block if this IP already has 3+ accounts ──
    const ip = getIp(req);
    if (ip) {
      const ipCount = await db('users').whereRaw('registration_ip = ?', [ip]).count('id as cnt').first();
      if (Number((ipCount as { cnt?: unknown })?.cnt ?? 0) >= 3) {
        console.warn(`[FRAUD] register blocked: ip=${ip} already has 3+ accounts`);
        res.status(429).json({ message: 'Too many accounts registered from this device. Please contact support.' });
        return;
      }
    }

    // ── Device fingerprint guard: block if this browser fingerprint already has an account ──
    if (deviceFingerprint) {
      try {
        const fpCount = await db('users').whereRaw('device_fingerprint = ?', [deviceFingerprint]).count('id as cnt').first();
        if (Number((fpCount as { cnt?: unknown })?.cnt ?? 0) >= 1) {
          console.warn(`[FRAUD] register blocked: fingerprint=${deviceFingerprint} already has an account`);
          res.status(409).json({ message: 'An account is already registered from this device. Each device can only have one account.' });
          return;
        }
      } catch { /* column may not exist yet — skip */ }
    }

    const normalizedEmail = email.toLowerCase().trim();
    const canonicalEmail  = normalizeEmail(normalizedEmail);

    // Check both raw email and canonical form (catches gmail dots/+alias tricks)
    const exists = await db<DbUser>('users')
      .where({ email: normalizedEmail })
      .orWhere({ email: canonicalEmail })
      .first();
    if (exists) { res.status(409).json({ message: 'Email already registered.' }); return; }

    const [hash, code] = await Promise.all([bcrypt.hash(password, 12), generateReferralCode()]);

    const [user] = await db<DbUser>('users').insert({
      name: name.trim(), email: normalizedEmail, password_hash: hash,
      referral_code: code, balance: 0, email_verified: false,
      registration_ip: ip || null,
      ...(deviceFingerprint ? { device_fingerprint: deviceFingerprint } : {}),
    }).returning('*');

    // Send verification email
    const verifyToken = await createOtp(user.id, 'email_verify', 24 * 60);
    await sendVerificationEmail(user.email, user.name, verifyToken).catch(() => {});

    // Record referral relationship — bonus is deferred until email is verified
    if (referral_code) {
      const upperCode = referral_code.toUpperCase().trim();
      if (upperCode.length > 0 && upperCode !== code) {
        const referrer = await db<DbUser>('users').where({ referral_code: upperCode, is_active: true }).first();
        if (referrer && referrer.id !== user.id) {
          const existing = await db('referrals').where({ referred_id: user.id }).first();
          if (!existing) {
            // Store relationship; bonus_paid=false so verifyEmail can grant it after checks
            try {
              await db('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, commission_earned: 0, bonus_paid: false });
            } catch {
              // Fallback if bonus_paid column doesn't exist yet
              await db('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, commission_earned: 0 });
            }
            // Non-blocking: suspend referrer if they've accumulated 100+ unverified accounts
            checkAndSuspendForFakeReferrals(referrer.id).catch(() => {});
          }
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

    if (!anyRecord) {
      clearRefreshCookie(res);
      res.status(401).json({ message: 'Invalid or expired refresh token.' });
      return;
    }

    if (anyRecord.revoked_at) {
      const revokedAgeMs = Date.now() - new Date(anyRecord.revoked_at).getTime();
      if (revokedAgeMs > REFRESH_GRACE_MS) {
        // Revoked well in the past and presented again — genuine reuse / possible
        // theft. Revoke ALL sessions for this user.
        await db('refresh_tokens').where({ user_id: anyRecord.user_id }).update({ revoked_at: new Date() });
        clearRefreshCookie(res);
        res.status(401).json({ message: 'Session invalidated due to suspicious activity. Please log in again.' });
        return;
      }
      // Within the grace window: a concurrent refresh already rotated this token.
      // Fall through and issue a fresh session so the racing tab stays logged in.
    }

    if (anyRecord.expires_at <= new Date()) {
      clearRefreshCookie(res);
      res.status(401).json({ message: 'Invalid or expired refresh token.' });
      return;
    }

    const record = anyRecord;

    let user = await db<DbUser>('users').where({ id: record.user_id, is_active: true }).first();
    if (!user) {
      clearRefreshCookie(res);
      res.status(401).json({ message: 'User not found.' });
      return;
    }

    // Auto-downgrade expired paid plans
    if (user.plan !== 'free' && user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) {
      await db('users').where({ id: user.id }).update({ plan: 'free', plan_expires_at: null });
      user = { ...user, plan: 'free', plan_expires_at: null };
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

    // Grant referral signup bonus now that email is confirmed real
    try {
      const verifiedUser = await db<DbUser>('users').where({ id: otpRecord.user_id }).first();
      if (verifiedUser && verifiedUser.email_verified) {
        const referral = await db('referrals').where({ referred_id: verifiedUser.id }).first();
        if (referral) {
          // Check if bonus already paid (bonus_paid column may not exist — treat missing as unpaid)
          const alreadyPaid = referral.bonus_paid === true;
          if (!alreadyPaid) {
            const referrer = await db<DbUser>('users').where({ id: referral.referrer_id }).first();
            if (referrer) {
              const userIp = verifiedUser.registration_ip ?? null;

              // Fraud checks at bonus grant time
              const sameIp = isSameIpAsReferrer(userIp ?? '', referrer as DbUser & { registration_ip?: string | null });

              const ipAbuseCount = userIp ? await db('referrals')
                .join('users as referred', 'referrals.referred_id', 'referred.id')
                .where('referrals.referrer_id', referrer.id)
                .where('referrals.referred_id', '!=', verifiedUser.id)
                .whereRaw('referred.registration_ip = ?', [userIp])
                .count('referrals.id as cnt').first() : null;
              const ipAbused = Number((ipAbuseCount as { cnt?: unknown })?.cnt ?? 0) > 0;

              // Referrer eligibility: verified + account >= 3 days old
              const referrerEligible = await isReferrerEligible(referrer);
              // Referrer velocity: max 3 bonuses per 24h
              const velocityExceeded = await referrerExceedsDailyLimit(referrer.id);
              // Email username similarity clustering
              const emailClustered = await hasEmailCluster(verifiedUser.email, referrer.id);
              // Device fingerprint match
              const referrerFp = (referrer as DbUser & { device_fingerprint?: string | null }).device_fingerprint;
              const verifiedFp  = (verifiedUser as DbUser & { device_fingerprint?: string | null }).device_fingerprint;
              const sameFp = !!(referrerFp && verifiedFp && referrerFp === verifiedFp);

              const fraudReasons: string[] = [];
              if (sameIp)            fraudReasons.push('same_ip');
              if (ipAbused)          fraudReasons.push('ip_already_claimed');
              if (!referrerEligible) fraudReasons.push('referrer_not_eligible');
              if (velocityExceeded)  fraudReasons.push('velocity_exceeded');
              if (emailClustered)    fraudReasons.push('email_cluster');
              if (sameFp)            fraudReasons.push('same_device_fingerprint');

              if (fraudReasons.length === 0) {
                await db.transaction(async (trx) => {
                  await trx('earnings').insert({ user_id: referrer.id, task_id: null, amount: 50, type: 'referral_signup', description: `Referral signup bonus — ${verifiedUser.name}` });
                  await trx<DbUser>('users').where({ id: referrer.id }).increment('balance', 50);
                  try { await trx('referrals').where({ id: referral.id }).update({ bonus_paid: true }); } catch { /* column may not exist */ }
                });
                sendReferralEarnedEmail(referrer.email, referrer.name, verifiedUser.name, 50).catch(() => {});
              } else {
                console.warn(`[FRAUD] referral bonus blocked at verify: referrer=${referrer.id} user=${verifiedUser.id} ip=${userIp} reasons=${fraudReasons.join(',')}`);
                try { await db('referrals').where({ id: referral.id }).update({ bonus_paid: true }); } catch { /* mark paid so we don't retry */ }
              }
            }
          }
        }
      }
    } catch (bonusErr) {
      // Never let bonus logic break email verification
      console.error('[verifyEmail] referral bonus error:', bonusErr);
    }

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
