import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../config/database';
import { DbUser } from '../types';
import { logAudit, logLoginEvent } from '../services/audit';
import { sendReferralEarnedEmail } from '../services/email';

const REFERRAL_SIGNUP_BONUS = 50;

const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

function getClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI, // https://api.kitazon.com/api/auth/google/callback
  );
}

function signAccess(user: DbUser): string {
  return jwt.sign(
    { id: user.id, jti: crypto.randomUUID() },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

async function createRefreshToken(userId: number): Promise<string> {
  const raw       = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db('refresh_tokens').insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
  return raw;
}

async function generateReferralCode(): Promise<string> {
  let code: string;
  do {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
  } while (await db('users').where({ referral_code: code }).first());
  return code;
}

async function upsertGoogleUser(
  email: string,
  name: string,
  options: { referralCode?: string | null; ip?: string | null } = {},
): Promise<{ user: DbUser; isNew: boolean }> {
  const normalizedEmail = email.toLowerCase();
  let user = await db<DbUser>('users').where({ email: normalizedEmail }).first();
  let isNew = false;

  if (!user) {
    const referral_code = await generateReferralCode();
    const randomHash    = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const insert: Record<string, unknown> = {
      name,
      email:          normalizedEmail,
      password_hash:  randomHash,
      referral_code,
      email_verified: true,
      is_active:      true,
    };
    if (options.ip) insert.registration_ip = options.ip;
    const [created]     = await db<DbUser>('users').insert(insert).returning('*');
    user = created;
    isNew = true;
  } else if (!user.is_active) {
    throw Object.assign(new Error('Account is disabled.'), { status: 403 });
  } else if (!user.email_verified) {
    await db('users').where({ id: user.id }).update({ email_verified: true });
    user = { ...user, email_verified: true };
  }

  if (isNew && options.referralCode) {
    await tryGrantGoogleReferral(user, options.referralCode);
  }

  return { user, isNew };
}

// For Google signups we know the email is verified by Google, so we can capture
// the referral relationship and grant the signup bonus in one step (mirroring
// what verifyEmail does for password signups). Lightweight fraud checks are
// applied so that abusive same-IP / self-referrals don't get paid.
async function tryGrantGoogleReferral(user: DbUser, rawCode: string): Promise<void> {
  try {
    const code = rawCode.toUpperCase().trim();
    if (!code) return;

    const referrer = await db<DbUser>('users').where({ referral_code: code, is_active: true }).first();
    if (!referrer || referrer.id === user.id) return;

    const existing = await db('referrals').where({ referred_id: user.id }).first();
    if (existing) return;

    // Same IP between referrer and new user → record the relationship but
    // don't pay the bonus. Matches the existing password-signup behaviour.
    const sameIp =
      user.registration_ip &&
      ((referrer.registration_ip && referrer.registration_ip === user.registration_ip) ||
        (referrer.last_login_ip && referrer.last_login_ip === user.registration_ip));

    if (sameIp) {
      try {
        await db('referrals').insert({
          referrer_id: referrer.id,
          referred_id: user.id,
          commission_earned: 0,
          bonus_paid: true,
        });
      } catch {
        await db('referrals').insert({
          referrer_id: referrer.id,
          referred_id: user.id,
          commission_earned: 0,
        });
      }
      console.warn(`[FRAUD] google referral blocked (same_ip): referrer=${referrer.id} user=${user.id}`);
      return;
    }

    await db.transaction(async (trx) => {
      try {
        await trx('referrals').insert({
          referrer_id: referrer.id,
          referred_id: user.id,
          commission_earned: 0,
          bonus_paid: true,
        });
      } catch {
        await trx('referrals').insert({
          referrer_id: referrer.id,
          referred_id: user.id,
          commission_earned: 0,
        });
      }
      await trx('earnings').insert({
        user_id: referrer.id,
        task_id: null,
        amount: REFERRAL_SIGNUP_BONUS,
        type: 'referral_signup',
        description: `Referral signup bonus — ${user.name}`,
      });
      await trx<DbUser>('users').where({ id: referrer.id }).increment('balance', REFERRAL_SIGNUP_BONUS);
    });

    sendReferralEarnedEmail(referrer.email, referrer.name, user.name, REFERRAL_SIGNUP_BONUS).catch(() => {});
  } catch (err) {
    // Referral failures must never break sign-in
    console.error('[google referral] grant error:', err);
  }
}

function safeUser(u: DbUser) {
  return {
    id:             u.id,
    name:           u.name,
    email:          u.email,
    balance:        u.balance,
    referral_code:  u.referral_code,
    email_verified: u.email_verified,
    is_admin:       u.is_admin ?? false,
    totp_enabled:   u.totp_enabled ?? false,
    last_login_at:  u.last_login_at ?? null,
    plan:           u.plan ?? 'free',
  };
}

function encodeState(payload: Record<string, string>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeState(state: string | undefined): Record<string, string> {
  if (!state) return {};
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) ?? {};
  } catch {
    return {};
  }
}

/* ── GET /api/auth/google/redirect ─────────────────────────────────────────── */
export function googleRedirect(req: Request, res: Response): void {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).send('Google Sign-In is not configured.');
    return;
  }
  const rawRef = (req.query.ref as string | undefined)?.trim() ?? '';
  // Cap and uppercase the referral code; ignore anything that isn't 4-12 hex
  // chars so a malformed query string can't bloat the OAuth state.
  const ref = /^[a-zA-Z0-9]{4,12}$/.test(rawRef) ? rawRef.toUpperCase() : '';
  const state = ref ? encodeState({ ref }) : undefined;

  const url = getClient().generateAuthUrl({
    access_type: 'offline',
    scope:       ['email', 'profile'],
    prompt:      'select_account',
    ...(state ? { state } : {}),
  });
  res.redirect(url);
}

