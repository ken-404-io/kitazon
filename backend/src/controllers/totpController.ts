import { Request, Response, NextFunction } from 'express';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';
import db from '../../config/database';
import { DbUser } from '../types';

const ISSUER = 'Kitazon';

export async function setupTotp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    if (user.totp_enabled) { res.status(400).json({ message: '2FA is already enabled.' }); return; }

    const secret = new OTPAuth.Secret({ size: 20 });
    const secretBase32 = secret.base32;

    const totp = new OTPAuth.TOTP({ issuer: ISSUER, label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret });
    const otpauthUrl = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store pending secret (not yet enabled — user must verify first)
    await db('users').where({ id: user.id }).update({ totp_secret: secretBase32 });

    res.json({ secret: secretBase32, qr: qrDataUrl });
  } catch (err) { next(err); }
}

export async function verifyAndEnableTotp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.body as { code: string };
    if (!code || !/^\d{6}$/.test(code.trim())) {
      res.status(400).json({ message: '6-digit code required.' }); return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user?.totp_secret) { res.status(400).json({ message: 'Run setup first.' }); return; }

    const totp = new OTPAuth.TOTP({ issuer: ISSUER, label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(user.totp_secret) });
    const delta = totp.validate({ token: code.trim(), window: 1 });

    if (delta === null) { res.status(400).json({ message: 'Invalid code. Check your authenticator app.' }); return; }

    await db('users').where({ id: user.id }).update({ totp_enabled: true });
    res.json({ message: '2FA enabled successfully.' });
  } catch (err) { next(err); }
}

export async function disableTotp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.body as { code: string };
    if (!code || !/^\d{6}$/.test(code.trim())) {
      res.status(400).json({ message: '6-digit code required.' }); return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user?.totp_enabled || !user.totp_secret) {
      res.status(400).json({ message: '2FA is not enabled.' }); return;
    }

    const totp = new OTPAuth.TOTP({ issuer: ISSUER, label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(user.totp_secret) });
    const delta = totp.validate({ token: code.trim(), window: 1 });
    if (delta === null) { res.status(400).json({ message: 'Invalid code.' }); return; }

    await db('users').where({ id: user.id }).update({ totp_secret: null, totp_enabled: false });
    res.json({ message: '2FA disabled.' });
  } catch (err) { next(err); }
}

export async function verifyTotpLogin(userId: number, code: string): Promise<boolean> {
  const user = await db<DbUser>('users').where({ id: userId }).first();
  if (!user?.totp_enabled || !user.totp_secret) return true; // 2FA not set up — pass through

  const totp = new OTPAuth.TOTP({ issuer: ISSUER, label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(user.totp_secret) });
  return totp.validate({ token: code.trim(), window: 1 }) !== null;
}
