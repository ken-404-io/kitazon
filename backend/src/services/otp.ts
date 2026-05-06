import crypto from 'crypto';
import db from '../../config/database';
import { DbOtpToken } from '../types';

type OtpPurpose = 'email_verify' | 'withdrawal_otp' | 'password_reset';

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function createOtp(userId: number, purpose: OtpPurpose, ttlMinutes = 10): Promise<string> {
  const otp = purpose === 'email_verify' ? generateVerificationToken() : generateOtp();
  const tokenHash = hash(otp);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Invalidate any existing unused tokens for this purpose
  await db('otp_tokens')
    .where({ user_id: userId, purpose })
    .whereNull('used_at')
    .update({ used_at: new Date() });

  await db('otp_tokens').insert({ user_id: userId, token_hash: tokenHash, purpose, expires_at: expiresAt });
  return otp;
}

export async function verifyOtp(userId: number, otp: string, purpose: OtpPurpose): Promise<boolean> {
  const tokenHash = hash(otp);
  const record = await db<DbOtpToken>('otp_tokens')
    .where({ user_id: userId, token_hash: tokenHash, purpose })
    .whereNull('used_at')
    .where('expires_at', '>', new Date())
    .first();

  if (!record) return false;

  await db('otp_tokens').where({ id: record.id }).update({ used_at: new Date() });
  return true;
}