/* ── GET /api/auth/google/callback ─────────────────────────────────────────── */
export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  const FRONTEND = process.env.FRONTEND_URL ?? 'https://www.kitazon.com';
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      res.redirect(`${FRONTEND}/login?error=google_failed`);
      return;
    }

    const client = getClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket  = await client.verifyIdToken({
      idToken:  tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.redirect(`${FRONTEND}/login?error=google_failed`);
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const stateData = decodeState(req.query.state as string | undefined);
    const referralCode = typeof stateData.ref === 'string' ? stateData.ref : null;

    const { user } = await upsertGoogleUser(payload.email, payload.name ?? payload.email.split('@')[0], {
      referralCode,
      ip,
    });

    await logLoginEvent(user.id, true, req);
    await logAudit(user.id, 'google_login', req);
    await db('users').where({ id: user.id }).update({ last_login_at: new Date() });

    // Revoke oldest sessions beyond cap (max 5)
    const active = await db('refresh_tokens')
      .where({ user_id: user.id }).whereNull('revoked_at').where('expires_at', '>', new Date())
      .orderBy('created_at', 'asc').select('id');
    if (active.length >= 5) {
      const toRevoke = active.slice(0, active.length - 4).map((r: { id: number }) => r.id);
      await db('refresh_tokens').whereIn('id', toRevoke).update({ revoked_at: new Date() });
    }

    const accessToken  = signAccess(user);
    const refreshToken = await createRefreshToken(user.id);

    // Set refresh token cookie — lax sameSite so it works cross-subdomain
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   true,
      sameSite: 'lax',
      maxAge:   REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path:     '/api/auth',
    });

    // Pass access token + user to frontend via URL fragment (never logged by servers)
    const userData = encodeURIComponent(JSON.stringify(safeUser(user)));
    res.redirect(`${FRONTEND}/auth/callback#token=${accessToken}&user=${userData}`);
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/auth/google (legacy ID-token flow — keep for compatibility) ─── */
export async function googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_token, referral_code } = req.body as { id_token?: string; referral_code?: string };
    if (!id_token) { res.status(400).json({ message: 'id_token is required.' }); return; }
    if (!process.env.GOOGLE_CLIENT_ID) {
      res.status(503).json({ message: 'Google Sign-In is not configured.' });
      return;
    }
    const verifier = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket   = await verifier.verifyIdToken({ idToken: id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload  = ticket.getPayload();
    if (!payload?.email) { res.status(400).json({ message: 'Invalid Google token.' }); return; }

    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const refCode = typeof referral_code === 'string' && /^[a-zA-Z0-9]{4,12}$/.test(referral_code.trim())
      ? referral_code.trim().toUpperCase()
      : null;

    const { user } = await upsertGoogleUser(payload.email, payload.name ?? payload.email.split('@')[0], {
      referralCode: refCode,
      ip,
    });

    await logLoginEvent(user.id, true, req);
    await logAudit(user.id, 'google_login', req);
    await db('users').where({ id: user.id }).update({ last_login_at: new Date() });

    const active = await db('refresh_tokens')
      .where({ user_id: user.id }).whereNull('revoked_at').where('expires_at', '>', new Date())
      .orderBy('created_at', 'asc').select('id');
    if (active.length >= 5) {
      const toRevoke = active.slice(0, active.length - 4).map((r: { id: number }) => r.id);
      await db('refresh_tokens').whereIn('id', toRevoke).update({ revoked_at: new Date() });
    }

    const accessToken  = signAccess(user);
    const refreshToken = await createRefreshToken(user.id);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path:     '/api/auth',
    });
    res.set('Cache-Control', 'no-store');
    res.json({ token: accessToken, user: safeUser(user) });
  } catch (err) { next(err); }
}
