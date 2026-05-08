import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../config/database';
import { DbUser } from '../types';
import { logAudit, logLoginEvent } from '../services/audit';

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

async function upsertGoogleUser(email: string, name: string): Promise<DbUser> {
  const normalizedEmail = email.toLowerCase();
  let user = await db<DbUser>('users').where({ email: normalizedEmail }).first();

  if (!user) {
    const referral_code = await generateReferralCode();
    const randomHash    = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const [created]     = await db<DbUser>('users').insert({
      name,
      email:          normalizedEmail,
      password_hash:  randomHash,
      referral_code,
      email_verified: true,
      is_active:      true,
    }).returning('*');
    user = created;
  } else if (!user.is_active) {
    throw Object.assign(new Error('Account is disabled.'), { status: 403 });
  } else if (!user.email_verified) {
    await db('users').where({ id: user.id }).update({ email_verified: true });
    user = { ...user, email_verified: true };
  }
  return user;
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

/* ── GET /api/auth/google/redirect ─────────────────────────────────────────── */
export function googleRedirect(req: Request, res: Response): void {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).send('Google Sign-In is not configured.');
    return;
  }
  const url = getClient().generateAuthUrl({
    access_type: 'offline',
    scope:       ['email', 'profile'],
    prompt:      'select_account',
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

    const user = await upsertGoogleUser(payload.email, payload.name ?? payload.email.split('@')[0]);

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
    const { id_token } = req.body as { id_token?: string };
    if (!id_token) { res.status(400).json({ message: 'id_token is required.' }); return; }
    if (!process.env.GOOGLE_CLIENT_ID) {
      res.status(503).json({ message: 'Google Sign-In is not configured.' });
      return;
    }
    const verifier = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket   = await verifier.verifyIdToken({ idToken: id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload  = ticket.getPayload();
    if (!payload?.email) { res.status(400).json({ message: 'Invalid Google token.' }); return; }

    const user = await upsertGoogleUser(payload.email, payload.name ?? payload.email.split('@')[0]);

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
