import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../config/database';
import { DbUser } from '../types';
import { logAudit, logLoginEvent } from '../services/audit';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

const getClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signAccess(user: DbUser): string {
  return jwt.sign(
    { id: user.id, jti: crypto.randomUUID() },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

async function createRefreshToken(userId: number): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex');
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

export async function googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id_token } = req.body as { id_token?: string };
    if (!id_token) { res.status(400).json({ message: 'id_token is required.' }); return; }

    if (!process.env.GOOGLE_CLIENT_ID) {
      res.status(503).json({ message: 'Google Sign-In is not configured on this server.' });
      return;
    }

    const ticket = await getClient().verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) { res.status(400).json({ message: 'Invalid Google token.' }); return; }

    const normalizedEmail = payload.email.toLowerCase();
    const displayName     = payload.name ?? normalizedEmail.split('@')[0];

    let user = await db<DbUser>('users').where({ email: normalizedEmail }).first();

    if (!user) {
      // New user — create account; Google has already verified the email
      const referral_code = await generateReferralCode();
      const randomHash    = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const [created]     = await db<DbUser>('users').insert({
        name:           displayName,
        email:          normalizedEmail,
        password_hash:  randomHash,
        referral_code,
        email_verified: true,
        is_active:      true,
      }).returning('*');
      user = created;
    } else if (!user.is_active) {
      res.status(403).json({ message: 'Account is disabled. Please contact support.' });
      return;
    } else if (!user.email_verified) {
      // Mark existing account's email as verified since Google confirmed it
      await db('users').where({ id: user.id }).update({ email_verified: true });
      user = { ...user, email_verified: true };
    }

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

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
    res.set('Cache-Control', 'no-store');

    res.json({
      token: accessToken,
      user: {
        id:             user.id,
        name:           user.name,
        email:          user.email,
        balance:        user.balance,
        referral_code:  user.referral_code,
        email_verified: user.email_verified,
        is_admin:       user.is_admin ?? false,
        totp_enabled:   user.totp_enabled ?? false,
        last_login_at:  user.last_login_at ?? null,
        plan:           user.plan ?? 'free',
      },
    });
  } catch (err) { next(err); }
}
